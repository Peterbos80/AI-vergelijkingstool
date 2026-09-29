/**
 * Fixed-window rate limiting in Postgres (works across instances, no Redis).
 * Returns false when the limit is exceeded.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  try {
    const rows = await queryRows<{ count: number }>(
      getDb(),
      sql`INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${windowStart}, 1)
          ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
          RETURNING count`,
    );
    return Number(rows[0]?.count ?? 0) <= limit;
  } catch {
    // Fail open for availability; abuse is also bounded by other limits.
    return true;
  }
}
