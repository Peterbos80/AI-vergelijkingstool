/**
 * Verification planner (docs/strategy/12 §4.1): spend the fetch budget where it
 * matters — impact (visits + outbound clicks, 30 d) × staleness — with a floor
 * so every tool is still checked within its freshness limit.
 */
import { sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';

export async function toolImpact(db: Database, days = 30): Promise<Map<string, number>> {
  const rows = await queryRows<{ tool_id: string; score: string }>(
    db,
    sql`SELECT tool_id, SUM(score)::text AS score FROM (
          SELECT entity_id AS tool_id, COUNT(*) AS score FROM events
           WHERE type = 'pageview' AND page_type IN ('tool', 'tool_pricing', 'tool_alternatives')
             AND entity_id IS NOT NULL AND ts > now() - (${days} || ' days')::interval
           GROUP BY entity_id
          UNION ALL
          SELECT tool_id::text, COUNT(*) * 3 FROM outbound_clicks
           WHERE ts > now() - (${days} || ' days')::interval GROUP BY tool_id
        ) x GROUP BY tool_id`,
  );
  return new Map(rows.map((r) => [r.tool_id, Number(r.score)]));
}

/** Higher = check sooner. `ageHours` since the last check; `intervalHours` is the target. */
export function priority(impact: number, ageHours: number, intervalHours: number): number {
  const staleness = ageHours / Math.max(1, intervalHours);
  if (staleness < 1) return -1; // not due
  return staleness * (1 + Math.log10(1 + impact));
}
