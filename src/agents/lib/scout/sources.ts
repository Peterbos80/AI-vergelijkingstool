/**
 * Tool scout sources (docs/DATA_SOURCES.md, "Tool scout"): parsers for the
 * documented APIs (Hacker News via Algolia, GitHub search, Product Hunt) and
 * for makers' own news feeds. Everything external is untrusted input: it is
 * validated with zod and length limits, and only names, URLs, counts and
 * dates are kept. Never descriptions, article text or people's user names
 * (GitHub repositories of persons are skipped; HN and Product Hunt authors
 * are never read).
 */
import { z } from 'zod';
import { sourceDomain } from '@/lib/provenance/confidence';
import { htmlToText } from '../../fetcher/text';

export type CandidateSource = 'hackernews' | 'github' | 'producthunt' | 'rss';

/** Signals as stored in `tool_candidates.signals` (flat keys; the latest observation per source). */
export interface CandidateSignals {
  hnId?: string;
  hnPoints?: number;
  hnComments?: number;
  /** Unix seconds. */
  hnAt?: number;
  githubRepo?: string;
  githubStars?: number;
  githubCreated?: string;
  /** SPDX id from the GitHub API, or null when the repository has no recognised license. */
  githubLicense?: string | null;
  phId?: string;
  phVotes?: number;
  phAt?: string;
  phUrl?: string;
  /** A launch post on the maker's own site or in a maker's feed (data/discovery/sources.json). */
  announcementUrl?: string;
  announcementAt?: string;
  /** Feed id, or "own-site" for the tool's own feed. */
  announcementFeed?: string;
}

export interface Candidate {
  name: string;
  url: string;
  domain: string;
  source: CandidateSource;
  sourceUrl: string;
  signals: CandidateSignals;
}

/** Domains that host many products; a candidate there is keyed by its path. */
export const PLATFORM_DOMAINS = new Set([
  'github.com',
  'gitlab.com',
  'huggingface.co',
  'vercel.app',
  'netlify.app',
  'notion.site',
  'pages.dev',
  'replit.app',
  'streamlit.app',
  'labs.google',
]);

/** Never candidates: social networks, stores, link shorteners, big platforms. */
export const IGNORED_DOMAINS = new Set([
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'news.ycombinator.com',
  'ycombinator.com',
  'bit.ly',
  't.co',
  'arxiv.org',
  'wikipedia.org',
  'google.com',
  'apple.com',
  'microsoft.com',
  'amazon.com',
  'discord.com',
  'discord.gg',
  // Personal pages and blogs (a user name is personal data; a blog is not a product).
  'github.io',
  'gitlab.io',
  'medium.com',
  'substack.com',
]);

/** News outlets: a story there is about a product, it is not the product. */
export const MEDIA_DOMAINS = new Set([
  'theverge.com',
  'techcrunch.com',
  'technologyreview.com',
  'theguardian.com',
  'bbc.com',
  'bbc.co.uk',
  'cnbc.com',
  'nos.nl',
  'nu.nl',
  'tweakers.net',
  'nytimes.com',
  'bloomberg.com',
  'reuters.com',
  'ft.com',
  'wsj.com',
  'arstechnica.com',
  'wired.com',
  'venturebeat.com',
  'zdnet.com',
  'engadget.com',
  'businessinsider.com',
  'axios.com',
  'theinformation.com',
  'forbes.com',
  'cnn.com',
  'washingtonpost.com',
  'economist.com',
  'theregister.com',
  'fortune.com',
  'time.com',
  'apnews.com',
  'npr.org',
  'vox.com',
  'theatlantic.com',
  'newyorker.com',
  '404media.co',
  'semafor.com',
  'simonwillison.net',
]);

/**
 * Other AI-tool directories and review sites. Never fetched, never a
 * candidate: their selection is their work (brief §30).
 */
