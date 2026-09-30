/**
 * The trend and news radar: only what the agents actually collected, each
 * item with its source. Changes and news come from Pulse (sourced events),
 * videos from official channels (video agent), buzz from public community
 * metrics (social agent: Hacker News mentions, GitHub stars). No scraping of
 * platforms that do not allow it, no generated summaries, no invented counts.
 */
import { sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';
import type { Catalog, CatalogEvent } from './types';

export interface RadarVideo {
  id: string;
  title: string;
  channel: string | null;
  url: string;
  publishedAt: Date | null;
  kind: string;
  toolSlug: string;
  toolName: string;
}

export interface RadarBuzz {
  toolSlug: string;
  toolName: string;
  provider: 'hackernews' | 'github';
  metric: string;
  value: number;
  url: string | null;
  observedAt: Date;
}

export interface Radar {
  news: CatalogEvent[];
  videos: RadarVideo[];
  buzz: RadarBuzz[];
}

type VideoRow = { video_id: string; title: string; channel_title: string | null; published_at: Date | string | null; kind: string; slug: string; name: string };
type BuzzRow = { slug: string; name: string; provider: string; metric: string; value: number | string; url: string | null; observed_at: Date | string };

/** Domain shown next to a source link ("openai.com"). */
export function sourceDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function radar(db: Database, catalog: Catalog, now: Date = new Date(), limit = 5): Promise<Radar> {
  const news = catalog.events.filter((e) => e.sourceUrl).slice(0, limit);
  const [videoRows, buzzRows] = await Promise.all([
    queryRows<VideoRow>(
      db,
      sql`SELECT v.video_id, v.title, v.channel_title, v.published_at, v.kind, t.slug, t.name
          FROM videos v JOIN tools t ON t.id = v.tool_id
          WHERE v.status = 'active' AND t.published
          ORDER BY v.published_at DESC NULLS LAST LIMIT ${limit}`,
    ),
    // Latest measurement per tool and metric from the last 8 days; the biggest first.
    queryRows<BuzzRow>(
      db,
      sql`SELECT DISTINCT ON (s.tool_id, s.provider, s.metric) t.slug, t.name, s.provider, s.metric, s.value, s.url, s.observed_at
          FROM social_signals s JOIN tools t ON t.id = s.tool_id
          WHERE t.published AND s.observed_at > ${new Date(now.getTime() - 8 * 86_400_000).toISOString()}::timestamptz
            AND ((s.provider = 'hackernews' AND s.metric = 'mentions_7d') OR (s.provider = 'github' AND s.metric = 'stars'))
          ORDER BY s.tool_id, s.provider, s.metric, s.observed_at DESC`,
    ),
  ]);
  const videos: RadarVideo[] = videoRows.map((r) => ({
    id: r.video_id,
    title: r.title,
    channel: r.channel_title,
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(r.video_id)}`,
    publishedAt: r.published_at ? new Date(r.published_at) : null,
    kind: r.kind,
    toolSlug: r.slug,
    toolName: r.name,
  }));
  const buzz: RadarBuzz[] = buzzRows
    .map((r) => ({
      toolSlug: r.slug,
      toolName: r.name,
      provider: r.provider as 'hackernews' | 'github',
      metric: r.metric,
      value: Number(r.value),
      url: r.url,
      observedAt: new Date(r.observed_at),
    }))
    .filter((b) => b.value > 0)
    // Hacker News mentions first (what people talk about this week), then GitHub stars.
    .sort((a, b) => (a.provider === b.provider ? b.value - a.value : a.provider === 'hackernews' ? -1 : 1))
    .slice(0, limit);
  return { news, videos, buzz };
}
