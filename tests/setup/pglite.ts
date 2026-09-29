/**
 * In-process PostgreSQL (PGlite) with the real migrations applied. Used by
 * integration tests: same SQL, same Drizzle queries as production.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/db/schema';
import { setDb, type Database } from '@/lib/db/client';

export async function createTestDb(): Promise<{ db: Database; client: PGlite; close: () => Promise<void> }> {
  const client = new PGlite();
  const dir = path.resolve(process.cwd(), 'drizzle');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const statements = readFileSync(path.join(dir, file), 'utf8').split('--> statement-breakpoint');
    for (const stmt of statements) if (stmt.trim()) await client.exec(stmt);
  }
  const db = drizzle(client, { schema }) as unknown as Database;
  setDb(db);
  return {
    db,
    client,
    close: async () => {
      setDb(undefined);
      await client.close();
    },
  };
}
