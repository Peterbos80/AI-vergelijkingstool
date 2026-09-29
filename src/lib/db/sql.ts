import type { SQL } from 'drizzle-orm';
import type { Database } from './client';

/**
 * Run raw SQL and return rows. Both drivers we use (node-postgres, PGlite)
 * return `{ rows }`; the generic HKT types it as unknown, so we narrow here.
 */
export async function queryRows<T extends Record<string, unknown>>(db: Database, query: SQL): Promise<T[]> {
  const res = (await db.execute(query)) as unknown as { rows: T[] };
  return res.rows ?? [];
}
