import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../setup/pglite';
import type { Database } from '@/lib/db/client';
import { agentConfigs, agentRuns, newsItems, socialSignals, tools, videos } from '@/lib/db/schema';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { loadCatalog } from '@/lib/catalog/load';
import { radar, sourceDomain } from '@/lib/catalog/radar';
import { agentStatus, PUBLIC_AGENTS, scheduleParts } from '@/lib/ops/agent-status';

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

describe('agent status panel', () => {
  it('reports what the run log says: never, active, late, failed, skipped, paused', async () => {
    const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
    await db.insert(agentConfigs).values([
      { agent: 'pricing', schedule: 'every:1h' },
      { agent: 'broken-link', schedule: 'every:6h' },
      { agent: 'video', schedule: 'daily:06:15' },
      { agent: 'fx', schedule: 'daily:16:40' },
      { agent: 'audit', schedule: 'monthly:01:08:00', enabled: false },
    ]).onConflictDoNothing();
    await db.update(agentConfigs).set({ enabled: false }).where(eq(agentConfigs.agent, 'audit'));
    await db.insert(agentRuns).values([
      { agent: 'pricing', trigger: 'schedule', status: 'success', startedAt: hoursAgo(1), finishedAt: hoursAgo(0.9), stats: { pages_checked: 12, plans_confirmed: 28 } },
      { agent: 'broken-link', trigger: 'schedule', status: 'success', startedAt: hoursAgo(30), finishedAt: hoursAgo(30) },
      { agent: 'video', trigger: 'schedule', status: 'success', startedAt: hoursAgo(26), finishedAt: hoursAgo(26) },
      { agent: 'video', trigger: 'schedule', status: 'failed', startedAt: hoursAgo(2), finishedAt: hoursAgo(2), error: 'boom' },
      { agent: 'fx', trigger: 'schedule', status: 'skipped', startedAt: hoursAgo(3), finishedAt: hoursAgo(3) },
      // Test runs never count.
      { agent: 'discovery', trigger: 'test', status: 'success', startedAt: hoursAgo(1), finishedAt: hoursAgo(1) },
    ]);
    const s = new Map((await agentStatus(db, NOW)).map((x) => [x.agent, x]));
    expect([...s.keys()]).toEqual([...PUBLIC_AGENTS]);
    expect(s.get('pricing')).toMatchObject({ state: 'active', result: { pages_checked: 12, plans_confirmed: 28 } });
    expect(s.get('broken-link')?.state).toBe('late');
    expect(s.get('video')?.state).toBe('failed');
    expect(s.get('video')?.lastSuccessAt?.getTime()).toBe(hoursAgo(26).getTime());
    expect(s.get('fx')?.state).toBe('skipped');
    expect(s.get('audit')?.state).toBe('paused');
    expect(s.get('discovery')?.state).toBe('never');
    // Missing stats count as zero, never as invented numbers.
    expect(s.get('broken-link')?.result).toEqual({ checked: 0, failing: 0 });
  });

  it('reads schedules for their labels', () => {
    expect(scheduleParts('every:6h')).toEqual({ unit: 'hours', n: 6 });
    expect(scheduleParts('every:15m')).toEqual({ unit: 'minutes', n: 15 });
    expect(scheduleParts('daily:06:15')).toEqual({ unit: 'daily', n: 1 });
    expect(scheduleParts(null)).toBeNull();
  });
});

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
