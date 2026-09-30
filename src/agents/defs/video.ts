/**
 * Video agent: official and third-party videos per tool.
 *  - official channel uploads via the public channel RSS feed (no key);
 *  - optional YouTube Data API search (YOUTUBE_API_KEY) for tutorials, reviews
 *    and comparisons that name the tool; auto-added only above a relevance
 *    bar, flagged and reversible;
 *  - API data is refreshed (or removed) within 30 days, per the YouTube API
 *    Services policies; removed/private videos are taken down automatically.
 * Videos are embedded via a click-to-load, privacy-enhanced facade.
 */
import { and, asc, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { tools, videos } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { mentions } from './social';
import type { AgentContext, AgentDefinition } from '../types';

type Kind = 'official' | 'review' | 'tutorial' | 'comparison' | 'other';

export function classify(title: string): Exclude<Kind, 'official'> {
  if (/\b(vs\.?|versus)\b/i.test(title)) return 'comparison';
  if (/\b(review|recensie|test(ed)?|honest)\b/i.test(title)) return 'review';
  if (/\b(tutorial|how to|guide|beginners?|course|walkthrough|uitleg|handleiding)\b/i.test(title)) return 'tutorial';
  return 'other';
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function parseChannelFeed(xml: string): { videoId: string; title: string; published: string | null; channelTitle: string | null; channelId: string | null }[] {
  const doc = new XMLParser({ ignoreAttributes: false }).parse(xml) as { feed?: { entry?: unknown; title?: string } };
  const entries = doc.feed?.entry ? (Array.isArray(doc.feed.entry) ? doc.feed.entry : [doc.feed.entry]) : [];
  const out = [];
  for (const e of entries as Record<string, unknown>[]) {
    const videoId = String(e['yt:videoId'] ?? '');
    if (!/^[\w-]{11}$/.test(videoId)) continue;
    out.push({
      videoId,
      title: String(e.title ?? '').slice(0, 300),
      published: typeof e.published === 'string' ? e.published : null,
      channelTitle: typeof (e.author as { name?: unknown } | undefined)?.name === 'string' ? String((e.author as { name: string }).name) : null,
      channelId: typeof e['yt:channelId'] === 'string' ? String(e['yt:channelId']) : null,
    });
  }
  return out;
}

const SearchResponse = z.object({
  items: z.array(
    z.object({
      id: z.object({ videoId: z.string().regex(/^[\w-]{11}$/) }),
      snippet: z.object({ title: z.string(), channelTitle: z.string().optional(), channelId: z.string().optional(), publishedAt: z.string().optional(), defaultAudioLanguage: z.string().optional() }),
    }),
  ),
});
const ListResponse = z.object({ items: z.array(z.object({ id: z.string(), snippet: z.object({ title: z.string() }).optional(), status: z.object({ privacyStatus: z.string(), embeddable: z.boolean().optional() }).optional() })) });

const MAX_SEARCHES_PER_RUN = 5;

async function officialUploads(ctx: AgentContext, now: Date): Promise<number> {
  const list = await ctx.db
    .select()
    .from(tools)
    .where(and(eq(tools.published, true), isNotNull(tools.youtubeChannelId)))
    .orderBy(asc(sql`${tools.videoCheckedAt} NULLS FIRST`))
    .limit(10);
  let added = 0;
  for (const t of list) {
    if (!t.youtubeChannelId || !/^UC[\w-]{22}$/.test(t.youtubeChannelId)) continue;
    const res = await ctx.fetcher.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${t.youtubeChannelId}`, { accept: 'xml' });
    if (!res.ok) {
      ctx.stat(`feed_${res.errorKind ?? 'error'}`);
      continue;
    }
    for (const v of parseChannelFeed(res.body).slice(0, 3)) {
      const [row] = await ctx.db
        .insert(videos)
        .values({
          toolId: t.id,
          videoId: v.videoId,
          title: decodeEntities(v.title),
          channelTitle: v.channelTitle,
          channelId: v.channelId ?? t.youtubeChannelId,
          kind: 'official',
          publishedAt: v.published ? new Date(v.published) : null,
          source: 'rss',
          sourceUrl: `https://www.youtube.com/channel/${t.youtubeChannelId}`,
          status: 'active',
          relevance: 0.9,
          fetchedAt: now,
          verifiedAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: videos.id });
      if (row) {
        await ctx.log.action({ action: 'video_added', entityType: 'video', entityId: row.id, toolId: t.id, sourceUrl: `https://www.youtube.com/watch?v=${v.videoId}`, decision: 'auto_published', reason: 'official_channel' });
        added++;
      }
    }
    await ctx.db.update(tools).set({ videoCheckedAt: now }).where(eq(tools.id, t.id));
  }
  return added;
}

