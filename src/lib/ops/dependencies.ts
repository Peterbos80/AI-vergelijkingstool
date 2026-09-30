/**
 * Dependency register (docs/strategy/12 §6.3): every external input or owner
 * duty the system relies on, with a live status. Nothing may depend on the
 * owner silently — a test asserts that each integration registers here.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { adminUsers, agentConfigs, agentRuns, affiliatePrograms, emailOutbox, healthChecks } from '@/lib/db/schema';
import { queryRows } from '@/lib/db/sql';
import { env, legalDetails } from '@/lib/env';
import type { Settings } from '@/lib/settings/defaults';
import { maxGapMs } from '@/agents/schedule';

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'unknown' | 'not_configured';

export interface CheckResult {
  status: CheckStatus;
  message: string;
  detail?: Record<string, unknown>;
}

export interface DependencyCheck {
  key: string;
  /** Escalate a failure to the owner inbox (P1 for outages, P2 otherwise). */
  escalate: 'p1' | 'p2' | null;
  /** Owner duty or configuration step (shown in Launch readiness). */
  ownerAction: string;
  run: (db: Database, settings: Settings, now: Date) => Promise<CheckResult>;
}

export const DEPENDENCIES: DependencyCheck[] = [
  {
    key: 'database',
    escalate: 'p1',
    ownerAction: 'Hosting: PostgreSQL reachable (DATABASE_URL).',
    run: async (db) => {
      const t0 = Date.now();
      await queryRows(db, sql`SELECT 1 AS one`);
      const ms = Date.now() - t0;
      return { status: ms < 500 ? 'ok' : 'warn', message: `${ms} ms`, detail: { latencyMs: ms } };
    },
  },
  {
    key: 'agents',
    escalate: 'p2',
    ownerAction: 'Worker or cron must run (npm run agents:worker or POST /api/cron/agents).',
    run: async (db, _s, now) => {
      const cfgs = await db.select().from(agentConfigs).where(eq(agentConfigs.enabled, true));
      if (!cfgs.length) return { status: 'unknown', message: 'no agents configured yet' };
      const stale = cfgs.filter((c) => !c.lastRunAt || now.getTime() - c.lastRunAt.getTime() > maxGapMs(c.schedule)).map((c) => c.agent);
      const disabled = (await db.select().from(agentConfigs).where(eq(agentConfigs.enabled, false))).map((c) => c.agent);
      if (stale.length === cfgs.length) return { status: 'fail', message: 'no agent has run on schedule', detail: { stale, disabled } };
      return { status: stale.length || disabled.length ? 'warn' : 'ok', message: stale.length ? `late: ${stale.join(', ')}` : disabled.length ? `disabled: ${disabled.join(', ')}` : 'all on schedule', detail: { stale, disabled } };
    },
  },
  {
    key: 'heartbeat',
    escalate: null,
    ownerAction: 'Set HEARTBEAT_URL to an external monitor (dead man’s switch).',
    run: async () => (env().HEARTBEAT_URL ? { status: 'ok', message: 'configured' } : { status: 'not_configured', message: 'HEARTBEAT_URL not set: nobody is alerted if the worker stops' }),
  },
  {
    key: 'email',
    escalate: 'p2',
    ownerAction: 'Set RESEND_API_KEY and EMAIL_FROM (SPF/DKIM on the domain).',
    run: async (db) => {
      if (!env().RESEND_API_KEY) return { status: 'not_configured', message: 'no e-mail provider: Watch and newsletter are hidden' };
      const [row] = await queryRows<{ n: string }>(db, sql`SELECT count(*)::text AS n FROM email_outbox WHERE status = 'queued' AND created_at < now() - interval '24 hours'`);
      const backlog = Number(row?.n ?? 0);
      const [failed] = await db.select({ n: sql<number>`count(*)::int` }).from(emailOutbox).where(eq(emailOutbox.status, 'failed'));
      return { status: backlog > 0 ? 'fail' : 'ok', message: backlog ? `${backlog} e-mails stuck > 24 h` : 'delivering', detail: { backlog, failed: failed?.n ?? 0 } };
    },
  },
  {
    key: 'llm',
    escalate: null,
    ownerAction: 'Optional: ANTHROPIC_API_KEY (model choice and budget are owner decisions).',
    run: async (db) => {
      if (!env().ANTHROPIC_API_KEY) return { status: 'not_configured', message: 'lexical engine only (optional)' };
      const [row] = await queryRows<{ spent: string; calls: string; failures: string }>(
        db,
        sql`SELECT COALESCE(SUM(est_cost_micros),0)::text AS spent, COALESCE(SUM(calls),0)::text AS calls, COALESCE(SUM(failures),0)::text AS failures FROM llm_usage WHERE day = CURRENT_DATE`,
      );
      const calls = Number(row?.calls ?? 0);
      const failures = Number(row?.failures ?? 0);
      const failRate = calls ? failures / calls : 0;
      return { status: failRate > 0.5 && calls >= 5 ? 'warn' : 'ok', message: `today: ${calls} calls, $${(Number(row?.spent ?? 0) / 1e6).toFixed(2)}`, detail: { calls, failures } };
    },
  },
  {
    key: 'fx',
    escalate: null,
    ownerAction: 'None (ECB rates are public). Requires outbound network for the worker.',
    run: async (db, _s, now) => {
      const [row] = await queryRows<{ day: string | null }>(db, sql`SELECT max(day)::text AS day FROM fx_rates`);
      if (!row?.day) return { status: 'warn', message: 'no exchange rates yet: euro conversions are hidden' };
      const age = (now.getTime() - new Date(`${row.day}T16:00:00Z`).getTime()) / 86_400_000;
      return { status: age <= 4 ? 'ok' : age <= 10 ? 'warn' : 'fail', message: `ECB ${row.day}`, detail: { ageDays: Math.round(age) } };
    },
  },
  {
    key: 'revenue_import',
    escalate: 'p2',
    ownerAction: 'Import affiliate conversions monthly (CSV) or connect the network API.',
    run: async (db, s, now) => {
      const programs = await db.select().from(affiliatePrograms).where(eq(affiliatePrograms.status, 'approved'));
      if (!programs.length) return { status: 'not_configured', message: 'no approved affiliate programmes yet' };
      const rows = await queryRows<{ program_id: string; last: string | null }>(
        db,
        sql`SELECT p.id AS program_id, max(c.imported_at)::text AS last FROM affiliate_programs p LEFT JOIN conversions c ON c.program_id = p.id WHERE p.status = 'approved' GROUP BY p.id`,
      );
      const stale = rows.filter((r) => !r.last || (now.getTime() - new Date(r.last).getTime()) / 86_400_000 > s.revenue.staleImportDays);
      return stale.length
        ? { status: 'warn', message: `${stale.length} programme(s) without import in ${s.revenue.staleImportDays} days — revenue shows as unknown`, detail: { stale: stale.map((x) => x.program_id) } }
        : { status: 'ok', message: 'imports up to date' };
    },
  },
  {
    key: 'legal',
    escalate: null,
    ownerAction: 'Set LEGAL_NAME, LEGAL_KVK, LEGAL_ADDRESS, LEGAL_EMAIL before launch.',
    run: async () => (legalDetails().complete ? { status: 'ok', message: 'complete' } : { status: 'fail', message: 'legal details incomplete (launch blocker)' }),
  },
  {
    key: 'owner_account',
    escalate: null,
    ownerAction: 'Create the owner account: npm run admin:create.',
    run: async (db) => {
      const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(adminUsers).where(and(eq(adminUsers.role, 'owner'), eq(adminUsers.disabled, false)));
      return (row?.n ?? 0) > 0 ? { status: 'ok', message: 'owner exists' } : { status: 'fail', message: 'no owner account' };
    },
  },
  {
    key: 'errors',
    escalate: null,
    ownerAction: 'None — recurring code errors become an issue for the developer.',
    run: async (db) => {
      const [row] = await queryRows<{ n: string }>(db, sql`SELECT COALESCE(SUM(count),0)::text AS n FROM error_log WHERE day = CURRENT_DATE`);
      const n = Number(row?.n ?? 0);
      return { status: n > 50 ? 'warn' : 'ok', message: `${n} errors today` };
    },
  },
  {
    key: 'outbound_network',
    escalate: null,
    ownerAction: 'The worker needs outbound HTTPS to vendor sites.',
    run: async (db) => {
      const [last] = await db.select().from(agentRuns).where(eq(agentRuns.agent, 'broken-link')).orderBy(desc(agentRuns.startedAt)).limit(1);
      if (!last) return { status: 'unknown', message: 'no website checks yet' };
      return last.status === 'success' ? { status: 'ok', message: 'website checks succeed' } : { status: 'warn', message: last.summary ?? 'last check failed' };
    },
  },
  {
    key: 'search_console',
    escalate: null,
    ownerAction: 'Optional: verify the domain in Google Search Console (not connected in this version).',
    run: async () => ({ status: 'not_configured', message: 'not connected — organic traffic comes from first-party referrers only' }),
  },
  {
    key: 'backups',
    escalate: null,
    ownerAction: 'Enable daily backups + point-in-time restore at the database host and test a restore monthly.',
    run: async () => ({ status: 'not_configured', message: 'not observable from the app — confirm at your database host' }),
  },
];

