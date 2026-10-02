/**
 * The tool scout against a real (in-process) PostgreSQL with the seed data:
 * hourly discovery, hourly verification, daily quarantine publication,
 * promotion and depublication. Fixture pages only, simulated time.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../setup/pglite';
import type { Database } from '@/lib/db/client';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { agentActions, changeEvents, facts, reviewItems, toolCandidates, toolCapabilities, tools, type StoredDiscovery } from '@/lib/db/schema';
import { loadCatalog } from '@/lib/catalog/load';
import { rankForCapability } from '@/lib/engine/rank';
import { lexicalMatch } from '@/lib/engine/match-core';
import { fairFightsFor } from '@/lib/engine/compare';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { runAgent } from '@/agents/runner';
import { revertAction } from '@/agents/actions';
import { SCOUT_CONFIG } from '@/agents/lib/scout/config';
import type { Fetcher, FetchResult } from '@/agents/fetcher/types';
import type { AgentName } from '@/agents/types';

const T0 = new Date('2026-10-01T05:30:00Z'); // 07:30 in Amsterdam
const hours = (h: number) => new Date(T0.getTime() + h * 3600_000);
let db: Database;
let close: () => Promise<void>;

type Fixture = { status?: number; body: string; contentType?: string; finalUrl?: string } | Error;
type Route = [RegExp | string, Fixture];

/** Fixture fetcher with patterns (API URLs carry a time window) and a request log. */
function routes(list: Route[]): Fetcher & { requested: string[] } {
  const requested: string[] = [];
  const find = (url: string) => list.find(([k]) => (typeof k === 'string' ? k === url : k.test(url)))?.[1];
  const answer = (url: string, f: Fixture | undefined): FetchResult => {
    if (f instanceof Error) return { url, finalUrl: url, durationMs: 1, redirects: [], ok: false, status: null, contentType: null, body: '', errorKind: 'network', error: f.message };
    const base = { url, finalUrl: f?.finalUrl ?? url, durationMs: 1, redirects: [] as string[] };
    if (!f) return { ...base, ok: false, status: 404, contentType: null, body: '', errorKind: 'http', error: 'HTTP 404' };
    const status = f.status ?? 200;
    return { ...base, ok: status < 400, status, contentType: f.contentType ?? 'text/html', body: status < 400 ? f.body : '', ...(status >= 400 ? { errorKind: 'http' as const, error: `HTTP ${status}` } : {}) };
  };
  return {
    requested,
    async get(url) {
      requested.push(url);
      return answer(url, find(url));
    },
    async post(url, body) {
      requested.push(`POST ${url} ${body.slice(0, 40)}`);
      return answer(url, find(`POST ${url}`));
    },
  };
}

async function run(name: AgentName, fetcher: Fetcher, at: Date) {
  return runAgent(name, { db, fetcher, now: () => at, trigger: 'test', force: true });
}

const json = (body: unknown): Fixture => ({ body: JSON.stringify(body), contentType: 'application/json' });
const rss = (items: { title: string; link: string; date: Date }[]): Fixture => ({
  contentType: 'application/rss+xml',
  body: `<?xml version="1.0"?><rss version="2.0"><channel><title>News</title>${items
    .map((i) => `<item><title>${i.title}</title><link>${i.link}</link><guid>${i.link}</guid><pubDate>${i.date.toUTCString()}</pubDate></item>`)
    .join('')}</channel></rss>`,
});

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  await applySeed(db, loadSeedData(), new Date('2026-09-30T08:00:00Z'));
});
afterAll(async () => {
  delete process.env.PRODUCTHUNT_TOKEN;
  delete process.env.NEW_TOOL_MODE;
  delete process.env.NEW_TOOLS_PER_DAY;
  await close();
});

