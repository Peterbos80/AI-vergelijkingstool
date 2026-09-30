/**
 * Agent CLI.
 *
 *   npm run agents -- list                     status of every agent
 *   npm run agents -- run <agent> [--force]    run one agent now (--force ignores "disabled")
 *   npm run agents -- due                      run everything that is due, once
 *   npm run agents -- enable|disable <agent>
 *   npm run agents -- revert <actionId>        revert one automated action
 *   npm run agents -- revert-run <runId>       revert every reversible action of a run
 */
import './_env';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db/client';
import { agentConfigs } from '../src/lib/db/schema';
import { AGENTS, isAgentName } from '../src/agents/registry';
import { ensureAgentConfigs, runAgent, runDueAgents } from '../src/agents/runner';
import { revertAction, revertRun } from '../src/agents/actions';

function usage(): never {
  console.log('usage: npm run agents -- list | run <agent> [--force] | due | enable <agent> | disable <agent> | revert <actionId> | revert-run <runId>');
  process.exit(2);
}

const fmt = (d: Date | null | undefined) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) : '—');

async function main() {
  const [cmd, arg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const force = process.argv.includes('--force');
  const db = getDb();
  await ensureAgentConfigs(db);
  switch (cmd) {
    case 'list': {
      const cfgs = await db.select().from(agentConfigs);
      const rows = AGENTS.map((a) => {
        const c = cfgs.find((x) => x.agent === a.name);
        return {
          agent: a.name,
          schedule: c?.schedule ?? a.schedule,
          enabled: c?.enabled ? 'yes' : 'no',
          autonomy: c?.autonomy ?? a.autonomy,
          last: fmt(c?.lastRunAt),
          next: fmt(c?.nextRunAt),
          failures: c?.consecutiveFailures ?? 0,
        };
      });
      console.table(rows);
      return;
    }
    case 'run': {
      if (!arg || !isAgentName(arg)) usage();
      const r = await runAgent(arg, { trigger: 'cli', force });
      console.log(`[${r.agent}] ${r.status} in ${r.durationMs} ms — ${r.summary}`);
      if (Object.keys(r.stats).length) console.table(r.stats);
      if (r.status === 'failed') process.exitCode = 1;
      return;
    }
    case 'due': {
      const list = await runDueAgents({ trigger: 'cli' });
      for (const r of list) console.log(`[${r.agent}] ${r.status} — ${r.summary}`);
      if (!list.length) console.log('nothing due');
      return;
    }
    case 'enable':
    case 'disable': {
      if (!arg || !isAgentName(arg)) usage();
      await db.update(agentConfigs).set({ enabled: cmd === 'enable', consecutiveFailures: 0, updatedAt: new Date() }).where(eq(agentConfigs.agent, arg));
      console.log(`${arg}: ${cmd}d`);
      return;
    }
    case 'revert': {
      if (!arg) usage();
      console.log(await revertAction(db, arg, 'cli'));
      return;
    }
    case 'revert-run': {
      if (!arg) usage();
      console.log(await revertRun(db, arg, 'cli'));
      return;
    }
    default:
      usage();
  }
}

main()
  .catch((err) => {
    console.error('[agents] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
