/**
 * Error log with fingerprinting (one row per fingerprint per day, counted).
 * Never throws: logging must not break the request that failed.
 */
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { errorLog } from '@/lib/db/schema';

type Scope = 'agent' | 'app' | 'api' | 'email' | 'llm';

export function fingerprint(scope: string, message: string, agent?: string | null): string {
  // Normalise volatile parts (numbers, ids, urls) so repeats group together.
  const norm = message
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\d+/g, '<n>')
    .slice(0, 300);
  return createHash('sha256').update(`${scope}|${agent ?? ''}|${norm}`).digest('hex').slice(0, 24);
}

export async function logError(
  scope: Scope,
  message: string,
  err?: unknown,
  opts: { agent?: string; detail?: Record<string, unknown> } = {},
): Promise<void> {
  const errMessage = err instanceof Error ? err.message : err ? String(err) : '';
  const full = errMessage ? `${message}: ${errMessage}` : message;
  if (process.env.NODE_ENV !== 'test') console.error(`[${scope}${opts.agent ? `:${opts.agent}` : ''}] ${full}`);
  try {
    const db = getDb();
    const fp = fingerprint(scope, full, opts.agent);
    const day = new Date().toISOString().slice(0, 10);
    const detail = {
      ...(opts.detail ?? {}),
      ...(err instanceof Error && err.stack ? { stack: err.stack.split('\n').slice(0, 8).join('\n') } : {}),
    };
    await db
      .insert(errorLog)
      .values({ scope, agent: opts.agent ?? null, message: full.slice(0, 1000), detail, fingerprint: fp, day })
      .onConflictDoUpdate({
        target: [errorLog.fingerprint, errorLog.day],
        set: { count: sql`${errorLog.count} + 1`, at: new Date(), detail },
      });
  } catch {
    // The database may be the thing that failed; stderr already has the message.
  }
}
