/**
 * News agent: every hour, reads the publishers' own feeds in
 * data/news/sources.json (RSS/Atom and YouTube channel feeds, through the
 * robots-aware fetcher) and publishes new AI items: headline as written,
 * outlet, date and link. No article text, no summaries, nothing generated.
 * Items that name a watched expert (data/news/people.json) are tagged.
 * Items older than 90 days are removed.
 */
import { lt, sql } from 'drizzle-orm';
import { newsItems } from '@/lib/db/schema';
import { canonicalUrl, cleanTitle, isAboutAi, NEWS_SOURCES, peopleIn } from '@/lib/news';
import { parseFeed } from './change-detection';
import type { AgentDefinition } from '../types';

/** Newest entries considered per feed per run. */
const PER_FEED = 25;
const KEEP_DAYS = 90;

export const newsAgent: AgentDefinition = {
  name: 'news',
  description: "Reads media feeds every hour and publishes AI news (headline, outlet, link), tagging watched experts.",
  schedule: 'every:1h',
  autonomy: 'auto',
  maxItems: 300,
  timeoutMs: 6 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    let added = 0;
    let failed = 0;
    for (const source of NEWS_SOURCES) {
      if (ctx.signal.aborted) break;
      const res = await ctx.fetcher.get(source.url, { accept: 'xml' });
      if (!res.ok) {
        failed++;
        ctx.stat(`feed_${res.errorKind ?? 'error'}`);
        continue;
      }
      ctx.stat('feeds_read');
      let entries;
      try {
        entries = parseFeed(res.body);
      } catch {
        failed++;
        ctx.stat('feed_invalid');
        continue;
      }
      const rows = [];
      for (const e of entries.slice(0, PER_FEED)) {
        const title = cleanTitle(e.title);
        const url = e.link ? canonicalUrl(e.link) : null;
        if (!title || !url) continue;
        // Items from the future or long ago are feed noise.
        if (e.date && (e.date.getTime() > now.getTime() + 86_400_000 || e.date.getTime() < now.getTime() - KEEP_DAYS * 86_400_000)) continue;
        const people = peopleIn(title);
        if (source.filter === 'ai' && !isAboutAi(title) && people.length === 0) continue;
        rows.push({ url, sourceId: source.id, kind: source.kind, title, publishedAt: e.date, people, language: source.language, fetchedAt: now });
      }
      if (!rows.length) continue;
      const inserted = await db.insert(newsItems).values(rows).onConflictDoNothing({ target: newsItems.url }).returning({ id: newsItems.id });
      added += inserted.length;
      if (added >= ctx.limits.maxItems) break;
    }
    if (added) ctx.stat('items_new', added);
    const pruned = await db.delete(newsItems).where(lt(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`, new Date(now.getTime() - KEEP_DAYS * 86_400_000))).returning({ id: newsItems.id });
    if (pruned.length) ctx.stat('items_pruned', pruned.length);
    const read = NEWS_SOURCES.length - failed;
    return {
      status: read === 0 ? 'failed' : failed ? 'partial' : 'success',
      summary: `${read}/${NEWS_SOURCES.length} feeds · ${added} new items · ${pruned.length} pruned`,
      dataChanged: added > 0 || pruned.length > 0,
    };
  },
};
