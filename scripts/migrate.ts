/**
 * Apply SQL migrations from ./drizzle to DATABASE_URL.
 * Usage: npm run db:migrate
 */
import './_env';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDb, getDb } from '../src/lib/db/client';

async function main() {
  const db = getDb();
  const started = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: 'drizzle' });
  console.log(`[migrate] done in ${Date.now() - started} ms`);
}

main()
  .catch((err) => {
    console.error('[migrate] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
