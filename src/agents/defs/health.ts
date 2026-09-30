/** Health agent: runs the dependency register and escalates critical failures. */
import { runChecks } from '@/lib/ops/dependencies';
import type { AgentDefinition } from '../types';

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
    const bad = results.filter((r) => r.status === 'fail').map((r) => r.key);
    return { status: 'success', summary: bad.length ? `failing: ${bad.join(', ')}` : 'all critical checks pass' };
  },
};