async function apiSearch(ctx: AgentContext, key: string, now: Date): Promise<number> {
  const list = await ctx.db
    .select()
    .from(tools)
    .where(and(eq(tools.published, true), or(sql`${tools.videoCheckedAt} IS NULL`, lt(tools.videoCheckedAt, new Date(now.getTime() - 30 * 86_400_000)))))
    .orderBy(asc(sql`${tools.videoCheckedAt} NULLS FIRST`))
    .limit(MAX_SEARCHES_PER_RUN);
  let added = 0;
  const after = new Date(now.getTime() - 730 * 86_400_000).toISOString();
  for (const t of list) {
    if (ctx.signal.aborted) break;
    const q = encodeURIComponent(`${t.name} tutorial review`);
    const res = await ctx.fetcher.get(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&safeSearch=strict&videoEmbeddable=true&publishedAfter=${after}&q=${q}&key=${encodeURIComponent(key)}`,
      { accept: 'json', api: true },
    );
    ctx.stat('api_searches');
    await ctx.db.update(tools).set({ videoCheckedAt: now }).where(eq(tools.id, t.id));
    if (!res.ok) {
      ctx.stat(`api_${res.errorKind ?? 'error'}`);
      continue;
    }
    let parsed;
    try {
      parsed = SearchResponse.safeParse(JSON.parse(res.body));
    } catch {
      continue;
    }
    if (!parsed.success) continue;
    const perKind = new Map<string, number>();
    for (const item of parsed.data.items) {
      const title = decodeEntities(item.snippet.title);
      if (!mentions(title, t.name)) continue;
      const kind = classify(title);
      if (kind === 'other' || (perKind.get(kind) ?? 0) >= 2) continue;
      const published = item.snippet.publishedAt ? new Date(item.snippet.publishedAt) : null;
      const recent = published !== null && now.getTime() - published.getTime() < 365 * 86_400_000;
      const relevance = 0.5 + 0.3 + (recent ? 0.2 : 0);
      if (relevance < 0.8) continue;
      const [row] = await ctx.db
        .insert(videos)
        .values({
          toolId: t.id,
          videoId: item.id.videoId,
          title: title.slice(0, 300),
          channelTitle: item.snippet.channelTitle ?? null,
          channelId: item.snippet.channelId ?? null,
          kind,
          publishedAt: published,
          language: item.snippet.defaultAudioLanguage ?? null,
          source: 'youtube_api',
          sourceUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          status: 'active',
          relevance,
          fetchedAt: now,
          verifiedAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: videos.id });
      if (row) {
        perKind.set(kind, (perKind.get(kind) ?? 0) + 1);
        await ctx.log.action({ action: 'video_added', entityType: 'video', entityId: row.id, toolId: t.id, sourceUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`, decision: 'auto_published_flagged', reason: `${kind}, relevance ${relevance.toFixed(1)}` });
        added++;
      }
    }
  }
  return added;
}

