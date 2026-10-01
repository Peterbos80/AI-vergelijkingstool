/**
 * Discovery agent (the tool scout's eyes; docs/strategy/08 §3, 12 §3.1 and
 * §4.4, docs/DATA_SOURCES.md "Tool scout"). Every hour it looks for popular
 * new AI tools in allowed, documented sources and records them as candidates
 * in `tool_candidates`. It publishes nothing; verification and the daily
 * new-tools agent decide.
 *
 *  - Hacker News (Algolia API): Show HN posts about AI, and stories that
 *    announce an AI product ("Launch HN", "introducing", "open-sources", …);
 *  - GitHub search API: new repositories of organisations with AI topics and
 *    fast-growing stars (GITHUB_TOKEN raises the rate limit);
 *  - makers' own news feeds (data/discovery/sources.json): launch posts and
 *    the product they link to, read through the robots-aware fetcher;
 *  - Product Hunt API: only with PRODUCTHUNT_TOKEN, else skipped and named.
 *
 * Window: everything since the previous successful run, plus 48 hours so a
 * post's points can grow (7 days on the first run). Duplicates are merged per
 * candidate domain; per source the highest count wins. Never stored: texts,
 * descriptions, or people's user names.
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { toolCandidates, tools } from '@/lib/db/schema';
import { queryRows } from '@/lib/db/sql';
import { env } from '@/lib/env';
import { sourceDomain } from '@/lib/provenance/confidence';
import { COLLECT, SCOUT_CONFIG, SCOUT_LIMITS } from '../lib/scout/config';
import {
  candidateKey,
  canonicalPostUrl,
  hnStoriesByUrl,
  launchesIn,
  mergeSignals,
  parseGithub,
  parseHn,
  parseProductHunt,
  productLinkFromPost,
  PRODUCT_HUNT_QUERY,
  type Candidate,
  type CandidateSignals,
} from '../lib/scout/sources';
import { parseFeed } from './change-detection';
import type { AgentContext, AgentDefinition } from '../types';

// Re-exported for existing callers and tests.
export { candidateKey, nameFromTitle, parseGithub, parseHn, type Candidate } from '../lib/scout/sources';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const GITHUB_TOPICS = ['llm', 'generative-ai', 'ai-agents', 'ai'];

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

/** Start of the window: the previous successful run minus 48 h, at most 7 days back. */
export async function discoveryWindow(ctx: AgentContext): Promise<{ since: Date; feedsSince: Date }> {
  const now = ctx.now();
  const [row] = await queryRows<{ at: string | null }>(
    ctx.db,
    sql`SELECT max(started_at)::text AS at FROM agent_runs
        WHERE agent = 'discovery' AND status IN ('success', 'partial') AND id <> ${ctx.runId}::uuid AND started_at <= ${now.toISOString()}::timestamptz`,
  );
  const last = row?.at ? new Date(row.at) : null;
  const floor = now.getTime() - 7 * DAY;
  if (!last) return { since: new Date(floor), feedsSince: new Date(floor) };
  return {
    since: new Date(Math.max(floor, Math.min(now.getTime() - 48 * HOUR, last.getTime() - 48 * HOUR))),
    // A launch post does not grow: only posts since the previous run (2 h overlap).
    feedsSince: new Date(Math.max(floor, last.getTime() - 2 * HOUR)),
  };
}

interface SourceReport {
  hn: number;
  github: number;
  feeds: { read: number; total: number; failed: string[]; robots: string[] };
  launches: number;
  productHunt: 'skipped_no_token' | number;
}

async function hackerNews(ctx: AgentContext, since: Date, found: Candidate[], report: SourceReport): Promise<Map<string, CandidateSignals>> {
  const s = Math.floor(since.getTime() / 1000);
  const show = await fetchJson(ctx, `https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=created_at_i>${s},points>=${COLLECT.showHnPoints}&hitsPerPage=200`);
  const stories = await fetchJson(ctx, `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>${s},points>=${COLLECT.storyPoints}&hitsPerPage=300`);
  const before = found.length;
  if (show) found.push(...parseHn(show, 'show'));
  if (stories) found.push(...parseHn(stories, 'story', COLLECT.storyPoints));
  report.hn = found.length - before;
  return stories ? hnStoriesByUrl(stories) : new Map();
}

async function github(ctx: AgentContext, found: Candidate[], report: SourceReport): Promise<void> {
  const created = new Date(ctx.now().getTime() - COLLECT.githubMaxAgeDays * DAY).toISOString().slice(0, 10);
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const token = env().GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const before = found.length;
  for (const topic of GITHUB_TOPICS) {
    if (ctx.signal.aborted) break;
    const q = encodeURIComponent(`topic:${topic} created:>=${created} stars:>=${COLLECT.githubStars}`);
    const json = await fetchJson(ctx, `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`, headers);
    if (json) found.push(...parseGithub(json, COLLECT.githubStars));
  }
  report.github = found.length - before;
}

