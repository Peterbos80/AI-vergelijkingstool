/**
 * Seed / sync the catalog from /data (see src/lib/seed/apply.ts for semantics).
 *
 *   npm run db:seed            insert new tools, upsert taxonomy, add events
 *   npm run db:seed -- --dry   validate only
 *   npm run db:seed -- --fresh remove catalog data first (refused in production)
 */
import './_env';
import { closeDb, getDb } from '../src/lib/db/client';
import { loadSeedData } from '../src/lib/seed/load';
import { applySeed, catalogCounts, truncateCatalog } from '../src/lib/seed/apply';

async function main() {
  const args = new Set(process.argv.slice(2));
  const bundle = loadSeedData();
  for (const w of bundle.warnings) console.warn(`[seed] warning: ${w}`);
  console.log(
    `[seed] validated: ${bundle.taxonomy.categories.length} categories, ${bundle.taxonomy.capabilities.length} capabilities, ` +
      `${bundle.taxonomy.tasks.length} tasks, ${bundle.tools.length} tools, ${bundle.events.length} events`,
  );
  if (args.has('--dry')) return;

  const db = getDb();
  if (args.has('--fresh')) {
    if (process.env.NODE_ENV === 'production' && !args.has('--yes-i-know')) {
      throw new Error('--fresh deletes catalog history; refusing in production without --yes-i-know');
    }
    console.log('[seed] removing existing catalog data');
    await truncateCatalog(db);
  }
  const started = Date.now();
  const report = await applySeed(db, bundle);
  console.log('[seed] done in', Date.now() - started, 'ms', report);
  console.log('[seed] totals', await catalogCounts(db));
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