describe('hourly discovery', () => {
  const showHn = {
    hits: [
      { objectID: '41001', title: 'Show HN: VoxNova – AI voice generator for podcasts', url: 'https://voxnova.example/', points: 64, num_comments: 20, created_at_i: Math.floor(hours(-5).getTime() / 1000) },
      { objectID: '41002', title: 'Show HN: Second post about VoxNova AI', url: 'https://www.voxnova.example/blog', points: 30, created_at_i: Math.floor(hours(-4).getTime() / 1000) },
      { objectID: '41003', title: 'Show HN: Canva clone with AI', url: 'https://www.canva.com/', points: 300, created_at_i: Math.floor(hours(-3).getTime() / 1000) },
    ],
  };
  const stories = {
    hits: [
      { objectID: '41010', title: 'Introducing Sora', url: 'https://openai.com/index/sora/', points: 640, num_comments: 300, created_at_i: Math.floor(hours(-2).getTime() / 1000) },
      { objectID: '41011', title: 'Launch HN: Tessa (YC W26) – AI bookkeeping', url: 'https://tessa.example/', points: 120, created_at_i: Math.floor(hours(-2).getTime() / 1000) },
    ],
  };
  const repos = {
    items: [
      { full_name: 'voxnova-labs/voxnova', name: 'voxnova', html_url: 'https://github.com/voxnova-labs/voxnova', homepage: 'https://voxnova.example', stargazers_count: 1800, created_at: '2026-09-20T00:00:00Z', owner: { type: 'Organization' }, license: { spdx_id: 'Apache-2.0' } },
      { full_name: 'jane/solo', name: 'solo', html_url: 'https://github.com/jane/solo', homepage: 'https://solo.example', stargazers_count: 900, created_at: '2026-09-21T00:00:00Z', owner: { type: 'User' } },
    ],
  };
  const openaiFeed = rss([
    { title: 'Introducing Sora', link: 'https://openai.com/index/sora/', date: hours(-3) },
    { title: 'Our approach to safety', link: 'https://openai.com/index/safety/', date: hours(-3) },
  ]);
  const soraPost = { body: '<html><body><p>Sora turns text into video.</p><a href="https://sora.example/">Try Sora</a><a href="https://openai.com/">OpenAI</a></body></html>' };
  const base: Route[] = [
    [/^https:\/\/hn\.algolia\.com\/api\/v1\/search_by_date\?tags=show_hn&/, json(showHn)],
    [/^https:\/\/hn\.algolia\.com\/api\/v1\/search_by_date\?tags=story&/, json(stories)],
    [/^https:\/\/api\.github\.com\/search\/repositories\?q=topic%3Allm/, json(repos)],
    ['https://openai.com/news/rss.xml', openaiFeed],
    ['https://openai.com/index/sora', soraPost],
  ];

  it('records candidates from every allowed source, merged per domain, without user names', async () => {
    const f = routes(base);
    const r = await run('discovery', f, T0);
    expect(r.status, r.summary).toBe('partial'); // the other makers' feeds answer 404 in this fixture
    expect(r.summary).toContain('Product Hunt skipped (no PRODUCTHUNT_TOKEN)');
    expect(r.summary).toMatch(/maker feeds 1\/\d+ \(1 launches\)/);
    const cands = await db.select().from(toolCandidates);
    const by = new Map(cands.map((c) => [c.domain, c]));
    // HN and GitHub signals for the same product land on one candidate, keeping the best HN post.
    expect(by.get('voxnova.example')?.signals).toMatchObject({ hnId: '41001', hnPoints: 64, githubStars: 1800, githubRepo: 'voxnova-labs/voxnova', githubLicense: 'Apache-2.0' });
    // A maker's launch post becomes a candidate for the product it links to; the HN story about the post counts for it.
    expect(by.get('sora.example')).toMatchObject({ name: 'Sora', source: 'rss', sourceUrl: 'https://openai.com/index/sora' });
    expect(by.get('sora.example')?.signals).toMatchObject({ announcementUrl: 'https://openai.com/index/sora', announcementFeed: 'openai', hnPoints: 640 });
    expect(by.get('tessa.example')?.name).toBe('Tessa');
    // Known tools, makers' news sites and persons' repositories are never candidates.
    expect(by.has('canva.com')).toBe(false);
    expect(by.has('openai.com')).toBe(false);
    expect(by.has('solo.example')).toBe(false);
    expect(JSON.stringify(cands)).not.toContain('jane');
    // Only documented API hosts get the api option; the maker feed and post went through the robots-aware fetcher.
    expect(f.requested).toContain('https://openai.com/index/sora');
    expect(f.requested.some((u) => u.includes('producthunt'))).toBe(false);
  });

  it('an hour later: a window since the previous run, no duplicates, growing counts updated', async () => {
    const grown = { hits: [{ ...showHn.hits[0]!, points: 151 }] };
    const f = routes([[/tags=show_hn&/, json(grown)], ...base.slice(1)]);
    const r = await run('discovery', f, hours(1));
    expect(r.stats.candidates_new ?? 0).toBe(0);
    const [vox] = await db.select().from(toolCandidates).where(eq(toolCandidates.domain, 'voxnova.example'));
    expect(vox?.signals.hnPoints).toBe(151);
    expect(vox?.lastSeenAt.toISOString()).toBe(hours(1).toISOString());
    // HN: previous run − 48 h. The launch post is outside the feed window now, so it is not fetched again.
    const hnUrl = f.requested.find((u) => u.includes('tags=show_hn'))!;
    const since = Number(/created_at_i>(\d+)/.exec(hnUrl)![1]);
    expect(since).toBe(Math.floor((T0.getTime() - 48 * 3600_000) / 1000));
    expect(f.requested).not.toContain('https://openai.com/index/sora');
    expect((await db.select().from(toolCandidates)).length).toBe(3);
  });

  it('reads Product Hunt only with PRODUCTHUNT_TOKEN, through the API, following the product link where robots.txt allows', async () => {
    process.env.PRODUCTHUNT_TOKEN = 'ph-test-token';
    try {
      const ph = {
        data: {
          posts: {
            edges: [
              { node: { id: '900', name: 'Pagewise', url: 'https://www.producthunt.com/posts/pagewise', website: 'https://www.producthunt.com/r/PW1', votesCount: 420, createdAt: hours(-6).toISOString(), topics: { edges: [{ node: { slug: 'artificial-intelligence' } }] } } },
              { node: { id: '901', name: 'Blocked', url: 'https://www.producthunt.com/posts/blocked', website: 'https://www.producthunt.com/r/BL1', votesCount: 300, createdAt: hours(-6).toISOString(), topics: { edges: [{ node: { slug: 'artificial-intelligence' } }] } } },
            ],
          },
        },
      };
      const f = routes([
        ...base,
        ['POST https://api.producthunt.com/v2/api/graphql', json(ph)],
        ['https://www.producthunt.com/r/PW1', { body: '', finalUrl: 'https://pagewise.example/?ref=producthunt' }],
      ]);
      const r = await run('discovery', f, hours(2));
      expect(r.summary).toContain('Product Hunt 1');
      expect(r.summary).not.toContain('ph-test-token');
      const [pw] = await db.select().from(toolCandidates).where(eq(toolCandidates.domain, 'pagewise.example'));
      expect(pw).toMatchObject({ name: 'Pagewise', source: 'producthunt', sourceUrl: 'https://www.producthunt.com/posts/pagewise' });
      expect(pw?.signals).toMatchObject({ phId: '900', phVotes: 420 });
      expect(f.requested.some((u) => u.startsWith('POST https://api.producthunt.com/v2/api/graphql'))).toBe(true);
    } finally {
      delete process.env.PRODUCTHUNT_TOKEN;
    }
  });
});