/** Launch posts in makers' own feeds, and the product each one links to. */
async function makerFeeds(ctx: AgentContext, feedsSince: Date, found: Candidate[], report: SourceReport): Promise<void> {
  report.feeds.total = SCOUT_CONFIG.officialFeeds.length;
  let budget: number = SCOUT_LIMITS.launchPostsPerRun;
  for (const feed of SCOUT_CONFIG.officialFeeds) {
    if (ctx.signal.aborted) break;
    const res = await ctx.fetcher.get(feed.url, { accept: 'xml' });
    if (!res.ok) {
      if (res.errorKind === 'robots') report.feeds.robots.push(feed.id);
      else report.feeds.failed.push(`${feed.id} (${res.errorKind === 'http' ? `http ${res.status}` : (res.errorKind ?? 'error')})`);
      continue;
    }
    let items: ReturnType<typeof parseFeed>;
    try {
      items = parseFeed(res.body.slice(0, 2_000_000));
    } catch {
      report.feeds.failed.push(`${feed.id} (invalid)`);
      continue;
    }
    report.feeds.read++;
    for (const launch of launchesIn(items.slice(0, 50), feedsSince)) {
      if (budget <= 0 || ctx.signal.aborted) break;
      // Only posts on the maker's own site.
      if (sourceDomain(launch.postUrl) !== sourceDomain(feed.homepage)) continue;
      budget--;
      const post = await ctx.fetcher.get(launch.postUrl, { accept: 'html' });
      if (!post.ok) {
        ctx.stat(`launch_post_${post.errorKind ?? 'error'}`);
        continue;
      }
      const product = productLinkFromPost(post.body, launch.postUrl, launch.name);
      if (!product) {
        ctx.stat('launch_without_product_link');
        continue;
      }
      report.launches++;
      found.push({
        name: launch.name,
        url: product.url,
        domain: product.domain,
        source: 'rss',
        sourceUrl: launch.postUrl,
        signals: { announcementUrl: launch.postUrl, announcementAt: launch.at.toISOString(), announcementFeed: feed.id },
      });
    }
  }
}