/** YouTube API data must be refreshed or deleted within 30 days. */
async function refreshApiData(ctx: AgentContext, key: string | undefined, now: Date): Promise<{ refreshed: number; removed: number }> {
  const stale = await ctx.db
    .select()
    .from(videos)
    .where(and(eq(videos.source, 'youtube_api'), eq(videos.status, 'active'), lt(videos.fetchedAt, new Date(now.getTime() - 25 * 86_400_000))))
    .limit(50);
  if (!stale.length) return { refreshed: 0, removed: 0 };
  if (!key) {
    // Without a key the data cannot be refreshed: remove it (policy), keep the record for history.
    await ctx.db.update(videos).set({ status: 'removed' }).where(inArray(videos.id, stale.map((v) => v.id)));
    return { refreshed: 0, removed: stale.length };
  }
  const res = await ctx.fetcher.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${stale.map((v) => v.videoId).join(',')}&key=${encodeURIComponent(key)}`, { accept: 'json', api: true });
  if (!res.ok) return { refreshed: 0, removed: 0 };
  let parsed;
  try {
    parsed = ListResponse.safeParse(JSON.parse(res.body));
  } catch {
    return { refreshed: 0, removed: 0 };
  }
  if (!parsed.success) return { refreshed: 0, removed: 0 };
  const alive = new Map(parsed.data.items.filter((i) => i.status?.privacyStatus === 'public' && i.status.embeddable !== false).map((i) => [i.id, i]));
  let refreshed = 0;
  let removed = 0;
  for (const v of stale) {
    const hit = alive.get(v.videoId);
    if (hit) {
      await ctx.db.update(videos).set({ title: decodeEntities(hit.snippet?.title ?? v.title).slice(0, 300), fetchedAt: now, verifiedAt: now }).where(eq(videos.id, v.id));
      refreshed++;
    } else {
      await ctx.db.update(videos).set({ status: 'removed' }).where(eq(videos.id, v.id));
      removed++;
    }
  }
  return { refreshed, removed };
}

/** Editorial and RSS videos: monthly availability check via the public oEmbed endpoint. */
async function checkAvailability(ctx: AgentContext, now: Date): Promise<number> {
  const due = await ctx.db
    .select()
    .from(videos)
    .where(and(inArray(videos.source, ['editorial', 'rss', 'web_search']), eq(videos.status, 'active'), or(sql`${videos.verifiedAt} IS NULL`, lt(videos.verifiedAt, new Date(now.getTime() - 30 * 86_400_000)))))
    .limit(20);
  let removed = 0;
  for (const v of due) {
    if (ctx.signal.aborted) break;
    const res = await ctx.fetcher.get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.videoId}`)}`, { accept: 'json' });
    if (res.ok) {
      await ctx.db.update(videos).set({ verifiedAt: now }).where(eq(videos.id, v.id));
    } else if (res.status === 404 || res.status === 401 || res.status === 403) {
      await ctx.db.update(videos).set({ status: 'removed', verifiedAt: now }).where(eq(videos.id, v.id));
      await ctx.log.action({ action: 'video_removed', entityType: 'video', entityId: v.id, toolId: v.toolId, decision: 'auto_published', reason: `oembed ${res.status}` });
      removed++;
    }
  }
  return removed;
}

export const videoAgent: AgentDefinition = {
  name: 'video',
  description: 'Official uploads via channel RSS, optional YouTube API search, 30-day API refresh and availability checks.',
  schedule: 'daily:06:15',
  autonomy: 'auto',
  maxItems: 50,
  timeoutMs: 8 * 60_000,
  async run(ctx) {
    const now = ctx.now();
    const key = env().YOUTUBE_API_KEY;
    const official = await officialUploads(ctx, now);
    const searched = key ? await apiSearch(ctx, key, now) : 0;
    const refresh = await refreshApiData(ctx, key, now);
    const gone = await checkAvailability(ctx, now);
    ctx.stat('official_added', official);
    ctx.stat('api_added', searched);
    ctx.stat('api_refreshed', refresh.refreshed);
    ctx.stat('removed', refresh.removed + gone);
    const changed = official + searched + refresh.removed + gone;
    return {
      status: 'success',
      summary: `${official} official + ${searched} found videos added · ${refresh.refreshed} refreshed · ${refresh.removed + gone} removed${key ? '' : ' (no YOUTUBE_API_KEY: search disabled)'}`,
      dataChanged: changed > 0,
    };
  },
};
