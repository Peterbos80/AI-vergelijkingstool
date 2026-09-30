/**
 * Long-running agent worker (docs/strategy/12 §4): every cycle it runs the
 * agents that are due, then pings the external heartbeat (dead man's switch)
 * so an outage of the worker itself is noticed outside the system.
 *
 *   npm run agents:worker            loop (default cycle 60 s)
 *   WORKER_CYCLE_SECONDS=30 npm run agents:worker
 *
 * Stops gracefully on SIGINT/SIGTERM after the current agent finishes.
 * Alternative without a long-running process: call POST /api/cron/agents
 * from a scheduler every 5–15 minutes.
 */
import './_env';
import { closeDb } from '../src/lib/db/client';
import { runDueAgents } from '../src/agents/runner';
import { pingHeartbeat } from '../src/lib/ops/dependencies';
import { logError } from '../src/lib/ops/errors';

const cycleMs = Math.max(15, Number(process.env.WORKER_CYCLE_SECONDS ?? 60)) * 1000;
let stopping = false;

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log(`[worker] ${sig}: finishing the current agent, then exiting`);
  });
}

async function sleep(ms: number) {
  const until = Date.now() + ms;
  while (!stopping && Date.now() < until) await new Promise((r) => setTimeout(r, Math.min(1000, until - Date.now())));
}

async function main() {
  console.log(`[worker] started, cycle ${cycleMs / 1000}s`);
  while (!stopping) {
    const started = Date.now();
    let healthy = true;
    try {
      const runs = await runDueAgents({ trigger: 'schedule', budgetMs: Math.max(cycleMs * 4, 240_000) });
      for (const r of runs) console.log(`[worker] ${r.agent}: ${r.status} (${r.durationMs} ms) — ${r.summary}`);
      healthy = !runs.some((r) => r.agent === 'health' && r.status === 'failed');
    } catch (err) {
      healthy = false;
      await logError('agent', 'worker cycle failed', err);
    }
    await pingHeartbeat(healthy ? 'ok' : 'fail');
    await sleep(Math.max(1000, cycleMs - (Date.now() - started)));
  }
}

main()
  .catch((err) => {
    console.error('[worker] fatal:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
