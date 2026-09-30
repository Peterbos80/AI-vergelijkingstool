/**
 * Health agent: runs the dependency register, escalates critical failures and
 * watches for security events (docs/strategy/12 §5.1.6): a spike of failed
 * admin logins becomes a P1 security item.
 */
import { sql } from 'drizzle-orm';
import { queryRows } from '@/lib/db/sql';
import { runChecks } from '@/lib/ops/dependencies';
import type { AgentDefinition } from '../types';

/** Failed logins per hour that count as an attack rather than typos. */
export const LOGIN_FAILURE_SPIKE = 20;

export const healthAgent: AgentDefinition = {
  name: 'health',
  description: 'Runs the dependency register (database, agents, e-mail, FX, revenue imports, legal, …) and escalates failures.',
  schedule: 'every:15m',
  autonomy: 'auto',
  maxItems: 50,
  timeoutMs: 2 * 60_000,
  async run(ctx) {
    const now = ctx.now();
    const results = await runChecks(ctx.db, ctx.settings, now);
    for (const r of results) {
      ctx.stat(r.status);
      if (r.status === 'fail' && r.escalate) {
        await ctx.inbox.escalate({
          kind: 'dependency',
          severity: r.escalate,
          category: 'technical',
          title: `Dependency failing: ${r.key} — ${r.message}`,
          reasonCode: `dependency_${r.key}`,
          payload: { check: r.key, message: r.message, detail: r.detail ?? {} },
          defaultAction: 'auto_resolve_when_checks_pass',
          dedupeKey: `dependency:${r.key}:${now.toISOString().slice(0, 10)}`,
          createdBy: 'agent:health',
        });
      }
    }

    const [logins] = await queryRows<{ failed: string; limited: string }>(
      ctx.db,
      sql`SELECT count(*) FILTER (WHERE action = 'login_failed')::text AS failed,
                 count(*) FILTER (WHERE action = 'login_rate_limited')::text AS limited
          FROM audit_log WHERE at > ${now.toISOString()}::timestamptz - interval '1 hour'`,
    );
    const failed = Number(logins?.failed ?? 0);
    if (failed >= LOGIN_FAILURE_SPIKE) {
      await ctx.inbox.escalate({
        kind: 'security',
        severity: 'p1',
        category: 'security',
        title: `${failed} failed admin logins in the last hour`,
        reasonCode: 'login_failures',
        payload: { failed, rateLimited: Number(logins?.limited ?? 0) },
        defaultAction: 'keep_open',
        dedupeKey: `security:logins:${now.toISOString().slice(0, 13)}`,
        createdBy: 'agent:health',
      });
      ctx.stat('security_events');
    }
    const bad = results.filter((r) => r.status === 'fail').map((r) => r.key);
    return { status: 'success', summary: bad.length ? `failing: ${bad.join(', ')}` : 'all critical checks pass' };
  },
};
