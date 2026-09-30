/**
 * Quality agent: recomputes snapshots (freshness decays with time; quality and
 * indexability gates follow the data) and enforces data retention.
 */
import { eq, lt, sql } from 'drizzle-orm';
import { rateLimits, tools } from '@/lib/db/schema';
import { queryRows } from '@/lib/db/sql';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import type { AgentDefinition } from '../types';

export const qualityAgent: AgentDefinition = {
  name: 'quality',
  description: 'Recomputes freshness, quality scores and indexability; applies data retention.',
  schedule: 'every:1h',
  autonomy: 'auto',
  maxItems: 1000,
  timeoutMs: 5 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const before = await db.select({ id: tools.id, freshness: tools.freshness, indexable: tools.indexable, q: tools.qualityScore }).from(tools).where(eq(tools.published, true));
    for (const t of before) await recomputeToolSnapshot(db, t.id, ctx.settings.freshness, now);
    const after = await db.select({ id: tools.id, freshness: tools.freshness, indexable: tools.indexable, q: tools.qualityScore }).from(tools).where(eq(tools.published, true));
    const changed = after.filter((a) => {
      const b = before.find((x) => x.id === a.id)!;
      return b.freshness !== a.freshness || JSON.stringify(b.indexable) !== JSON.stringify(a.indexable) || b.q !== a.q;
    });
    ctx.stat('snapshots', after.length);
    ctx.stat('changed', changed.length);
    ctx.stat('stale', after.filter((a) => a.freshness === 'stale').length);

    // Retention (docs: privacy page) — Match queries 90 days, analytics events 25 months.
    const del = async (q: ReturnType<typeof sql>) => Number((await queryRows<{ n: string }>(db, q))[0]?.n ?? 0);
    ctx.stat('match_queries_deleted', await del(sql`WITH d AS (DELETE FROM match_queries WHERE ts < now() - interval '90 days' RETURNING 1) SELECT count(*)::text AS n FROM d`));
    ctx.stat('events_deleted', await del(sql`WITH d AS (DELETE FROM events WHERE ts < now() - interval '25 months' RETURNING 1) SELECT count(*)::text AS n FROM d`));
    ctx.stat('snapshots_pruned', await del(sql`WITH d AS (DELETE FROM source_snapshots s WHERE s.id IN (
        SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY source_id ORDER BY fetched_at DESC) AS rn FROM source_snapshots) x WHERE rn > 5)
        RETURNING 1) SELECT count(*)::text AS n FROM d`));
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 2 * 86_400_000)));
    return { status: 'success', summary: `${after.length} snapshots · ${changed.length} changed`, dataChanged: changed.length > 0 };
  },
};
