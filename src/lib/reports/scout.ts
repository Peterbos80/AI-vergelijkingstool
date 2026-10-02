/**
 * The tool scout in the weekly owner report (brief B6 §6): one line per day
 * ("{n} new tools added, {m} in quarantine, {k} rejected (reasons)"), one
 * line on the catalogue now (live, in quarantine, added today), and one line
 * when Product Hunt is skipped. Figures come from the action ledger and the
 * agents' run statistics only; nothing is estimated.
 */
import { sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';
import { env } from '@/lib/env';
import type { Settings } from '@/lib/settings/defaults';
import { tzParts, zoned } from '@/agents/schedule';
import { newToolPolicy } from '@/agents/lib/scout/config';

export interface ScoutDay {
  /** Local start of the day (ISO instant). */
  date: string;
  added: number;
  /** Tools in quarantine after that day's publication run; null when it did not run. */
  inQuarantine: number | null;
  rejected: number;
  /** Rejections per gate (verification and the daily re-check). */
  reasons: Record<string, number>;
}

export interface ScoutReport {
  mode: 'queue' | 'quarantine';
  perDay: number;
  /** Now: published tools outside quarantine, tools in quarantine, scout publications today. */
  live: number;
  inQuarantine: number;
  addedToday: number;
  promoted: number;
  depublished: number;
  days: ScoutDay[];
  productHunt: 'configured' | 'not_configured';
}

const iso = (d: Date) => d.toISOString();
const n = (v: unknown) => Number(v ?? 0);

export async function scoutReport(db: Database, period: { start: Date; end: Date }, settings: Settings, now: Date): Promise<ScoutReport> {
  const tz = settings.report.timezone;
  const policy = newToolPolicy(settings);
  const [counts] = await queryRows<{ live: string; quarantine: string }>(
    db,
    sql`SELECT count(*) FILTER (WHERE published AND quarantine_until IS NULL)::text AS live,
               count(*) FILTER (WHERE published AND quarantine_until IS NOT NULL)::text AS quarantine
        FROM tools`,
  );
  const p = tzParts(now, tz);
  const midnight = zoned(p.y, p.mo, p.day, 0, 0, tz);
  const [today] = await queryRows<{ n: string }>(
    db,
    sql`SELECT count(*)::text AS n FROM agent_actions WHERE action = 'tool_quarantined' AND reverted_at IS NULL AND created_at >= ${iso(midnight)}::timestamptz`,
  );
  const actions = await queryRows<{ action: string; at: string }>(
    db,
    sql`SELECT action, created_at::text AS at FROM agent_actions
        WHERE action IN ('tool_quarantined', 'tool_promoted', 'tool_depublished') AND reverted_at IS NULL
          AND created_at >= ${iso(period.start)}::timestamptz AND created_at < ${iso(period.end)}::timestamptz`,
  );
  const runs = await queryRows<{ agent: string; at: string; stats: Record<string, number> }>(
    db,
    sql`SELECT agent, started_at::text AS at, stats FROM agent_runs
        WHERE agent IN ('verification', 'new-tools')
          AND started_at >= ${iso(period.start)}::timestamptz AND started_at < ${iso(period.end)}::timestamptz
        ORDER BY started_at`,
  );
  const s = tzParts(period.start, tz);
  const days: ScoutDay[] = [];
  for (let i = 0; ; i++) {
    const from = zoned(s.y, s.mo, s.day + i, 0, 0, tz);
    if (from >= period.end) break;
    const to = zoned(s.y, s.mo, s.day + i + 1, 0, 0, tz);
    const inDay = (at: string) => {
      const t = new Date(at).getTime();
      return t >= from.getTime() && t < to.getTime();
    };
    const reasons: Record<string, number> = {};
    let inQuarantine: number | null = null;
    for (const r of runs.filter((x) => inDay(x.at))) {
      for (const [k, v] of Object.entries(r.stats ?? {})) if (k.startsWith('rejected_')) reasons[k.slice(9)] = (reasons[k.slice(9)] ?? 0) + n(v);
      if (r.agent === 'new-tools' && r.stats && 'in_quarantine' in r.stats) inQuarantine = n(r.stats.in_quarantine);
    }
    days.push({
      date: iso(from),
      added: actions.filter((a) => a.action === 'tool_quarantined' && inDay(a.at)).length,
      inQuarantine,
      rejected: Object.values(reasons).reduce((a, b) => a + b, 0),
      reasons,
    });
  }
  return {
    mode: policy.mode,
    perDay: policy.perDay,
    live: n(counts?.live),
    inQuarantine: n(counts?.quarantine),
    addedToday: n(today?.n),
    promoted: actions.filter((a) => a.action === 'tool_promoted').length,
    depublished: actions.filter((a) => a.action === 'tool_depublished').length,
    days,
    productHunt: env().PRODUCTHUNT_TOKEN ? 'configured' : 'not_configured',
  };
}
