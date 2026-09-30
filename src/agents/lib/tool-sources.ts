/** Source bookkeeping shared by fetching agents. */
import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { sources, sourceSnapshots } from '@/lib/db/schema';
import type { FetchResult } from '../fetcher/types';
import { contentHash } from '../fetcher/text';

export async function recordFetch(
  db: Database,
  sourceId: string,
  res: FetchResult,
  text?: string,
  now: Date = new Date(),
): Promise<{ changed: boolean; hash: string | null }> {
  if (!res.ok) {
    const [s] = await db.select().from(sources).where(eq(sources.id, sourceId));
    await db
      .update(sources)
      .set({
        lastFetchedAt: now,
        lastStatus: res.status,
        lastError: `${res.errorKind ?? 'error'}: ${res.error ?? ''}`.slice(0, 300),
        failureCount: (s?.failureCount ?? 0) + 1,
        failingSince: s?.failingSince ?? now,
        robotsAllowed: res.errorKind === 'robots' ? false : (s?.robotsAllowed ?? null),
      })
      .where(eq(sources.id, sourceId));
    return { changed: false, hash: null };
  }
  const hash = text !== undefined ? contentHash(text) : null;
  const [s] = await db.select().from(sources).where(eq(sources.id, sourceId));
  const changed = Boolean(hash && s?.lastContentHash && s.lastContentHash !== hash);
  if (hash && (changed || !s?.lastContentHash) && text !== undefined) {
    await db.insert(sourceSnapshots).values({
      sourceId,
      fetchedAt: now,
      httpStatus: res.status,
      contentHash: hash,
      textLength: text.length,
      text: text.slice(0, 200_000),
      changed,
    });
  }
  await db
    .update(sources)
    .set({ lastFetchedAt: now, lastStatus: res.status, lastError: null, failureCount: 0, failingSince: null, robotsAllowed: true, lastContentHash: hash ?? s?.lastContentHash ?? null })
    .where(eq(sources.id, sourceId));
  return { changed, hash };
}

export async function toolSource(db: Database, toolId: string, role: 'pricing' | 'website' | 'changelog' | 'rss') {
  const [s] = await db.select().from(sources).where(and(eq(sources.toolId, toolId), eq(sources.role, role))).limit(1);
  return s ?? null;
}