export async function runChecks(db: Database, settings: Settings, now: Date): Promise<(CheckResult & { key: string; escalate: DependencyCheck['escalate'] })[]> {
  const out: (CheckResult & { key: string; escalate: DependencyCheck['escalate'] })[] = [];
  for (const d of DEPENDENCIES) {
    let r: CheckResult;
    try {
      r = await d.run(db, settings, now);
    } catch (e) {
      r = { status: 'fail', message: e instanceof Error ? e.message.slice(0, 200) : 'check failed' };
    }
    out.push({ ...r, key: d.key, escalate: d.escalate });
    await db
      .insert(healthChecks)
      .values({ key: d.key, status: r.status, message: r.message, detail: r.detail ?? null, lastCheckedAt: now, lastOkAt: r.status === 'ok' ? now : null })
      .onConflictDoUpdate({
        target: healthChecks.key,
        set: {
          status: r.status,
          message: r.message,
          detail: r.detail ?? null,
          lastCheckedAt: now,
          ...(r.status === 'ok' ? { lastOkAt: now } : {}),
        },
      });
  }
  return out;
}

/** External dead man's switch: ping after every worker cycle. */
export async function pingHeartbeat(status: 'ok' | 'fail' = 'ok'): Promise<boolean> {
  const url = env().HEARTBEAT_URL;
  if (!url || !/^https:\/\//.test(url)) return false;
  try {
    const res = await fetch(status === 'fail' ? `${url.replace(/\/$/, '')}/fail` : url, { signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}
