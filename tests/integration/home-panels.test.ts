import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../setup/pglite';
import type { Database } from '@/lib/db/client';
import { newsItems, socialSignals, tools, videos } from '@/lib/db/schema';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { loadCatalog } from '@/lib/catalog/load';
import { radar, sourceDomain } from '@/lib/catalog/radar';

const NOW = new Date('2026-09-30T12:00:00Z');
let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  await applySeed(db, loadSeedData(), new Date('2026-09-30T08:00:00Z'));
});
afterAll(async () => close());

describe('trend and news radar', () => {
  it('shows only collected items with a source, and nothing when there is nothing', async () => {
    const catalog = await loadCatalog(db, 1, NOW);
    const empty = await radar(db, catalog, NOW);
    expect(empty.videos).toEqual([]);
    expect(empty.buzz).toEqual([]);
    expect(empty.news).toEqual([]);
    expect(empty.changes.every((e) => Boolean(e.sourceUrl))).toBe(true);

    const [tool] = await db.select().from(tools).where(eq(tools.slug, 'chatgpt'));
    await db.insert(videos).values({ toolId: tool!.id, videoId: 'abcdefghijk', title: 'Official launch', channelTitle: 'OpenAI', kind: 'official', source: 'rss', publishedAt: NOW });
    await db.insert(socialSignals).values([
      { toolId: tool!.id, provider: 'hackernews', metric: 'mentions_7d', value: 42, observedAt: NOW, url: 'https://hn.algolia.com/?q=chatgpt' },
      // Older than 8 days: not shown.
      { toolId: tool!.id, provider: 'github', metric: 'stars', value: 999, observedAt: new Date(NOW.getTime() - 10 * 86_400_000) },
    ]);
    const r = await radar(db, catalog, NOW);
    expect(r.videos).toMatchObject([{ id: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', toolSlug: 'chatgpt' }]);
    // Media news and videos from the news agent join the radar.
    await db.insert(newsItems).values([
      { url: 'https://www.theguardian.com/ai/1', sourceId: 'guardian-ai', kind: 'article', title: 'Hinton on AI risk', publishedAt: NOW, people: ['geoffrey-hinton'] },
      { url: 'https://www.youtube.com/watch?v=zyxwvutsrqp', sourceId: 'yt-doac', kind: 'video', title: 'Yampolskiy on superintelligence', publishedAt: new Date(NOW.getTime() - 3600_000), people: ['roman-yampolskiy'] },
    ]);
    const withNews = await radar(db, catalog, NOW);
    expect(withNews.news).toMatchObject([{ sourceName: 'The Guardian', people: ['geoffrey-hinton'] }]);
    expect(withNews.videos.map((v) => [v.kind, v.channel])).toEqual([
      ['official', 'OpenAI'],
      ['media', 'The Diary Of A CEO'],
    ]);
    expect(r.buzz).toMatchObject([{ toolSlug: 'chatgpt', provider: 'hackernews', value: 42 }]);
  });

  it('shows the source domain', () => {
    expect(sourceDomain('https://www.openai.com/blog/x')).toBe('openai.com');
    expect(sourceDomain('not a url')).toBeNull();
    expect(sourceDomain(null)).toBeNull();
  });
});
