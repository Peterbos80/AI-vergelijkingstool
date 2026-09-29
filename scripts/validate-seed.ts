/**
 * Validate seed data without touching the database.
 * Usage: npx tsx scripts/validate-seed.ts
 */
import { loadSeedData } from '../src/lib/seed/load';

try {
  const { taxonomy, tools, events, warnings } = loadSeedData();
  const plans = tools.reduce((n, t) => n + t.plans.length, 0);
  const facts = tools.reduce((n, t) => n + Object.keys(t.facts).length, 0);
  const byStatus: Record<string, number> = {};
  for (const t of tools) {
    for (const p of t.plans) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    for (const f of Object.values(t.facts)) if (f) byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
  }
  console.log(
    `OK: ${taxonomy.categories.length} categories, ${taxonomy.capabilities.length} capabilities, ${taxonomy.tasks.length} tasks, ` +
      `${tools.length} tools, ${plans} plans, ${facts} facts, ${events.length} events`,
  );
  console.log('Status distribution:', byStatus);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log('  - ' + w);
  }
} catch (err) {
  console.error('Seed validation failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
