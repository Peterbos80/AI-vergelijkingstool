/**
 * The tool scout against a real (in-process) PostgreSQL with the seed data:
 * hourly discovery, hourly verification, daily quarantine publication,
 * promotion and depublication. Fixture pages only, simulated time.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../setup/pglite';
import type { Database } from '@/lib/db/client';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { toolCandidates } from '@/lib/db/schema';
import { runAgent } from '@/agents/runner';
import type { Fetcher, FetchResult } from '@/agents/fetcher/types';
import type { AgentName } from '@/agents/types';

const T0 = new Date('2026-10-01T05:30:00Z'); // 07:30 in Amsterdam
const hours = (h: number) => new Date(T0.getTime() + h * 3600_000);
let db: Database;
let close: () => Promise<void>;

type Fixture = { status?: number; body: string; contentType?: string; finalUrl?: string };
type Route = [RegExp | string, Fixture];

/** Fixture fetcher with patterns (API URLs carry a time window) and a request log. */
function routes(list: Route[]): Fetcher & { requested: string[] } {
  const requested: string[] = [];
  const find = (url: string) => list.find(([k]) => (typeof k === 'string' ? k === url : k.test(url)))?.[1];
  const answer = (url: string, f: Fixture | undefined): FetchResult => {
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
