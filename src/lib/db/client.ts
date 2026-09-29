/**
 * Database client.
 *
 * Runtime (web + agents): node-postgres pool from DATABASE_URL.
 * Tests: an in-process PGlite instance is injected with `setDb()`.
 *
 * Both drivers produce a Drizzle `PgDatabase`, so all query code is shared.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema';

export type Schema = typeof schema;
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

type GlobalDb = { __aitwDb?: Database; __aitwPool?: pg.Pool };
const g = globalThis as unknown as GlobalDb;

export function getDb(): Database {
  if (g.__aitwDb) return g.__aitwDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and configure PostgreSQL.');
  }
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', (err) => {
    console.error('[db] idle client error', err.message);
  });
  g.__aitwPool = pool;
  g.__aitwDb = drizzle(pool, { schema }) as unknown as Database;
  return g.__aitwDb;
}

/** Inject a database (used by tests with PGlite). */
export function setDb(db: Database | undefined): void {
  g.__aitwDb = db;
}

/** Close the pool (scripts/worker shutdown). */
export async function closeDb(): Promise<void> {
  const pool = g.__aitwPool;
  g.__aitwDb = undefined;
  g.__aitwPool = undefined;
  if (pool) await pool.end();
}

export { schema };
