/**
 * Agent runner: lease lock, run record, time budget, action ledger, inbox,
 * data-version bump and scheduling. Used by the worker, the CLI and the
 * cron endpoint (docs/strategy/08 §2).
 */
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { getDb } from '@/lib/db/client';
import { agentConfigs, agentRuns } from '@/lib/db/schema';
import { queryRows } from '@/lib/db/sql';
import { bumpDataVersion, loadSettings } from '@/lib/settings';
import { escalator } from '@/lib/ops/inbox';
import { logError } from '@/lib/ops/errors';
import { actionLogger } from './actions';
import { createFetcher } from './fetcher/http';
import type { Fetcher } from './fetcher/types';
import { nextRun } from './schedule';
import { AGENTS, getAgent } from './registry';
import type { AgentContext, AgentName, AgentResult } from './types';

export interface RunOptions {
  trigger?: AgentContext['trigger'];
  db?: Database;
  fetcher?: Fetcher;
  now?: () => Date;
  /** Ignore the enabled flag (manual "run now"). */
  force?: boolean;
}

export interface RunSummary {
  agent: AgentName;
  runId: string | null;
  status: AgentResult['status'] | 'locked' | 'disabled';
  summary: string;
  stats: Record<string, number>;
  durationMs: number;
}

/** Create missing agent_configs rows with defaults (idempotent). */
export async function ensureAgentConfigs(db: Database): Promise<void> {
  for (const a of AGENTS) {
    await db
      .insert(agentConfigs)
      .values({ agent: a.name, schedule: a.schedule, autonomy: a.autonomy, enabled: true })
      .onConflictDoNothing({ target: agentConfigs.agent });
  }
}

async function acquireLease(db: Database, agent: string, ms: number): Promise<boolean> {
  const rows = await queryRows<{ agent: string }>(
    db,
    sql`UPDATE agent_configs SET locked_until = now() + (${ms} || ' milliseconds')::interval
        WHERE agent = ${agent} AND (locked_until IS NULL OR locked_until < now())
        RETURNING agent`,
  );
  return rows.length > 0;
}

export async function runAgent(name: AgentName, opts: RunOptions = {}): Promise<RunSummary> {
  const db = opts.db ?? getDb();
  const now = opts.now ?? (() => new Date());
  const def = getAgent(name);
  const started = Date.now();
  await ensureAgentConfigs(db);
  const [cfg] = await db.select().from(agentConfigs).where(eq(agentConfigs.agent, name));
  if (!cfg || ((!cfg.enabled || cfg.autonomy === 'off') && !opts.force)) {
    return { agent: name, runId: null, status: 'disabled', summary: 'agent disabled', stats: {}, durationMs: 0 };
  }
  if (!(await acquireLease(db, name, def.timeoutMs + 60_000))) {
    return { agent: name, runId: null, status: 'locked', summary: 'already running', stats: {}, durationMs: 0 };
  }
  const [run] = await db
    .insert(agentRuns)
    .values({ agent: name, trigger: opts.trigger ?? 'manual', status: 'running', startedAt: now() })
    .returning({ id: agentRuns.id });
  const runId = run!.id;
  const stats: Record<string, number> = {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), def.timeoutMs);
  let result: AgentResult;
  let error: string | null = null;
  try {
    const settings = await loadSettings(db);
    const ctx: AgentContext = {
      db,
      now,
      runId,
      agent: name,
      trigger: opts.trigger ?? 'manual',
      settings,
      autonomy: cfg.autonomy,
      config: cfg.config ?? {},
      fetcher: opts.fetcher ?? createFetcher(),
      log: actionLogger(db, runId, name, now),
      inbox: escalator(db, { createdBy: `agent:${name}`, runId, now }),
      signal: controller.signal,
      limits: { maxItems: def.maxItems },
      stat: (key, by = 1) => {
        stats[key] = (stats[key] ?? 0) + by;
      },
    };
    result = await def.run(ctx);
    if (controller.signal.aborted && result.status === 'success') result = { ...result, status: 'partial', summary: `${result.summary} (time budget reached)` };
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    result = { status: 'failed', summary: error.slice(0, 300) };
    await logError('agent', 'run failed', e, { agent: name, detail: { runId } });
  } finally {
    clearTimeout(timer);
  }
  if (result.dataChanged) await bumpDataVersion(db, `agent:${name}`);
  const finished = now();
  await db
    .update(agentRuns)
    .set({ status: result.status, finishedAt: finished, stats, summary: result.summary.slice(0, 1000), error })
    .where(eq(agentRuns.id, runId));
  await db
    .update(agentConfigs)
    .set({
      lastRunAt: finished,
      nextRunAt: nextRun(cfg.schedule, finished),
      lockedUntil: null,
      consecutiveFailures: result.status === 'failed' ? sql`${agentConfigs.consecutiveFailures} + 1` : 0,
      updatedAt: finished,
    })
    .where(eq(agentConfigs.agent, name));
  return { agent: name, runId, status: result.status, summary: result.summary, stats, durationMs: Date.now() - started };
}

/** Run all agents whose next run is due, within a time budget. */
export async function runDueAgents(opts: RunOptions & { budgetMs?: number; maxRuns?: number } = {}): Promise<RunSummary[]> {
  const db = opts.db ?? getDb();
  await ensureAgentConfigs(db);
  const now = (opts.now ?? (() => new Date()))();
  const order = new Map(AGENTS.map((a, i) => [a.name as string, i]));
  // Never-run agents first, then the longest overdue; ties in registry order (safety agents first).
  const due = (
    await db
      .select()
      .from(agentConfigs)
      .where(and(eq(agentConfigs.enabled, true), or(isNull(agentConfigs.nextRunAt), lte(agentConfigs.nextRunAt, now))))
  ).sort((a, b) => (a.nextRunAt?.getTime() ?? 0) - (b.nextRunAt?.getTime() ?? 0) || (order.get(a.agent) ?? 99) - (order.get(b.agent) ?? 99));
  const out: RunSummary[] = [];
  const deadline = Date.now() + (opts.budgetMs ?? 240_000);
  for (const cfg of due) {
    if (out.length >= (opts.maxRuns ?? 20) || Date.now() > deadline) break;
    if (!AGENTS.some((a) => a.name === cfg.agent)) continue;
    out.push(await runAgent(cfg.agent as AgentName, { ...opts, db, trigger: opts.trigger ?? 'schedule' }));
  }
  return out;
}