describe('quarantine keeps a new tool out of rankings, recommendations and Match', () => {
  const discovery: StoredDiscovery = {
    candidateId: '00000000-0000-0000-0000-000000000001',
    addedAt: T0.toISOString(),
    popularity: 4,
    signals: [
      { kind: 'hackernews', value: 231, url: 'https://news.ycombinator.com/item?id=1', at: T0.toISOString(), label: null },
      { kind: 'github', value: 4200, url: 'https://github.com/echo-labs/echoscribe', at: T0.toISOString(), label: null },
    ],
    primaryCapability: 'transcription',
    checks: { green: 1, lastAt: T0.toISOString(), lastOk: true, failures: 0, lastFailureAt: null, lastReason: null },
    promotedAt: null,
  };
  let toolId: string;

  beforeAll(async () => {
    // As attractive as possible for transcription, so only the quarantine keeps it out.
    const [row] = await db
      .insert(tools)
      .values({ slug: 'echoscribe', name: 'EchoScribe', websiteUrl: 'https://echoscribe.example/', published: true, quarantineUntil: hours(24 * 7), discovery, hasFreeTier: true, confidence: 99, freshness: 'fresh', skillLevel: 'beginner' })
      .returning({ id: tools.id });
    toolId = row!.id;
    await db.insert(toolCapabilities).values({ toolId, capabilityId: 'transcription', strength: 'primary' });
    await recomputeToolSnapshot(db, toolId, DEFAULT_SETTINGS.freshness, T0);
  });

  it('keeps the tool reachable by slug, out of `tools`, and never indexable', async () => {
    // Even if its stored snapshot said "indexable", the site serves it with noindex while in quarantine.
    await db.update(tools).set({ indexable: { tool: true, pricing: true, alternatives: true } }).where(eq(tools.id, toolId));
    const catalog = await loadCatalog(db, 1, T0);
    expect(catalog.toolsBySlug.get('echoscribe')?.id).toBe(toolId);
    expect(catalog.tools.some((t) => t.id === toolId)).toBe(false);
    expect(catalog.quarantined?.map((t) => t.slug)).toEqual(['echoscribe']);
    expect(catalog.toolsBySlug.get('echoscribe')?.discovery?.signals.map((x) => x.kind)).toEqual(['hackernews', 'github']);
    expect(catalog.toolsBySlug.get('echoscribe')?.indexable).toEqual({ tool: false, pricing: false, alternatives: false });
    expect(catalog.stats.tools).toBe(catalog.tools.length);
  });

  it('is never ranked, matched or put in a Fair Fight', async () => {
    const catalog = await loadCatalog(db, 1, T0);
    expect(rankForCapability(catalog, 'transcription').some((t) => t.id === toolId)).toBe(false);
    for (const query of ['ik wil podcasts transcriberen, gratis', 'transcribe my interviews for free', 'meeting transcription']) {
      const out = lexicalMatch({ query, locale: 'nl', explicit: {}, approach: {}, skip: true, answered: 0 }, catalog);
      const chosen = Object.values(out.variants ?? {}).flatMap((v) => v.steps.flatMap((s) => [s.toolId, ...s.alternatives.map((a) => a.toolId)]));
      expect(chosen, query).not.toContain(toolId);
      expect(out.suggestions.toolIds, query).not.toContain(toolId);
    }
    expect(fairFightsFor(catalog, catalog.toolsBySlug.get('echoscribe')!)).toEqual([]);
    for (const t of catalog.tools) expect(fairFightsFor(catalog, t).some((o) => o.id === toolId)).toBe(false);
  });

  it('shows a logo stored with the tool (matched on its own domain), in the same shape as the generated ones', async () => {
    const logo = { title: 'EchoScribe', slug: 'echoscribe', version: '16.33.0', hex: '0B996E', path: 'M0 0h24v24H0z', source: 'https://echoscribe.example/brand', license: 'CC0-1.0' as const };
    await db.update(tools).set({ logo }).where(eq(tools.id, toolId));
    const catalog = await loadCatalog(db, 3, T0);
    expect(catalog.toolsBySlug.get('echoscribe')?.logo).toEqual({ title: 'EchoScribe', light: '#0b996e', dark: '#0b996e', path: 'M0 0h24v24H0z' });
  });

  it('is ranked once promoted (so the checks above are meaningful)', async () => {
    await db.update(tools).set({ quarantineUntil: null }).where(eq(tools.id, toolId));
    const catalog = await loadCatalog(db, 2, T0);
    expect(rankForCapability(catalog, 'transcription').some((t) => t.id === toolId)).toBe(true);
    await db.delete(tools).where(eq(tools.id, toolId));
  });
});

