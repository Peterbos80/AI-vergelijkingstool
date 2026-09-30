/**
 * A YouTube channel's latest uploads, the allowed way:
 *  - with YOUTUBE_API_KEY: the YouTube Data API (the channel's uploads
 *    playlist, 1 quota unit per call), under the YouTube API Services terms;
 *  - without a key: the public channel feed through the robots-aware
 *    fetcher. When robots.txt disallows the feed, the channel is skipped
 *    (reason "robots"), never fetched another way.
 */
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import type { FetchResult, Fetcher } from '../fetcher/types';

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

export interface Upload {
  videoId: string;
  title: string;
  published: Date | null;
  channelTitle: string | null;
  channelId: string | null;
}

export type Uploads = { ok: true; via: 'api' | 'feed'; uploads: Upload[] } | { ok: false; via: 'api' | 'feed'; reason: string };

const PlaylistItems = z.object({
  items: z.array(
    z.object({
      snippet: z.object({
        title: z.string(),
        channelTitle: z.string().optional(),
        channelId: z.string().optional(),
        resourceId: z.object({ videoId: z.string().regex(/^[\w-]{11}$/) }),
      }),
      contentDetails: z.object({ videoPublishedAt: z.string().optional() }).optional(),
    }),
  ),
});

/** Why a fetch failed, short and without the URL (API URLs carry the key): "robots", "http 404", "timeout". */
export function fetchFailure(res: FetchResult): string {
  return res.errorKind === 'http' && res.status ? `http ${res.status}` : (res.errorKind ?? 'error');
}

const toDate = (v: string | null | undefined): Date | null => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/** A channel's uploads playlist: UC… → UU…. */
export const uploadsPlaylist = (channelId: string) => `UU${channelId.slice(2)}`;

export async function channelUploads(fetcher: Fetcher, channelId: string, key: string | undefined, max = 15): Promise<Uploads> {
  if (key) {
    const res = await fetcher.get(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${max}&playlistId=${uploadsPlaylist(channelId)}&key=${encodeURIComponent(key)}`,
      { accept: 'json', api: true },
    );
    if (!res.ok) return { ok: false, via: 'api', reason: fetchFailure(res) };
    let parsed;
    try {
      parsed = PlaylistItems.safeParse(JSON.parse(res.body));
    } catch {
      return { ok: false, via: 'api', reason: 'invalid' };
    }
    if (!parsed.success) return { ok: false, via: 'api', reason: 'invalid' };
    const uploads = parsed.data.items
      // Private and deleted videos stay in the playlist, without a publish date.
      .filter((i) => i.contentDetails?.videoPublishedAt && !/^(Private|Deleted) video$/.test(i.snippet.title))
      .map((i) => ({
        videoId: i.snippet.resourceId.videoId,
        title: decodeEntities(i.snippet.title).slice(0, 300),
        published: toDate(i.contentDetails?.videoPublishedAt),
        channelTitle: i.snippet.channelTitle ?? null,
        channelId: i.snippet.channelId ?? channelId,
      }));
    return { ok: true, via: 'api', uploads };
  }
  const res = await fetcher.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { accept: 'xml' });
  if (!res.ok) return { ok: false, via: 'feed', reason: fetchFailure(res) };
  let entries;
  try {
    entries = parseChannelFeed(res.body);
  } catch {
    return { ok: false, via: 'feed', reason: 'invalid' };
  }
  return {
    ok: true,
    via: 'feed',
    uploads: entries.slice(0, max).map((e) => ({ videoId: e.videoId, title: decodeEntities(e.title), published: toDate(e.published), channelTitle: e.channelTitle, channelId: e.channelId ?? channelId })),
  };
}
