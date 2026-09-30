/**
 * Public agent status: for the agents that keep the published data honest,
 * their real last run, last success, schedule and next run, straight from
 * agent_runs and agent_configs. Nothing is simulated: an agent that failed
 * shows as failed, one that never ran as "not yet".
 */
import { sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';
import { maxGapMs } from '@/agents/schedule';

/** Agents whose work is visible on the site, in the order the panel shows them. */
export const PUBLIC_AGENTS = [
  'pricing',
  'change-detection',
  'broken-link',
  'verification',
  'discovery',
  'social',
  'video',
  'quality',
  'fx',
  'recommendation',
  'duplicate',
  'audit',
] as const;
export type PublicAgent = (typeof PUBLIC_AGENTS)[number];

/** Stats keys each agent's result line uses (a missing key means 0). */
export const RESULT_KEYS: Record<PublicAgent, string[]> = {
  pricing: ['pages_checked', 'plans_confirmed'],
  'change-detection': ['feeds_read'],
  'broken-link': ['checked', 'failing'],
  verification: ['verified'],
  discovery: ['candidates'],
  social: ['hn_checked', 'github_repos'],
  video: ['official_added'],
  quality: ['snapshots', 'changed'],
  fx: ['rates'],
  recommendation: ['cases', 'failed'],
  duplicate: ['pairs'],
  audit: ['sampled'],
};

export type AgentState = 'active' | 'late' | 'failed' | 'skipped' | 'never' | 'paused';

export interface AgentStatus {
  agent: PublicAgent;
  state: AgentState;
  schedule: string | null;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  nextRunAt: Date | null;
  /** Values for the result line of the last completed run. */
  result: Record<string, number>;
}

type LastRun = { agent: string; status: string; finished_at: Date | string | null; started_at: Date | string; stats: Record<string, number> | string | null };
type LastOk = { agent: string; at: Date | string | null };
type Config = { agent: string; enabled: boolean; schedule: string; next_run_at: Date | string | null };

const asDate = (v: Date | string | null | undefined): Date | null => (v ? new Date(v) : null);

export async function agentStatus(db: Database, now: Date = new Date()): Promise<AgentStatus[]> {
  const [last, ok, configs] = await Promise.all([
    queryRows<LastRun>(
      db,
      sql`SELECT DISTINCT ON (agent) agent, status, started_at, finished_at, stats
          FROM agent_runs WHERE trigger <> 'test' AND status <> 'running'
          ORDER BY agent, started_at DESC`,
    ),
    queryRows<LastOk>(db, sql`SELECT agent, max(finished_at) AS at FROM agent_runs WHERE trigger <> 'test' AND status IN ('success', 'partial') GROUP BY agent`),
    queryRows<Config>(db, sql`SELECT agent, enabled, schedule, next_run_at FROM agent_configs`),
  ]);
  const lastBy = new Map(last.map((r) => [r.agent, r]));
  const okBy = new Map(ok.map((r) => [r.agent, asDate(r.at)]));
  const cfgBy = new Map(configs.map((r) => [r.agent, r]));
  return PUBLIC_AGENTS.map((agent) => {
    const run = lastBy.get(agent);
    const cfg = cfgBy.get(agent);
    const lastSuccessAt = okBy.get(agent) ?? null;
    const stats = (typeof run?.stats === 'string' ? JSON.parse(run.stats) : run?.stats) ?? {};
    const result: Record<string, number> = {};
    for (const k of RESULT_KEYS[agent]) result[k] = Number(stats[k] ?? 0);
    let state: AgentState;
    if (cfg && !cfg.enabled) state = 'paused';
    else if (!run) state = 'never';
    else if (run.status === 'failed') state = 'failed';
    else if (run.status === 'skipped') state = 'skipped';
    else {
      const at = asDate(run.finished_at) ?? asDate(run.started_at)!;
      state = cfg && now.getTime() - at.getTime() > maxGapMs(cfg.schedule) ? 'late' : 'active';
    }
    return {
      agent,
      state,
      schedule: cfg?.schedule ?? null,
      lastRunAt: run ? (asDate(run.finished_at) ?? asDate(run.started_at)) : null,
      lastSuccessAt,
      nextRunAt: asDate(cfg?.next_run_at),
      result,
    };
  });
}

/** "every:6h" → { unit: 'hours', n: 6 }; daily/weekly/monthly as such. */
export function scheduleParts(schedule: string | null): { unit: 'minutes' | 'hours' | 'daily' | 'weekly' | 'monthly'; n: number } | null {
  if (!schedule) return null;
  const [kind, rest] = schedule.split(':');
  if (kind === 'every') {
    const m = /^(\d+)([mh])$/.exec(rest ?? '');
    if (!m) return null;
    return { unit: m[2] === 'h' ? 'hours' : 'minutes', n: Number(m[1]) };
  }
  if (kind === 'daily' || kind === 'weekly' || kind === 'monthly') return { unit: kind, n: 1 };
  return null;
}
