/**
 * Serve the built app for end-to-end tests against an isolated database:
 * reset + migrate + seed E2E_DATABASE_URL, create the e2e admin, then run
 * `next start`. Requires a prior `next build`. Never touches the dev database.
 *
 *   npm run build && npm run test:e2e        (Playwright starts this script)
 */
import './_env';
import { spawn } from 'node:child_process';

const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://aitw:aitw@localhost:5432/aitoolswijzer_e2e';
const PORT = process.env.E2E_PORT ?? '3200';
const E2E_ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-owner@example.test', password: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-password-not-for-production' };

async function prepare() {
  if (process.env.NODE_ENV === 'production') throw new Error('e2e-serve refuses to run with NODE_ENV=production');
  process.env.DATABASE_URL = E2E_DB;
  const { sql, eq } = await import('drizzle-orm');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const { closeDb, getDb } = await import('../src/lib/db/client');
  const { loadSeedData, seedAsOf } = await import('../src/lib/seed/load');
  const { applySeed } = await import('../src/lib/seed/apply');
  const { adminUsers } = await import('../src/lib/db/schema');
  const { hashPassword } = await import('../src/lib/auth/password');
  const db = getDb();
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: 'drizzle' });
  // Seed "as of" the dataset's date, not today: freshness is stored at seed
  // time, so pages and visual baselines stay the same as the calendar moves on.
  const bundle = loadSeedData();
  await applySeed(db, bundle, seedAsOf(bundle));
  const passwordHash = await hashPassword(E2E_ADMIN.password);
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, E2E_ADMIN.email));
  if (!existing) await db.insert(adminUsers).values({ email: E2E_ADMIN.email, passwordHash, role: 'owner' });
  await closeDb();
  console.log(`[e2e] database ready (${E2E_DB.replace(/:[^:@/]+@/, ':***@')})`);
}

prepare()
  .then(() => {
    const child = spawn('npx', ['next', 'start', '-p', PORT], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: E2E_DB, EMAIL_MODE: 'log', APP_SECRET: process.env.APP_SECRET ?? 'e2e-app-secret-e2e-app-secret-e2e-app-secret', CRON_SECRET: process.env.CRON_SECRET ?? 'e2e-cron-secret-0123456789' },
    });
    const stop = () => child.kill('SIGTERM');
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    child.on('exit', (code) => process.exit(code ?? 0));
  })
  .catch((err) => {
    console.error('[e2e] failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