describe('hourly verification, daily publication in quarantine, promotion and depublication', () => {
  const home = (title: string, description: string, extra = '') => ({ body: `<html><head><title>${title}</title><meta name="description" content="${description}">${extra}</head><body><a href="/pricing">Pricing</a><a href="/privacy">Privacy</a><p>${description}</p></body></html>` });
  const pricing = (text: string) => ({ body: `<html><body>${text}</body></html>` });
  const sites: Route[] = [
    ['https://voxnova.example/', home('VoxNova — AI voice generator', 'Turn text into natural speech with AI voices.')],
    ['https://voxnova.example/pricing', pricing('<h3>Free</h3><p>$0</p><p>for hobby projects</p><h3>Pro</h3><p>$10/month</p>')],
    ['https://tessa.example/', home('Tessa — AI bookkeeping for small firms', 'Automate your books with AI.')],
    ['https://tessa.example/pricing', pricing('<h3>Starter</h3><p>$29/month</p>')],
    ['https://sora.example/', home('Sora — AI image generator', 'Create stunning images from text.')],
    ['https://nimbus.example/', home('Nimbus — AI image generator', 'Create stunning images from text.', '<link rel="alternate" type="application/rss+xml" href="/blog/rss.xml">')],
    ['https://nimbus.example/pricing', pricing('<h2>Free plan</h2><p>25 images a day</p><h2>Plus</h2><p>€8/month</p>')],
    ['https://nimbus.example/blog/rss.xml', rss([{ title: 'Introducing Nimbus', link: 'https://nimbus.example/blog/introducing-nimbus', date: hours(-30) }])],
  ];
  const at = (h: number) => hours(h); // T0 = 07:30 in Amsterdam

  beforeAll(async () => {
    process.env.NEW_TOOL_MODE = 'quarantine';
    // A candidate found on Hacker News whose own site announces its launch: two independent signals.
    await db.insert(toolCandidates).values({
      name: 'Nimbus',
      url: 'https://nimbus.example/',
      domain: 'nimbus.example',
      source: 'hackernews',
      sourceUrl: 'https://news.ycombinator.com/item?id=42000',
      signals: { hnId: '42000', hnPoints: 90, hnComments: 31, hnAt: Math.floor(hours(-20).getTime() / 1000) },
      firstSeenAt: hours(-20),
      lastSeenAt: hours(0),
    });
  });

  it('verifies the most popular candidates every hour and rejects the ones that fail a gate, with the reason', async () => {
    const r = await run('verification', routes(sites), at(2.5));
    expect(r.status, r.summary).toBe('success');
    const by = new Map((await db.select().from(toolCandidates)).map((c) => [c.domain, c]));
    expect(by.get('voxnova.example')?.status).toBe('verified');
    expect(by.get('nimbus.example')?.status).toBe('verified');
    // Its own feed announced the launch: a second signal, from the tool's own site.
    expect(by.get('nimbus.example')?.signals).toMatchObject({ announcementUrl: 'https://nimbus.example/blog/introducing-nimbus', announcementFeed: 'own-site' });
    expect(by.get('tessa.example')).toMatchObject({ status: 'rejected', notes: 'function_uncertain' }); // "bookkeeping" is no function we know
    expect(by.get('sora.example')).toMatchObject({ status: 'duplicate', notes: 'duplicate_name' }); // Sora is in the catalogue
    expect(by.get('pagewise.example')?.status).toBe('rejected'); // no page in this fixture: gone
    const dossier = by.get('voxnova.example')!.signals.dossier as { quote: { text: string; url: string }; functions: { primary: string; certain: boolean }; facts: { key: string }[] };
    expect(dossier.quote).toEqual({ text: 'Turn text into natural speech with AI voices.', url: 'https://voxnova.example/' });
    expect(dossier.functions).toMatchObject({ primary: 'text-to-speech', certain: true });
    expect(dossier.facts.map((f) => f.key)).toEqual(['has_free_tier', 'pricing_public', 'open_source']);
    expect(r.stats.rejected_function_uncertain).toBe(1);
    // Quarantine mode: nothing goes to the owner's inbox, nothing is published yet.
    expect(await db.select().from(reviewItems).where(eq(reviewItems.kind, 'new_tool'))).toEqual([]);
    expect((await db.select().from(tools).where(inArray(tools.slug, ['voxnova', 'nimbus']))).length).toBe(0);
  });

  it('publishes only within the daily window', async () => {
    const r = await run('new-tools', routes(sites), at(5)); // 12:30 in Amsterdam
    expect(r.summary).toContain('outside the publication window');
    expect((await db.select().from(tools).where(eq(tools.slug, 'voxnova'))).length).toBe(0);
  });

  it('publishes the most popular passing candidates, at most the daily number, in quarantine', async () => {
    process.env.NEW_TOOLS_PER_DAY = '1';
    const r = await run('new-tools', routes(sites), at(3)); // 08:30 in Amsterdam
    expect(r.summary, r.summary).toMatch(/^1 new tools added, 1 in quarantine, 0 rejected/);
    const [vox] = await db.select().from(tools).where(eq(tools.slug, 'voxnova'));
    expect(vox).toMatchObject({ name: 'VoxNova', websiteUrl: 'https://voxnova.example/', pricingUrl: 'https://voxnova.example/pricing', published: true, skillLevel: 'intermediate' });
    expect(vox!.quarantineUntil?.toISOString()).toBe(new Date(at(3).getTime() + 7 * 86_400_000).toISOString());
    expect(vox!.discovery?.signals.map((s) => [s.kind, s.value])).toEqual([
      ['hackernews', 151],
      ['github', 1800],
    ]);
    // Every fact is UNVERIFIED, with its source; the quote is literal.
    const f = await db.select().from(facts).where(eq(facts.toolId, vox!.id));
    expect(Object.fromEntries(f.map((x) => [x.key, x.status]))).toEqual({ site_description: 'unverified', functions: 'unverified', has_free_tier: 'unverified', pricing_public: 'unverified', open_source: 'unverified' });
    expect(f.find((x) => x.key === 'site_description')).toMatchObject({ value: 'Turn text into natural speech with AI voices.', evidence: 'Turn text into natural speech with AI voices.' });
    expect(f.every((x) => x.sourceId !== null && x.method === 'agent')).toBe(true);
    // Functions stay secondary until promotion; a Pulse event names the sources.
    expect((await db.select().from(toolCapabilities).where(eq(toolCapabilities.toolId, vox!.id))).map((c) => [c.capabilityId, c.strength])).toEqual([['text-to-speech', 'secondary']]);
    const [event] = await db.select().from(changeEvents).where(and(eq(changeEvents.toolId, vox!.id), eq(changeEvents.kind, 'new_tool')));
    expect(event?.sourceUrl).toBe('https://news.ycombinator.com/item?id=41001');
    expect(event?.summary?.nl).toContain('Hacker News (151 punten), GitHub (1.800 sterren)');
    const [action] = await db.select().from(agentActions).where(and(eq(agentActions.action, 'tool_quarantined'), eq(agentActions.toolId, vox!.id)));
    expect(action?.decision).toBe('auto_published_flagged');
    // Nimbus passed too, but today's number is reached: it waits for tomorrow.
    expect((await db.select().from(toolCandidates).where(eq(toolCandidates.domain, 'nimbus.example')))[0]?.status).toBe('verified');
    // In the catalogue: reachable by slug, noindex, out of rankings.
    const catalog = await loadCatalog(db, 10, at(3));
    expect(catalog.toolsBySlug.get('voxnova')?.discovery?.addedAt.toISOString()).toBe(at(3).toISOString());
    expect(catalog.toolsBySlug.get('voxnova')?.indexable).toEqual({ tool: false, pricing: false, alternatives: false });
    expect(rankForCapability(catalog, 'text-to-speech').some((t) => t.slug === 'voxnova')).toBe(false);
  });

  it('checks again, fresh, before publishing: a candidate that now fails a gate is rejected with the reason', async () => {
    delete process.env.NEW_TOOLS_PER_DAY;
    const moved: Route[] = [['https://nimbus.example/', { body: '<html><head><title>Nimbus</title></head></html>', finalUrl: 'https://other-brand.example/' }], ...sites];
    const r = await run('new-tools', routes(moved), at(26)); // the next day, 08:30
    expect(r.summary).toMatch(/^0 new tools added, 1 in quarantine, 1 rejected \(foreign_redirect 1\)/);
    expect((await db.select().from(toolCandidates).where(eq(toolCandidates.domain, 'nimbus.example')))[0]).toMatchObject({ status: 'rejected', notes: 'foreign_redirect' });
  });

  it('promotes a tool after 7 days with every check green: out of quarantine, its function primary', async () => {
    for (let h = 23; h <= 163; h += 20) {
      const r = await run('verification', routes(sites), at(h));
      expect(r.summary).toContain('quarantine: 1 checked, 0 taken offline');
    }
    const [before] = await db.select().from(tools).where(eq(tools.slug, 'voxnova'));
    expect(before!.discovery?.checks).toMatchObject({ green: 9, failures: 0, lastOk: true });
    const r = await run('new-tools', routes(sites), at(171)); // day 7, 10:30
    expect(r.summary).toContain('1 promoted');
    const [after] = await db.select().from(tools).where(eq(tools.slug, 'voxnova'));
    expect(after!.quarantineUntil).toBeNull();
    expect(after!.discovery?.promotedAt).toBe(at(171).toISOString());
    expect((await db.select().from(toolCapabilities).where(eq(toolCapabilities.toolId, after!.id)))[0]?.strength).toBe('primary');
    const catalog = await loadCatalog(db, 11, at(171));
    expect(rankForCapability(catalog, 'text-to-speech').some((t) => t.slug === 'voxnova')).toBe(true);
  });

  describe('depublication as soon as a gate fails (logged, reversible)', () => {
    let toolId: string;
    beforeAll(async () => {
      // Back in quarantine for these checks.
      const [promotion] = await db.select().from(agentActions).where(eq(agentActions.action, 'tool_promoted'));
      expect(await revertAction(db, promotion!.id, 'test')).toBe('reverted');
      const [vox] = await db.select().from(tools).where(eq(tools.slug, 'voxnova'));
      toolId = vox!.id;
      expect(vox!.quarantineUntil).not.toBeNull();
      expect((await db.select().from(toolCapabilities).where(eq(toolCapabilities.toolId, toolId)))[0]?.strength).toBe('secondary');
    });

    it('a site that is gone: offline at once, with what it was, what it became and why', async () => {
      const r = await run('verification', routes([]), at(200)); // every page answers 404
      expect(r.summary).toContain('1 taken offline');
      const [vox] = await db.select().from(tools).where(eq(tools.id, toolId));
      expect(vox?.published).toBe(false);
      const [action] = await db.select().from(agentActions).where(and(eq(agentActions.action, 'tool_depublished'), eq(agentActions.toolId, toolId)));
      expect(action).toMatchObject({ oldValue: { published: true }, newValue: { published: false }, reason: 'unreachable' });
      expect((await db.select().from(changeEvents).where(and(eq(changeEvents.toolId, toolId), eq(changeEvents.kind, 'new_tool'))))[0]?.status).toBe('rejected');
      const catalog = await loadCatalog(db, 12, at(200));
      expect(catalog.toolsBySlug.has('voxnova')).toBe(false);
      // Reversible.
      expect(await revertAction(db, action!.id, 'test')).toBe('reverted');
      expect((await db.select().from(tools).where(eq(tools.id, toolId)))[0]?.published).toBe(true);
    });

    it('a domain the owner blocked: offline at the next run, without fetching', async () => {
      SCOUT_CONFIG.blockedDomains.push('voxnova.example');
      try {
        const f = routes(sites);
        const r = await run('verification', f, at(201));
        expect(r.stats.depublished_blocked_domain).toBe(1);
        expect(f.requested).not.toContain('https://voxnova.example/');
      } finally {
        SCOUT_CONFIG.blockedDomains.pop();
      }
      const [action] = await db.select().from(agentActions).where(and(eq(agentActions.action, 'tool_depublished'), eq(agentActions.reason, 'blocked_domain')));
      expect(await revertAction(db, action!.id, 'test')).toBe('reverted');
    });

    it('an unreachable site: one failure restarts the 7 days, two in a row take it offline', async () => {
      const down: Route[] = [['https://voxnova.example/', new Error('connection reset')]];
      await db.update(tools).set({ discovery: sql`jsonb_set(${tools.discovery}, '{checks,lastAt}', to_jsonb(${at(180).toISOString()}::text))` }).where(eq(tools.id, toolId));
      await run('verification', routes(down), at(202));
      const [once] = await db.select().from(tools).where(eq(tools.id, toolId));
      expect(once).toMatchObject({ published: true });
      expect(once!.discovery?.checks).toMatchObject({ failures: 1, lastOk: false, lastReason: 'unreachable' });
      expect(once!.quarantineUntil!.getTime()).toBeGreaterThanOrEqual(at(202).getTime() + 7 * 86_400_000);
      await run('verification', routes(down), at(202.5)); // not due yet (an hour after a failure)
      expect((await db.select().from(tools).where(eq(tools.id, toolId)))[0]?.published).toBe(true);
      await run('verification', routes(down), at(203.5));
      expect((await db.select().from(tools).where(eq(tools.id, toolId)))[0]?.published).toBe(false);
    });
  });

  it('anomaly guard: more than 25 publications in 24 hours → nothing published, one escalation', async () => {
    await db.update(toolCandidates).set({ status: 'verified' }).where(eq(toolCandidates.domain, 'nimbus.example'));
    const fake = Array.from({ length: 25 }, () => ({ agent: 'new-tools', action: 'tool_quarantined', decision: 'auto_published_flagged' as const, createdAt: at(205) })); // yesterday 20:30, within 24 h
    await db.insert(agentActions).values(fake);
    const r = await run('new-tools', routes(sites), at(219)); // 08:30, day 10
    expect(r.summary).toContain('anomaly: nothing published');
    expect((await db.select().from(tools).where(eq(tools.slug, 'nimbus'))).length).toBe(0);
    const [item] = await db.select().from(reviewItems).where(eq(reviewItems.kind, 'anomaly_freeze'));
    expect(item).toMatchObject({ severity: 'p2', reasonCode: 'new_tools_over_daily_limit', defaultAction: 'discard_after_7d' });
  });
});
