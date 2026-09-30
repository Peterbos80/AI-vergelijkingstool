/**
 * Social agent: public, documented signals only (docs/strategy/12 §12: no
 * Reddit/X/LinkedIn scraping, no Google Trends).
 *  - GitHub (tools with a repository): stars/forks as time series; new
 *    stable releases become "release" events (factual, linked, reversible);
 *  - Hacker News (Algolia API): stories mentioning the tool in the last
 *    7 days; a clear spike becomes a low-significance "buzz" event.
 * Signals inform freshness and Pulse only — never rankings.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { changeEvents, socialSignals, tools } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { isGithubRepo } from '@/lib/validate';
import { eventText } from '../lib/event-text';
import type { AgentContext, AgentDefinition } from '../types';

const Repo = z.object({ stargazers_count: z.number().int(), forks_count: z.number().int(), archived: z.boolean().optional(), pushed_at: z.string().nullable().optional() });
const Release = z.object({ id: z.number(), tag_name: z.string().max(100), name: z.string().max(200).nullable().optional(), html_url: z.string().url(), draft: z.boolean(), prerelease: z.boolean(), published_at: z.string().nullable() });
const HnSearch = z.object({ nbHits: z.number().int(), hits: z.array(z.object({ title: z.string().nullable().optional() }).passthrough()) });

export const BUZZ_MIN_MENTIONS = 5;
export const BUZZ_FACTOR = 3;

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const token = env().GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function getJson(ctx: AgentContext, url: string, headers?: Record<string, string>): Promise<unknown | null> {
  const res = await ctx.fetcher.get(url, { accept: 'json', api: true, headers });
  if (!res.ok) {
    ctx.stat(`fetch_${res.errorKind ?? 'error'}`);
    return null;
  }
  try {
    return JSON.parse(res.body) as unknown;
  } catch {
    return null;
  }
}

/** Whole-word, case-insensitive mention of a tool name in a title. */
export function mentions(title: string, name: string): boolean {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}([^\\p{L}\\p{N}]|$)`, 'iu').test(title);
}

export const socialAgent: AgentDefinition = {
  name: 'social',
  description: 'GitHub stars/releases and Hacker News mentions for published tools (public APIs only).',
  schedule: 'every:6h',
  autonomy: 'auto',
  maxItems: 30,
  timeoutMs: 8 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const due = await db
      .select()
      .from(tools)
      .where(and(eq(tools.published, true), sql`(${tools.socialCheckedAt} IS NULL OR ${tools.socialCheckedAt} < ${new Date(now.getTime() - 20 * 3600_000).toISOString()}::timestamptz)`))
      .orderBy(asc(sql`${tools.socialCheckedAt} NULLS FIRST`))
      .limit(ctx.limits.maxItems);
    let events = 0;
    for (const tool of due) {
      if (ctx.signal.aborted) break;
      // GitHub repository metrics and releases.
      if (isGithubRepo(tool.githubRepo)) {
        const repo = Repo.safeParse(await getJson(ctx, `https://api.github.com/repos/${tool.githubRepo}`, ghHeaders()));
        if (repo.success) {
          await db.insert(socialSignals).values([
            { toolId: tool.id, provider: 'github', metric: 'stars', value: repo.data.stargazers_count, observedAt: now, url: `https://github.com/${tool.githubRepo}` },
            { toolId: tool.id, provider: 'github', metric: 'forks', value: repo.data.forks_count, observedAt: now, url: `https://github.com/${tool.githubRepo}` },
          ]);
          ctx.stat('github_repos');
        }
        const releases = z.array(z.unknown()).safeParse(await getJson(ctx, `https://api.github.com/repos/${tool.githubRepo}/releases?per_page=5`, ghHeaders()));
        for (const raw of releases.success ? releases.data : []) {
          const r = Release.safeParse(raw);
          if (!r.success || r.data.draft || r.data.prerelease || !r.data.published_at) continue;
          const published = new Date(r.data.published_at);
          if (now.getTime() - published.getTime() > 14 * 86_400_000) continue;
          const [ev] = await db
            .insert(changeEvents)
            .values({
              toolId: tool.id,
              kind: 'release',
              title: eventText('release', { version: r.data.tag_name }),
              sourceUrl: r.data.html_url,
              sourceType: 'github',
              occurredAt: published,
              detectedAt: now,
              detectedBy: 'agent:social',
              confidence: 95,
              significance: 30,
              dedupeKey: `release:${tool.githubRepo}:${r.data.id}`,
            })
            .onConflictDoNothing({ target: changeEvents.dedupeKey })
            .returning({ id: changeEvents.id });
          if (ev) {
            await ctx.log.action({ action: 'event_published', entityType: 'change_event', entityId: ev.id, toolId: tool.id, sourceUrl: r.data.html_url, confidence: 95, decision: 'auto_published', reason: 'github_release' });
            events++;
          }
        }
      }
      // Hacker News stories mentioning the tool in the last 7 days.
      const since = Math.floor(now.getTime() / 1000) - 7 * 86_400;
      const hn = HnSearch.safeParse(
        await getJson(ctx, `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(`"${tool.name}"`)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=50`),
      );
      if (hn.success) {
        const count = hn.data.hits.filter((h) => h.title && mentions(h.title, tool.name)).length;
        const history = await db
          .select({ value: socialSignals.value })
          .from(socialSignals)
          .where(and(eq(socialSignals.toolId, tool.id), eq(socialSignals.provider, 'hackernews'), eq(socialSignals.metric, 'mentions_7d')))
          .orderBy(desc(socialSignals.observedAt))
          .limit(28);
        const baseline = history.length >= 8 ? history.reduce((s, h) => s + h.value, 0) / history.length : null;
        const searchUrl = `https://hn.algolia.com/?dateRange=pastWeek&query=${encodeURIComponent(tool.name)}&type=story`;
        await db.insert(socialSignals).values({ toolId: tool.id, provider: 'hackernews', metric: 'mentions_7d', value: count, observedAt: now, url: searchUrl });
        if (baseline !== null && count >= BUZZ_MIN_MENTIONS && count >= BUZZ_FACTOR * Math.max(1, baseline)) {
          const [ev] = await db
            .insert(changeEvents)
            .values({
              toolId: tool.id,
              kind: 'buzz',
              title: eventText('buzz', { count }),
              sourceUrl: searchUrl,
              sourceType: 'community',
              occurredAt: now,
              detectedAt: now,
              detectedBy: 'agent:social',
              confidence: 90,
              significance: 20,
              dedupeKey: `buzz:${tool.id}:${now.toISOString().slice(0, 10)}`,
            })
            .onConflictDoNothing({ target: changeEvents.dedupeKey })
            .returning({ id: changeEvents.id });
          if (ev) {
            await ctx.log.action({ action: 'event_published', entityType: 'change_event', entityId: ev.id, toolId: tool.id, sourceUrl: searchUrl, confidence: 90, decision: 'auto_published', reason: `hn_mentions ${count} vs baseline ${baseline.toFixed(1)}` });
            events++;
          }
        }
        ctx.stat('hn_checked');
      }
      await db.update(tools).set({ socialCheckedAt: now }).where(eq(tools.id, tool.id));
    }
    ctx.stat('events', events);
    return { status: 'success', summary: `${due.length} tools · ${events} events`, dataChanged: events > 0 };
  },
};