/** Product Hunt launches (API terms: attribution, rate limits; commercial use needs their permission). */
async function productHunt(ctx: AgentContext, since: Date, found: Candidate[], report: SourceReport): Promise<void> {
  const token = env().PRODUCTHUNT_TOKEN;
  if (!token || !ctx.fetcher.post) {
    report.productHunt = 'skipped_no_token';
    return;
  }
  const res = await ctx.fetcher.post(
    'https://api.producthunt.com/v2/api/graphql',
    JSON.stringify({ query: PRODUCT_HUNT_QUERY, variables: { after: since.toISOString() } }),
    { accept: 'json', api: true, headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    ctx.stat(`producthunt_${res.errorKind ?? 'error'}`);
    report.productHunt = 0;
    return;
  }
  let json: unknown;
  try {
    json = JSON.parse(res.body) as unknown;
  } catch {
    ctx.stat('invalid_json');
    report.productHunt = 0;
    return;
  }
  let n = 0;
  for (const launch of parseProductHunt(json, COLLECT.phVotes).slice(0, SCOUT_LIMITS.productHuntPerRun)) {
    if (ctx.signal.aborted) break;
    // Product Hunt links through its own redirect; robots.txt decides whether we may follow it.
    const hop = await ctx.fetcher.get(launch.website, { accept: 'any', light: true });
    const key = hop.ok ? candidateKey(hop.finalUrl) : null;
    if (!key || key.domain.includes('/')) {
      ctx.stat(hop.ok ? 'producthunt_no_product_site' : `producthunt_link_${hop.errorKind ?? 'error'}`);
      continue;
    }
    found.push({ name: launch.name, url: key.url, domain: key.domain, source: 'producthunt', sourceUrl: launch.signals.phUrl!, signals: launch.signals });
    n++;
  }
  report.productHunt = n;
}

export const discoveryAgent: AgentDefinition = {
  name: 'discovery',
  description:
    'Every hour: candidate AI tools from Show HN and launch stories (HN Algolia API), new GitHub repositories of organisations, makers’ own news feeds and Product Hunt (only with PRODUCTHUNT_TOKEN) into tool_candidates; publishes nothing.',
  schedule: 'every:1h',
  autonomy: 'auto',
  maxItems: 100,
  timeoutMs: 6 * 60_000,
  async run(ctx) {
    const now = ctx.now();
    const { since, feedsSince } = await discoveryWindow(ctx);
    const found: Candidate[] = [];
    const report: SourceReport = { hn: 0, github: 0, feeds: { read: 0, total: 0, failed: [], robots: [] }, launches: 0, productHunt: 0 };
    const storyPoints = await hackerNews(ctx, since, found, report);
    await github(ctx, found, report);
    await makerFeeds(ctx, feedsSince, found, report);
    await productHunt(ctx, since, found, report);

    // Never candidates: known tools (by website), domains the owner blocked, and makers' news sites
    // (a story about a launch post counts for the launched product, joined below).
    const known = new Set((await ctx.db.select({ url: tools.websiteUrl }).from(tools)).map((t) => candidateKey(t.url)?.domain ?? sourceDomain(t.url)));
    const blocked = new Set(SCOUT_CONFIG.blockedDomains);
    const makerSites = new Set(SCOUT_CONFIG.officialFeeds.map((f) => sourceDomain(f.homepage)));
    const unique = new Map<string, Candidate>();
    for (const c of found) {
      if (known.has(c.domain) || blocked.has(c.domain.split('/')[0]!) || (c.source === 'hackernews' && makerSites.has(c.domain))) {
        ctx.stat('known_or_blocked_skipped');
        continue;
      }
      const prev = unique.get(c.domain);
      unique.set(c.domain, prev ? { ...prev, signals: mergeSignals(prev.signals as Record<string, unknown>, c.signals) as CandidateSignals } : c);
    }

    // A Hacker News story about a launch post counts for the launched product.
    const announced = await ctx.db
      .select({ domain: toolCandidates.domain, url: sql<string>`${toolCandidates.signals}->>'announcementUrl'` })
      .from(toolCandidates)
      .where(and(sql`${toolCandidates.signals} ? 'announcementUrl'`, ne(toolCandidates.status, 'duplicate')));
    const byPost = new Map<string, string>();
    for (const a of announced) if (a.url) byPost.set(canonicalPostUrl(a.url) ?? a.url, a.domain);
    for (const c of unique.values()) if (c.signals.announcementUrl) byPost.set(c.signals.announcementUrl, c.domain);
    const joined = new Map<string, CandidateSignals>();
    for (const [url, hn] of storyPoints) {
      const domain = byPost.get(url);
      if (domain) joined.set(domain, hn);
    }

    const domains = [...new Set([...unique.keys(), ...joined.keys()])].slice(0, ctx.limits.maxItems);
    if (!domains.length) return { status: 'success', summary: summarize(report, 0, 0) };
    const existing = new Map((await ctx.db.select().from(toolCandidates).where(inArray(toolCandidates.domain, domains))).map((r) => [r.domain, r]));
    let created = 0;
    let updated = 0;
    for (const domain of domains) {
      const c = unique.get(domain);
      const row = existing.get(domain);
      const hn = joined.get(domain);
      let signals: Record<string, unknown> = { ...(row?.signals ?? {}) };
      if (c) signals = mergeSignals(signals, c.signals);
      if (hn) signals = mergeSignals(signals, hn);
      if (row) {
        await ctx.db
          .update(toolCandidates)
          .set({
            lastSeenAt: now,
            signals,
            // Unreviewed or unpublished candidates expire after 30 days and are re-assessed when they show up again later.
            status: sql`CASE WHEN ${toolCandidates.status} = 'rejected' AND ${toolCandidates.notes} IN ('expired_unreviewed', 'expired_unpublished')
                              AND ${toolCandidates.lastSeenAt} < ${now.toISOString()}::timestamptz - interval '30 days'
                             THEN 'new' ELSE ${toolCandidates.status} END`,
          })
          .where(eq(toolCandidates.id, row.id));
        updated++;
      } else if (c) {
        await ctx.db
          .insert(toolCandidates)
          .values({ name: c.name, url: c.url, domain: c.domain, source: c.source, sourceUrl: c.sourceUrl, signals, firstSeenAt: now, lastSeenAt: now })
          .onConflictDoNothing({ target: toolCandidates.domain });
        created++;
      }
    }
    ctx.stat('signals', found.length);
    ctx.stat('candidates_new', created);
    ctx.stat('candidates_updated', updated);
    const sourcesFailed = report.feeds.failed.length > 0 || (report.hn === 0 && report.github === 0 && report.feeds.read === 0);
    return { status: sourcesFailed ? 'partial' : 'success', summary: summarize(report, created, updated) };
  },
};

function summarize(r: SourceReport, created: number, updated: number): string {
  return [
    `HN ${r.hn} · GitHub ${r.github} · maker feeds ${r.feeds.read}/${r.feeds.total} (${r.launches} launches)`,
    r.productHunt === 'skipped_no_token' ? 'Product Hunt skipped (no PRODUCTHUNT_TOKEN)' : `Product Hunt ${r.productHunt}`,
    `${created} new candidates · ${updated} updated`,
    ...(r.feeds.robots.length ? [`skipped, robots.txt disallows: ${r.feeds.robots.join(', ')}`] : []),
    ...(r.feeds.failed.length ? [`failed: ${r.feeds.failed.join(', ')}`] : []),
  ].join(' · ');
}

