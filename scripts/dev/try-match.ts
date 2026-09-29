/** Dev helper: run intent + composer on queries against the local DB. */
import '../_env';
import { closeDb, getDb } from '../../src/lib/db/client';
import { loadCatalog } from '../../src/lib/catalog/load';
import { detectIntent } from '../../src/lib/engine/intent';
import { adHocTask, composeVariants } from '../../src/lib/engine/compose';

const QUERIES = process.argv.slice(2);

async function main() {
  const catalog = await loadCatalog(getDb(), 0);
  for (const q of QUERIES) {
    const locale = /\b(ik|wil|een|voor|maken|mijn)\b/i.test(q) ? 'nl' : 'en';
    const intent = detectIntent(q, catalog, locale);
    console.log(`\n=== ${q}`);
    console.log(`task=${intent.taskId} (${intent.taskScore.toFixed(2)}, runner-up ${intent.runnerUpTaskId}) conf=${intent.confidence} caps=${intent.capabilityIds.join(',')} tools=${intent.toolIds.map((id) => catalog.toolsById.get(id)?.slug).join(',')}`);
    console.log('constraints', JSON.stringify(intent.constraints));
    const task = intent.taskId ? catalog.tasksById.get(intent.taskId)! : intent.capabilityIds.length ? adHocTask(intent.capabilityIds) : null;
    if (!task) continue;
    const v = composeVariants(catalog, task, intent.constraints);
    for (const [name, r] of Object.entries(v)) {
      const line = r.steps
        .map((s) => `${s.key}:${s.toolId ? catalog.toolsById.get(s.toolId)!.slug : s.skipped}${s.sharedFromStep ? '(shared)' : ''}`)
        .join('  ');
      const paid = r.totals.core.paid.map((m) => `${(m.cents / 100).toFixed(2)} ${m.currency}`).join(' + ') || '0';
      console.log(`  ${name.padEnd(11)} ${line}  | paid ${paid} (≈€${r.totals.core.paidEurCents === null ? '?' : (r.totals.core.paidEurCents / 100).toFixed(0)}) budget=${JSON.stringify(r.budget)} relaxed=${r.relaxed}`);
    }
  }
}
main().finally(() => closeDb());
