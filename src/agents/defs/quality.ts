/**
 * Quality agent: recomputes snapshots (freshness decays with time; quality and
 * indexability gates follow the data) and enforces data retention.
 */
import { and, eq, lt, sql, type SQL } from 'drizzle-orm';
import { pendingChanges, rateLimits, tools } from '@/lib/db/schema';
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

    // Retention (privacy page, docs/DATABASE.md), on the agent clock.
    const at = sql`${now.toISOString()}::timestamptz`;
    const deleted = async (q: SQL) => Number((await queryRows<{ n: string }>(db, sql`WITH d AS (${q} RETURNING 1) SELECT count(*)::text AS n FROM d`))[0]?.n ?? 0);
    ctx.stat('match_queries_deleted', await deleted(sql`DELETE FROM match_queries WHERE ts < ${at} - interval '90 days'`));
    ctx.stat('events_deleted', await deleted(sql`DELETE FROM events WHERE ts < ${at} - interval '25 months'`));
    ctx.stat('leads_deleted', await deleted(sql`DELETE FROM leads WHERE COALESCE(last_contact_at, created_at) < ${at} - interval '24 months'`));
    ctx.stat('unconfirmed_subscribers_deleted', await deleted(sql`DELETE FROM subscribers WHERE status = 'pending' AND created_at < ${at} - interval '30 days'`));
    ctx.stat('outbox_pruned', await deleted(sql`DELETE FROM email_outbox WHERE status <> 'queued' AND created_at < ${at} - interval '90 days'`));
    ctx.stat(
      'snapshots_pruned',
      await deleted(sql`DELETE FROM source_snapshots WHERE id IN (
        SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY source_id ORDER BY fetched_at DESC) AS rn FROM source_snapshots) x WHERE rn > 5)`),
    );
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 2 * 86_400_000)));
    // A measured-but-unconfirmed value older than 30 days is no longer evidence (the "may have changed" notice ends).
    const expired = await db
      .update(pendingChanges)
      .set({ status: 'expired' })
      .where(and(eq(pendingChanges.status, 'pending'), lt(pendingChanges.lastObservedAt, new Date(now.getTime() - 30 * 86_400_000))))
      .returning({ id: pendingChanges.id });
    ctx.stat('pending_expired', expired.length);
    return { status: 'success', summary: `${after.length} snapshots · ${changed.length} changed`, dataChanged: changed.length > 0 || expired.length > 0 };
  },
};
