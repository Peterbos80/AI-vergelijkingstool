/**
 * Discovery agent: finds candidate AI tools from public, documented sources
 * (docs/strategy/08 §3, 12 §3.1). It only fills `tool_candidates`; nothing is
 * published here. Sources:
 *  - Hacker News "Show HN" posts via the public Algolia HN API;
 *  - GitHub repositories (search API) with AI topics, stars and a homepage.
 * External JSON is validated (untrusted input); only names, URLs and counts
 * are kept — no descriptions or article text are copied.
 */
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { toolCandidates, tools } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { sourceDomain } from '@/lib/provenance/confidence';
import type { AgentContext, AgentDefinition } from '../types';

/** Domains that host many products; a candidate there is keyed by its path. */
const PLATFORM_DOMAINS = new Set(['github.com', 'gitlab.com', 'huggingface.co', 'vercel.app', 'netlify.app', 'notion.site', 'substack.com', 'medium.com', 'producthunt.com', 'apps.apple.com', 'play.google.com', 'chromewebstore.google.com', 'chrome.google.com']);
/** Never candidates: social networks, stores, news, link shorteners. */
const IGNORED_DOMAINS = new Set(['youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'reddit.com', 'news.ycombinator.com', 'bit.ly', 't.co', 'arxiv.org', 'wikipedia.org', 'google.com', 'apple.com', 'microsoft.com', 'amazon.com']);
const AI_TERMS = /\b(ai|a\.i\.|gpt|llm|llms|genai|generative|agent|agents|copilot|chatbot|machine learning|ml|diffusion|transformer|voice clone|text[- ]to[- ](speech|image|video))\b/i;

const HnHit = z.object({
  objectID: z.string(),
  title: z.string().max(400).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  points: z.number().int().nullable().optional(),
  num_comments: z.number().int().nullable().optional(),
  created_at_i: z.number().int(),
});
const HnResponse = z.object({ hits: z.array(z.unknown()) });

const GhRepo = z.object({
  full_name: z.string().max(200),
  name: z.string().max(200),
  html_url: z.string().url(),
  homepage: z.string().max(2000).nullable().optional(),
  stargazers_count: z.number().int(),
  archived: z.boolean().optional(),
  fork: z.boolean().optional(),
  created_at: z.string(),
});
const GhResponse = z.object({ items: z.array(z.unknown()) });

export interface Candidate {
  name: string;
  url: string;
  domain: string;
  source: 'hackernews' | 'github';
  sourceUrl: string;
  signals: Record<string, number | string>;
}

/** Normalised candidate key: registrable domain, or domain/path for platforms. */
export function candidateKey(url: string): { url: string; domain: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const domain = sourceDomain(u.toString());
  if (IGNORED_DOMAINS.has(domain)) return null;
  if (PLATFORM_DOMAINS.has(domain) || [...PLATFORM_DOMAINS].some((p) => u.hostname.endsWith(`.${p}`))) {
    const parts = u.pathname.split('/').filter(Boolean).slice(0, 2);
    if (u.hostname.endsWith('.vercel.app') || u.hostname.endsWith('.netlify.app') || u.hostname.endsWith('.notion.site')) return { url: `https://${u.hostname}/`, domain: u.hostname };
    if (parts.length < 2 && domain === 'github.com') return null;
    return { url: `https://${u.hostname}/${parts.join('/')}`, domain: `${domain}/${parts.join('/').toLowerCase()}` };
  }
  return { url: `${u.protocol}//${u.hostname}/`, domain };
}

/** "Show HN: Foo – an AI thing" → "Foo". */
export function nameFromTitle(title: string): string {
  const t = title.replace(/^show hn:\s*/i, '').trim();
  const cut = t.split(/\s[–—-]\s|:\s|,\s|\s\(/)[0] ?? t;
  return cut.slice(0, 80).trim();
}

export function parseHn(json: unknown): Candidate[] {
  const parsed = HnResponse.safeParse(json);
  if (!parsed.success) return [];
  const out: Candidate[] = [];
  for (const raw of parsed.data.hits) {
    const h = HnHit.safeParse(raw);
    if (!h.success || !h.data.url || !h.data.title) continue;
    if (!AI_TERMS.test(h.data.title)) continue;
    const key = candidateKey(h.data.url);
    if (!key) continue;
    out.push({
      name: nameFromTitle(h.data.title),
      url: key.url,
      domain: key.domain,
      source: 'hackernews',
      sourceUrl: `https://news.ycombinator.com/item?id=${encodeURIComponent(h.data.objectID)}`,
      signals: { hnPoints: h.data.points ?? 0, hnComments: h.data.num_comments ?? 0, hnAt: h.data.created_at_i },
    });
  }
  return out;
}

export function parseGithub(json: unknown, minStars: number): Candidate[] {
  const parsed = GhResponse.safeParse(json);
  if (!parsed.success) return [];
  const out: Candidate[] = [];
  for (const raw of parsed.data.items) {
    const r = GhRepo.safeParse(raw);
    if (!r.success || r.data.archived || r.data.fork || r.data.stargazers_count < minStars) continue;
    // Prefer the product homepage; fall back to the repository itself.
    const home = r.data.homepage && /^https?:\/\//i.test(r.data.homepage) ? candidateKey(r.data.homepage) : null;
    const key = home ?? candidateKey(r.data.html_url);
    if (!key) continue;
    out.push({
      name: r.data.name.slice(0, 80),
      url: key.url,
      domain: key.domain,
      source: 'github',
      sourceUrl: r.data.html_url,
      signals: { githubStars: r.data.stargazers_count, githubRepo: r.data.full_name, githubCreated: r.data.created_at },
    });
  }
  return out;
}

async function fetchJson(ctx: AgentContext, url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
  const res = await ctx.fetcher.get(url, { accept: 'json', api: true, headers });
  if (!res.ok) {
    ctx.stat(`fetch_${res.errorKind ?? 'error'}`);
    return null;
  }
  try {
    return JSON.parse(res.body) as unknown;
  } catch {
    ctx.stat('invalid_json');
    return null;
  }
}

export const discoveryAgent: AgentDefinition = {
  name: 'discovery',
  description: 'Collects candidate AI tools from Show HN (Algolia API) and GitHub search into tool_candidates; publishes nothing.',
  schedule: 'daily:02:40',
  autonomy: 'auto',
  maxItems: 100,
  timeoutMs: 5 * 60_000,
  async run(ctx) {
    const now = ctx.now();
    const since = Math.floor(now.getTime() / 1000) - 7 * 86_400;
    const found: Candidate[] = [];
    const hn = await fetchJson(ctx, `https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=created_at_i>${since},points>=20&hitsPerPage=100`);
    if (hn) found.push(...parseHn(hn));
    const created = new Date(now.getTime() - 60 * 86_400_000).toISOString().slice(0, 10);
    const gh: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    const token = env().GITHUB_TOKEN;
    if (token) gh.Authorization = `Bearer ${token}`;
    for (const topic of ['generative-ai', 'llm', 'ai-agents']) {
      const q = encodeURIComponent(`topic:${topic} created:>${created} stars:>=300`);
      const json = await fetchJson(ctx, `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`, gh);
      if (json) found.push(...parseGithub(json, 300));
    }
    if (!found.length) return { status: hn ? 'success' : 'partial', summary: 'no new candidates found' };

    // Known tools (by website domain) are not candidates.
    const known = new Set((await ctx.db.select({ url: tools.websiteUrl }).from(tools)).map((t) => sourceDomain(t.url)));
    const unique = new Map<string, Candidate>();
    for (const c of found) if (!known.has(c.domain) && !unique.has(c.domain)) unique.set(c.domain, c);
    let upserted = 0;
    for (const c of [...unique.values()].slice(0, ctx.limits.maxItems)) {
      await ctx.db
        .insert(toolCandidates)
        .values({ name: c.name, url: c.url, domain: c.domain, source: c.source, sourceUrl: c.sourceUrl, signals: c.signals, lastSeenAt: now })
        .onConflictDoUpdate({
          target: toolCandidates.domain,
          set: {
            lastSeenAt: now,
            signals: sql`${toolCandidates.signals} || ${JSON.stringify(c.signals)}::jsonb`,
            // Unreviewed candidates expire after 30 days and are re-assessed when they show up again later.
            status: sql`CASE WHEN ${toolCandidates.status} = 'rejected' AND ${toolCandidates.notes} = 'expired_unreviewed'
                              AND ${toolCandidates.lastSeenAt} < ${now.toISOString()}::timestamptz - interval '30 days'
                             THEN 'new' ELSE ${toolCandidates.status} END`,
          },
        });
      upserted++;
    }
    ctx.stat('found', found.length);
    ctx.stat('candidates', upserted);
    ctx.stat('known_skipped', found.length - unique.size);
    return { status: 'success', summary: `${upserted} candidates recorded (${found.length} signals)` };
  },
};