export const DIRECTORY_DOMAINS = new Set([
  'theresanaiforthat.com',
  'futurepedia.io',
  'toolify.ai',
  'futuretools.io',
  'topai.tools',
  'aitools.fyi',
  'aitoolsdirectory.com',
  'insidr.ai',
  'aitoptools.com',
  'easywithai.com',
  'aitoolhunt.com',
  'alternativeto.net',
  'g2.com',
  'capterra.com',
  'saasworthy.com',
  'producthunt.com',
]);

export const AI_TERMS = /\b(ai|a\.i\.|gpt|llm|llms|genai|generative|agent|agents|agentic|copilot|chatbot|machine learning|ml|diffusion|transformer|voice clone|text[- ]to[- ](speech|image|video))\b/i;

function isExcluded(domain: string): boolean {
  const base = domain.split('/')[0] ?? domain;
  return IGNORED_DOMAINS.has(base) || MEDIA_DOMAINS.has(base) || DIRECTORY_DOMAINS.has(base);
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
  if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) return null;
  const domain = sourceDomain(u.toString());
  if (isExcluded(domain)) return null;
  if (PLATFORM_DOMAINS.has(domain) || [...PLATFORM_DOMAINS].some((p) => u.hostname.endsWith(`.${p}`))) {
    const parts = u.pathname.split('/').filter(Boolean).slice(0, 2);
    // Sub-domain platforms (foo.vercel.app): the host is the product.
    if (u.hostname !== domain && u.hostname !== `www.${domain}`) return { url: `https://${u.hostname}/`, domain: u.hostname };
    if (parts.length < 2) return null;
    return { url: `https://${u.hostname}/${parts.join('/')}`, domain: `${domain}/${parts.join('/').toLowerCase()}` };
  }
  return { url: `${u.protocol}//${u.hostname}/`, domain };
}

/** Is the candidate on a domain of its own (not a page on a platform)? */
export function ownDomain(domain: string): boolean {
  return !domain.includes('/') && !PLATFORM_DOMAINS.has(domain) && ![...PLATFORM_DOMAINS].some((p) => domain.endsWith(`.${p}`));
}

