/**
 * Change Detection agent: official changelogs/RSS/Atom → Pulse events
 * (official source, R1, auto). Titles are kept verbatim from the vendor feed
 * (no generated text); summaries are optional and never invent numbers.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { XMLParser } from 'fast-xml-parser';
import { changeEvents, sources, tools } from '@/lib/db/schema';
import { recordFetch } from '../lib/tool-sources';
import type { AgentDefinition } from '../types';

interface FeedItem {
  id: string;
  title: string;
  link: string | null;
  date: Date | null;
}

export function parseFeed(xml: string): FeedItem[] {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' }).parse(xml) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const items: FeedItem[] = [];
  const text = (v: unknown): string => (typeof v === 'string' ? v : v && typeof v === 'object' && '#text' in (v as object) ? String((v as { '#text': unknown })['#text']) : '');
  const rssItems = doc.rss?.channel?.item;
  if (rssItems) {
    for (const it of Array.isArray(rssItems) ? rssItems : [rssItems]) {
      const link = text(it.link) || null;
      items.push({ id: text(it.guid) || link || text(it.title), title: text(it.title).trim(), link, date: it.pubDate ? new Date(text(it.pubDate)) : null });
    }
  }
  const entries = doc.feed?.entry;
  if (entries) {
    for (const e of Array.isArray(entries) ? entries : [entries]) {
      const links = Array.isArray(e.link) ? e.link : e.link ? [e.link] : [];
      const alt = links.find((l: Record<string, string>) => !l['@rel'] || l['@rel'] === 'alternate');
      const link = alt?.['@href'] ?? null;
      items.push({ id: text(e.id) || link || text(e.title), title: text(e.title).trim(), link, date: e.updated ? new Date(text(e.updated)) : e.published ? new Date(text(e.published)) : null });
    }
  }
  return items.filter((i) => i.title && i.id).map((i) => ({ ...i, date: i.date && !Number.isNaN(i.date.getTime()) ? i.date : null }));
}

const FEATURE = /\b(new|introduc|launch|now available|added|nieuw|beschikbaar)\b/i;

export const changeDetectionAgent: AgentDefinition = {
  name: 'change-detection',
  description: 'Reads official changelog and RSS feeds and publishes new releases to Pulse.',
  schedule: 'every:6h',
  autonomy: 'auto',
  maxItems: 30,
  timeoutMs: 8 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const published = await db.select({ id: tools.id }).from(tools).where(eq(tools.published, true));
    const feeds = await db
      .select()
      .from(sources)
      .where(and(eq(sources.role, 'rss'), inArray(sources.toolId, published.map((t) => t.id).concat(['00000000-0000-0000-0000-000000000000']))))
      .limit(ctx.limits.maxItems);
    let created = 0;
    for (const f of feeds) {
      if (ctx.signal.aborted) break;
      const res = await ctx.fetcher.get(f.url, { accept: 'xml' });
      await recordFetch(db, f.id, res, undefined, ctx.now());
      if (!res.ok) {
        ctx.stat('feed_failed');
        continue;
      }
      const items = parseFeed(res.body)
        .filter((i) => !i.date || now.getTime() - i.date.getTime() < 30 * 86_400_000)
        .slice(0, 10);
      for (const it of items) {
        const rows = await db
          .insert(changeEvents)
          .values({
            toolId: f.toolId,
            kind: FEATURE.test(it.title) ? 'feature' : 'release',
            title: { en: it.title.slice(0, 200) },
            sourceId: f.id,
            sourceUrl: it.link ?? f.url,
            sourceType: 'changelog',
            occurredAt: it.date ?? now,
            detectedAt: now,
            detectedBy: 'agent:change-detection',
            confidence: 90,
            significance: 45,
            dedupeKey: `feed:${f.toolId}:${it.id.slice(0, 200)}`,
          })
          .onConflictDoNothing({ target: changeEvents.dedupeKey })
          .returning({ id: changeEvents.id });
        if (rows[0]) {
          created++;
          await ctx.log.action({ action: 'event_published', entityType: 'change_event', entityId: rows[0].id, toolId: f.toolId, sourceUrl: it.link ?? f.url, confidence: 90, decision: 'auto_published', reason: 'official_feed' });
        }
      }
      ctx.stat('feeds_read');
    }
    return { status: 'success', summary: `${feeds.length} feeds · ${created} new events`, dataChanged: created > 0 };
  },
};
