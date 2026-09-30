/**
 * Recommendation agent: nightly regression guard for the engine (docs/strategy/12 §8).
 * Runs the golden set against the live catalog. A case that passed before
 * and fails now is escalated together with the automated changes of the
 * last 24 hours, each revertable in Admin → Operations. It never edits
 * ranking weights (class D: tuning is a human decision).
 */
import { and, desc, eq, gte, isNull, ne } from 'drizzle-orm';
import { agentActions, settings as settingsTable } from '@/lib/db/schema';
import { loadCatalog } from '@/lib/catalog/load';
import { evaluateGolden, type GoldenResult } from '@/lib/engine/golden-eval';
import { readDataVersion } from '@/lib/settings';
import { isReversible } from '../actions';
import type { AgentDefinition } from '../types';

export const GOLDEN_STATE_KEY = 'golden_last';

export interface GoldenState {
  at: string;
  dataVersion: number;
  failed: { id: string; failures: string[] }[];
  passed: string[];
}

export const recommendationAgent: AgentDefinition = {
  name: 'recommendation',
  description: 'Nightly golden-set regression check of the recommendation engine against the live catalog.',
  schedule: 'daily:04:30',
  autonomy: 'auto',
  maxItems: 100,
  timeoutMs: 5 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const version = await readDataVersion(db);
    const catalog = await loadCatalog(db, version, now);
    const results: GoldenResult[] = evaluateGolden(catalog);
    const failed = results.filter((r) => !r.ok);
    const [prevRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, GOLDEN_STATE_KEY));
    const prev = (prevRow?.value ?? null) as GoldenState | null;
    const state: GoldenState = {
      at: now.toISOString(),
      dataVersion: version,
      failed: failed.map((r) => ({ id: r.id, failures: r.failures.slice(0, 5) })),
      passed: results.filter((r) => r.ok).map((r) => r.id),
    };
    await db
      .insert(settingsTable)
      .values({ key: GOLDEN_STATE_KEY, value: state, updatedBy: 'agent:recommendation' })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: state, updatedBy: 'agent:recommendation', updatedAt: now } });
    ctx.stat('cases', results.length);
    ctx.stat('failed', failed.length);

    // Only regressions (passed last time, fail now) are news; long-standing failures are already known.
    const regressions = prev ? failed.filter((r) => prev.passed.includes(r.id)) : failed;
    if (regressions.length) {
      const recent = await db
        .select()
        .from(agentActions)
        .where(and(gte(agentActions.createdAt, new Date(now.getTime() - 24 * 3600_000)), isNull(agentActions.revertedAt), ne(agentActions.decision, 'info')))
        .orderBy(desc(agentActions.createdAt))
        .limit(50);
      await ctx.inbox.escalate({
        kind: 'regression',
        severity: 'p2',
        category: 'technical',
        title: `Golden set regression: ${regressions.map((r) => r.id).join(', ')}`,
        reasonCode: 'golden_regression',
        payload: {
          cases: regressions.map((r) => ({ id: r.id, failures: r.failures.slice(0, 5) })),
          recentActions: recent.filter((a) => isReversible(a.action)).map((a) => ({ id: a.id, runId: a.runId, agent: a.agent, action: a.action, toolId: a.toolId, at: a.createdAt.toISOString() })),
          dataVersion: version,
        },
        defaultAction: 'auto_resolve_when_golden_passes',
        dedupeKey: `golden:${regressions.map((r) => r.id).sort().join(',')}:${now.toISOString().slice(0, 10)}`,
        createdBy: 'agent:recommendation',
      });
      ctx.stat('regressions', regressions.length);
    }
    return {
      status: 'success',
      summary: `${results.length - failed.length}/${results.length} golden cases pass${regressions.length ? ` · ${regressions.length} regression(s) escalated` : ''}`,
    };
  },
};