/** A product name: plain text, 1–5 words, ≤ 60 characters, not a sentence ("I built …"). */
export function cleanName(raw: string): string | null {
  const s = raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f<>{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“‘]+|["'”’.,;:!?]+$/g, '')
    .trim();
  if (!s || s.length > 60 || !/[\p{L}\p{N}]/u.test(s)) return null;
  const words = s.split(' ');
  if (words.length > 5) return null;
  if (/^(i|i'm|we|we're|my|our|how|why|what|when|ask|tell|show|this|these)\b/i.test(s)) return null;
  return s;
}

/** "Show HN: Foo – an AI thing" → "Foo"; "Launch HN: Bar (YC W26) – …" → "Bar". */
export function nameFromTitle(title: string): string {
  const t = title.replace(/^(show|launch) hn:\s*/i, '').trim();
  const cut = t.split(/\s[–—-]\s|:\s|,\s|\s\(/)[0] ?? t;
  return cut.slice(0, 80).trim();
}

/* ───────────── Hacker News (Algolia API) ───────────── */

const HnHit = z.object({
  objectID: z.string().regex(/^\d{1,12}$/),
  title: z.string().max(400).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  points: z.number().int().min(0).max(1_000_000).nullable().optional(),
  num_comments: z.number().int().min(0).max(1_000_000).nullable().optional(),
  created_at_i: z.number().int().positive(),
});
const HnResponse = z.object({ hits: z.array(z.unknown()).max(1000) });

/**
 * Show HN posts (kind "show") about AI, or other stories (kind "story") that
 * launch an AI product ("Launch HN: Foo", "Introducing Foo", "Foo is now
 * available") and link to the product itself (not to a news outlet, a
 * directory or a page on a platform).
 */
export function parseHn(json: unknown, kind: 'show' | 'story' = 'show', minPoints = 0): Candidate[] {
  const parsed = HnResponse.safeParse(json);
  if (!parsed.success) return [];
  const out: Candidate[] = [];
  for (const raw of parsed.data.hits) {
    const h = HnHit.safeParse(raw);
    if (!h.success || !h.data.url || !h.data.title) continue;
    const title = h.data.title;
    if ((h.data.points ?? 0) < minPoints) continue;
    if (!AI_TERMS.test(title)) continue;
    if (kind === 'story' && /^(show|ask|tell) hn:/i.test(title)) continue;
    const key = candidateKey(h.data.url);
    // A page on a platform (github.com/<owner>/<repo>): the owner may be a person, so it is not kept.
    if (!key || key.domain.includes('/')) continue;
    // Stories only when they are a launch with a clear product name ("Launch HN: Foo", "Introducing Foo").
    const name = kind === 'show' || /^launch hn:/i.test(title) ? cleanName(nameFromTitle(title)) : launchName(title);
    if (!name) continue;
    out.push({
      name,
      url: key.url,
      domain: key.domain,
      source: 'hackernews',
      sourceUrl: `https://news.ycombinator.com/item?id=${h.data.objectID}`,
      signals: { hnId: h.data.objectID, hnPoints: h.data.points ?? 0, hnComments: h.data.num_comments ?? 0, hnAt: h.data.created_at_i },
    });
  }
  return out;
}

/** HN stories whose URL is a known launch post: their points belong to that launch's candidate. */
export function hnStoriesByUrl(json: unknown): Map<string, CandidateSignals> {
  const out = new Map<string, CandidateSignals>();
  const parsed = HnResponse.safeParse(json);
  if (!parsed.success) return out;
  for (const raw of parsed.data.hits) {
    const h = HnHit.safeParse(raw);
    if (!h.success || !h.data.url) continue;
    const url = canonicalPostUrl(h.data.url);
    if (!url) continue;
    const prev = out.get(url);
    if (prev && (prev.hnPoints ?? 0) >= (h.data.points ?? 0)) continue;
    out.set(url, { hnId: h.data.objectID, hnPoints: h.data.points ?? 0, hnComments: h.data.num_comments ?? 0, hnAt: h.data.created_at_i });
  }
  return out;
}

/** A post URL without tracking parameters, fragment or trailing slash (for joining). */
export function canonicalPostUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  u.protocol = 'https:';
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$|mc_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
  const s = u.toString();
  return s.endsWith('/') && u.pathname !== '/' ? s.slice(0, -1) : s;
}

/* ───────────── GitHub search API ───────────── */

const GhRepo = z.object({
  full_name: z.string().max(200),
  name: z.string().max(200),
  html_url: z.string().url().max(500),
  homepage: z.string().max(2000).nullable().optional(),
  stargazers_count: z.number().int().min(0).max(100_000_000),
  archived: z.boolean().optional(),
  fork: z.boolean().optional(),
  created_at: z.string().max(40),
  owner: z.object({ type: z.string().max(40) }).optional(),
  license: z.object({ spdx_id: z.string().max(60).nullable().optional() }).nullable().optional(),
});
const GhResponse = z.object({ items: z.array(z.unknown()).max(1000) });

/**
 * New repositories of organisations (never of persons: their user name is
 * personal data). The product homepage is preferred over the repository.
 */
export function parseGithub(json: unknown, minStars: number): Candidate[] {
  const parsed = GhResponse.safeParse(json);
  if (!parsed.success) return [];
  const out: Candidate[] = [];
  for (const raw of parsed.data.items) {
    const r = GhRepo.safeParse(raw);
    if (!r.success || r.data.archived || r.data.fork || r.data.stargazers_count < minStars) continue;
    if (r.data.owner?.type !== 'Organization') continue;
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(r.data.html_url)) continue;
    const home = r.data.homepage && /^https?:\/\//i.test(r.data.homepage) ? candidateKey(r.data.homepage) : null;
    const key = home ?? candidateKey(r.data.html_url);
    const name = cleanName(r.data.name);
    if (!key || !name) continue;
    const spdx = r.data.license?.spdx_id ?? null;
    out.push({
      name,
      url: key.url,
      domain: key.domain,
      source: 'github',
      sourceUrl: r.data.html_url,
      signals: {
        githubStars: r.data.stargazers_count,
        githubRepo: r.data.full_name,
        githubCreated: r.data.created_at,
        githubLicense: spdx && spdx !== 'NOASSERTION' ? spdx : null,
      },
    });
  }
  return out;
}

