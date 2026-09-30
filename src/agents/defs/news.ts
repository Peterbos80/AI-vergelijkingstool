/**
 * News agent: every hour, reads the publishers' own feeds in
 * data/news/sources.json (RSS/Atom through the robots-aware fetcher) and
 * publishes new AI items: headline as written, outlet, date and link. No
 * article text, no summaries, nothing generated. Items that name a watched
 * expert (data/news/people.json) are tagged.
 *
 * YouTube channels: with YOUTUBE_API_KEY via the YouTube Data API (API
 * terms: videos are refreshed while the channel lists them and removed 30
 * days after the last refresh); without a key via the channel feed, and
 * only where robots.txt allows it. A source the publisher's robots.txt
 * disallows is skipped and named in the run summary, never fetched another
 * way. Articles are removed after 90 days.
 */
import { and, eq, lt, or, sql } from 'drizzle-orm';
import { newsItems } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { canonicalUrl, cleanTitle, isAboutAi, NEWS_SOURCES, peopleIn, youtubeChannelOf, type NewsSource } from '@/lib/news';
import { channelUploads, fetchFailure } from '../lib/youtube';
import { parseFeed } from './change-detection';
import type { AgentContext, AgentDefinition } from '../types';

/** Newest entries considered per feed per run. */
const PER_FEED = 25;
const KEEP_DAYS = 90;
/** YouTube API data must be refreshed or deleted within 30 days. */
const VIDEO_KEEP_DAYS = 30;
const DAY = 86_400_000;

type Entry = { title: string; link: string | null; date: Date | null };
type Read = { ok: true; via: 'feed' | 'api'; entries: Entry[] } | { ok: false; reason: string };

async function readSource(ctx: AgentContext, source: NewsSource, key: string | undefined): Promise<Read> {
  const channel = youtubeChannelOf(source);
  if (channel) {
    const got = await channelUploads(ctx.fetcher, channel, key, PER_FEED);
    if (!got.ok) return { ok: false, reason: got.reason };
    return { ok: true, via: got.via, entries: got.uploads.map((u) => ({ title: u.title, link: `https://www.youtube.com/watch?v=${u.videoId}`, date: u.published })) };
  }
  const res = await ctx.fetcher.get(source.url, { accept: 'xml' });
  if (!res.ok) return { ok: false, reason: fetchFailure(res) };
  try {
    return { ok: true, via: 'feed', entries: parseFeed(res.body) };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export const newsAgent: AgentDefinition = {
  name: 'news',
  description: 'Reads media feeds every hour and publishes AI news (headline, outlet, link), tagging watched experts.',
  schedule: 'every:1h',
  autonomy: 'auto',
  maxItems: 300,
  timeoutMs: 6 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const key = env().YOUTUBE_API_KEY;
    let added = 0;
    let read = 0;
    let viaApi = 0;
    const disallowed: NewsSource[] = [];
    const failed: string[] = [];
    for (const source of NEWS_SOURCES) {
      if (ctx.signal.aborted || added >= ctx.limits.maxItems) break;
      const got = await readSource(ctx, source, key);
      if (!got.ok) {
        ctx.stat(`feed_${got.reason.split(' ')[0]}`);
        if (got.reason === 'robots') disallowed.push(source);
        else failed.push(`${source.id} (${got.reason})`);
        continue;
      }
      read++;
      ctx.stat('feeds_read');
      if (got.via === 'api') {
        viaApi++;
        ctx.stat('youtube_api_calls');
      }
      const rows = new Map<string, typeof newsItems.$inferInsert>();
      for (const e of got.entries.slice(0, PER_FEED)) {
        const title = cleanTitle(e.title);
        const url = e.link ? canonicalUrl(e.link) : null;
        if (!title || !url) continue;
        // Items from the future or long ago are feed noise.
        if (e.date && (e.date.getTime() > now.getTime() + DAY || e.date.getTime() < now.getTime() - KEEP_DAYS * DAY)) continue;
        const people = peopleIn(title);
        if (source.filter === 'ai' && !isAboutAi(title) && people.length === 0) continue;
        rows.set(url, { url, sourceId: source.id, kind: source.kind, title, publishedAt: e.date, people, language: source.language, fetchedAt: now });
      }
      if (!rows.size) continue;
      const insert = db.insert(newsItems).values([...rows.values()]);
      // Videos still listed by the channel are refreshed (title, tags, fetched_at); articles are written once.
      const written = await (source.kind === 'video'
        ? insert.onConflictDoUpdate({ target: newsItems.url, set: { title: sql`excluded.title`, people: sql`excluded.people`, fetchedAt: sql`excluded.fetched_at` } })
        : insert.onConflictDoNothing({ target: newsItems.url })
      ).returning({ fresh: sql<boolean>`xmax = 0` });
      added += written.filter((w) => w.fresh).length;
    }
    if (added) ctx.stat('items_new', added);
    const pruned = await db
      .delete(newsItems)
      .where(
        or(
          lt(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`, new Date(now.getTime() - KEEP_DAYS * DAY)),
          and(eq(newsItems.kind, 'video'), lt(newsItems.fetchedAt, new Date(now.getTime() - VIDEO_KEEP_DAYS * DAY))),
        ),
      )
      .returning({ id: newsItems.id });
    if (pruned.length) ctx.stat('items_pruned', pruned.length);
    // Sources a publisher's robots.txt disallows are skipped by design, not failures; they are named so the owner can act.
    const summary = [
      `${read}/${NEWS_SOURCES.length} feeds${viaApi ? ` (${viaApi} via YouTube API)` : ''}`,
      `${added} new items`,
      `${pruned.length} pruned`,
      ...(disallowed.length
        ? [`skipped, robots.txt disallows: ${disallowed.map((s) => s.id).join(', ')}${!key && disallowed.some((s) => youtubeChannelOf(s)) ? ' (YouTube channels: set YOUTUBE_API_KEY)' : ''}`]
        : []),
      ...(failed.length ? [`failed: ${failed.join(', ')}`] : []),
    ].join(' · ');
    return {
      status: read === 0 ? 'failed' : failed.length ? 'partial' : 'success',
      summary,
      dataChanged: added > 0 || pruned.length > 0,
    };
  },
};
