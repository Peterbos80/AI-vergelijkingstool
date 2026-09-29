/**
 * Development reset: drop all tables, re-run migrations and re-seed.
 * Refuses to run when NODE_ENV=production.
 */
import './_env';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDb, getDb } from '../src/lib/db/client';
import { loadSeedData } from '../src/lib/seed/load';
import { applySeed } from '../src/lib/seed/apply';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('db:reset is disabled in production');
  const db = getDb();
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: 'drizzle' });
  const report = await applySeed(db, loadSeedData());
  console.log('[reset] done', report);
}

main()
  .catch((err) => {
    console.error('[reset] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