/* ───────────── Product Hunt API (GraphQL, only with PRODUCTHUNT_TOKEN) ───────────── */

export const PRODUCT_HUNT_QUERY = `query Launches($after: DateTime!) {
  posts(order: VOTES, postedAfter: $after, first: 30) {
    edges { node { id name url website votesCount createdAt topics(first: 8) { edges { node { slug } } } } }
  }
}`;

const PhNode = z.object({
  id: z.string().max(40),
  name: z.string().max(200),
  url: z.string().url().max(500),
  website: z.string().url().max(2000).nullable().optional(),
  votesCount: z.number().int().min(0).max(10_000_000),
  createdAt: z.string().max(40),
  topics: z.object({ edges: z.array(z.object({ node: z.object({ slug: z.string().max(80) }) })).max(50) }).optional(),
});
const PhResponse = z.object({ data: z.object({ posts: z.object({ edges: z.array(z.object({ node: z.unknown() })).max(100) }) }) });

export interface PhLaunch {
  name: string;
  /** Product Hunt's link to the product (a redirect on producthunt.com, resolved by the fetcher). */
  website: string;
  signals: CandidateSignals;
}

/** AI launches (topic "artificial-intelligence") with at least `minVotes` votes. */
export function parseProductHunt(json: unknown, minVotes: number): PhLaunch[] {
  const parsed = PhResponse.safeParse(json);
  if (!parsed.success) return [];
  const out: PhLaunch[] = [];
  for (const edge of parsed.data.data.posts.edges) {
    const n = PhNode.safeParse(edge.node);
    if (!n.success || !n.data.website || n.data.votesCount < minVotes) continue;
    if (!/^https:\/\/www\.producthunt\.com\/(posts|products)\//.test(n.data.url)) continue;
    const topics = n.data.topics?.edges.map((e) => e.node.slug) ?? [];
    if (!topics.includes('artificial-intelligence')) continue;
    const name = cleanName(n.data.name);
    if (!name) continue;
    out.push({ name, website: n.data.website, signals: { phId: n.data.id, phVotes: n.data.votesCount, phAt: n.data.createdAt, phUrl: n.data.url } });
  }
  return out;
}

/* ───────────── Makers' own feeds ───────────── */

/**
 * The product name of a launch title ("Introducing Foo", "Meet Foo, …",
 * "Foo is now available"), or null when the title is not a launch.
 */
export function launchName(title: string): string | null {
  const t = title.replace(/\s+/g, ' ').trim();
  const lead = /^(?:introducing|announcing|meet|launching|unveiling|say hello to)\s+(.+)$/i.exec(t);
  if (lead) return cleanName((lead[1]!.split(/:\s|\s[–—-]\s|,\s|\s\(|\.\s/)[0] ?? '').replace(/^(?:the new|the|our new|our|a new|a|an|new)\s+/i, '').trim());
  const tail = /^(.+?)\s+(?:is now (?:generally )?available|is now live|is here|now available)\b/i.exec(t);
  if (tail) return cleanName(tail[1]!.replace(/^(?:the new|new)\s+/i, ''));
  return null;
}

/** Feed items that are launches, newest first. */
export function launchesIn(items: { title: string; link: string | null; id: string; date: Date | null }[], since: Date): { name: string; postUrl: string; at: Date }[] {
  const out: { name: string; postUrl: string; at: Date }[] = [];
  for (const i of items) {
    if (!i.date || i.date < since) continue;
    const name = launchName(i.title);
    const link = i.link ?? (/^https:\/\//.test(i.id) ? i.id : null);
    const postUrl = link ? canonicalPostUrl(link) : null;
    if (!name || !postUrl) continue;
    out.push({ name, postUrl, at: i.date });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

const squash = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const CALL_TO_ACTION = /\b(try|get started|sign up|download|visit|start|open|join|install|available (at|on))\b/i;

/**
 * The product a launch post links to: links whose text or address carries
 * the product name, on another host than the post. Null when there is none
 * or when two domains tie (ambiguous).
 */
export function productLinkFromPost(html: string, postUrl: string, name: string): { url: string; domain: string } | null {
  let postHost: string;
  try {
    postHost = new URL(postUrl).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  const want = squash(name);
  if (want.length < 2) return null;
  const scores = new Map<string, { score: number; key: { url: string; domain: string } }>();
  for (const l of htmlToText(html.slice(0, 1_000_000), postUrl).links) {
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, '') === postHost) continue;
    const key = candidateKey(u.toString());
    if (!key || key.domain.includes('/')) continue;
    const hit = squash(l.text).includes(want) || squash(`${u.hostname}${u.pathname}`).includes(want);
    if (!hit) continue;
    const score = 2 + (CALL_TO_ACTION.test(l.text) ? 1 : 0);
    const prev = scores.get(key.domain);
    scores.set(key.domain, { score: (prev?.score ?? 0) + score, key: prev?.key ?? key });
  }
  const ranked = [...scores.values()].sort((a, b) => b.score - a.score);
  if (!ranked.length || (ranked[1] && ranked[1].score === ranked[0]!.score)) return null;
  return ranked[0]!.key;
}

/** RSS/Atom feeds a page announces on its own registrable domain (`<link rel="alternate">`). */
export function feedLinks(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const re = /<link\b[^>]*>/gi;
  for (const tag of html.slice(0, 200_000).match(re) ?? []) {
    if (!/rel=["']?alternate/i.test(tag) || !/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = /href=["']([^"']{1,500})["']/i.exec(tag)?.[1];
    if (!href) continue;
    try {
      const u = new URL(href.replace(/&amp;/g, '&'), baseUrl);
      if (u.protocol === 'https:' && sourceDomain(u.toString()) === sourceDomain(baseUrl)) out.push(u.toString());
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)].slice(0, 2);
}

/* ───────────── Merging ───────────── */

/** Combine signals of one candidate: per source, the observation with the higher count wins. */
export function mergeSignals(base: Record<string, unknown>, add: CandidateSignals): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : -1);
  if (add.hnPoints !== undefined && add.hnPoints >= num(base.hnPoints)) Object.assign(out, pick(add, ['hnId', 'hnPoints', 'hnComments', 'hnAt']));
  if (add.githubStars !== undefined && add.githubStars >= num(base.githubStars)) Object.assign(out, pick(add, ['githubRepo', 'githubStars', 'githubCreated', 'githubLicense']));
  if (add.phVotes !== undefined && add.phVotes >= num(base.phVotes)) Object.assign(out, pick(add, ['phId', 'phVotes', 'phAt', 'phUrl']));
  if (add.announcementUrl && !base.announcementUrl) Object.assign(out, pick(add, ['announcementUrl', 'announcementAt', 'announcementFeed']));
  return out;
}

function pick(s: CandidateSignals, keys: (keyof CandidateSignals)[]): Partial<CandidateSignals> {
  const out: Partial<CandidateSignals> = {};
  for (const k of keys) if (s[k] !== undefined) (out as Record<string, unknown>)[k] = s[k];
  return out;
}
