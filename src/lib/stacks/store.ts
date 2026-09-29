/**
 * Saved stacks ("receipts"): shareable by public id, editable with a secret
 * token kept in an httpOnly cookie (no account needed).
 */
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { stackItems, stacks } from '@/lib/db/schema';
import { publicId, token } from '@/lib/ids';
import type { StackResult } from '@/lib/engine/compose';
import type { Constraints } from '@/lib/engine/intent';

export interface StackSnapshot {
  result: StackResult;
  title: string;
  engine: 'lexical' | 'llm';
  /** Prices at save time, for the Stack Diff. */
  prices: Record<string, { planKey: string | null; cents: number | null; currency: string | null; status: string }>;
}

export function hashToken(t: string): string {
  return createHash('sha256').update(t).digest('hex');
}

export async function saveStack(input: {
  locale: string;
  origin: 'match' | 'doctor' | 'manual';
  taskId: string | null;
  queryText: string | null;
  constraints: Constraints;
  snapshot: StackSnapshot;
}): Promise<{ publicId: string; token: string }> {
  const db = getDb();
  const id = publicId(10);
  const secret = token(24);
  const [row] = await db
    .insert(stacks)
    .values({
      publicId: id,
      editTokenHash: hashToken(secret),
      title: input.snapshot.title.slice(0, 200),
      locale: input.locale,
      origin: input.origin,
      taskId: input.taskId,
      queryText: input.queryText,
      constraints: input.constraints as Record<string, unknown>,
      snapshot: input.snapshot as unknown as Record<string, unknown>,
    })
    .returning({ id: stacks.id });
  const items = input.snapshot.result.steps
    .filter((s) => s.toolId && !s.sharedFromStep)
    .map((s, i) => ({ stackId: row!.id, toolId: s.toolId!, stepKey: s.key, position: i }));
  if (items.length) await db.insert(stackItems).values(items).onConflictDoNothing();
  return { publicId: id, token: secret };
}

export async function getStack(publicIdValue: string) {
  if (!/^[0-9a-z]{6,16}$/.test(publicIdValue)) return null;
  const [row] = await getDb().select().from(stacks).where(eq(stacks.publicId, publicIdValue)).limit(1);
  if (!row) return null;
  return { ...row, snapshot: row.snapshot as unknown as StackSnapshot };
}

/* ───────── "My stacks" cookie: publicId.token pairs (httpOnly) ───────── */

export const MY_STACKS_COOKIE = 'aitw_my';

export function parseMyStacks(raw: string | undefined): { id: string; token: string }[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (!Array.isArray(list)) return [];
    return list
      .filter((x): x is string => typeof x === 'string' && /^[0-9a-z]{6,16}\.[\w-]{20,64}$/.test(x))
      .map((x) => {
        const [id, tok] = x.split('.') as [string, string];
        return { id, token: tok };
      })
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function serializeMyStacks(list: { id: string; token: string }[]): string {
  return Buffer.from(JSON.stringify(list.slice(0, 20).map((x) => `${x.id}.${x.token}`)), 'utf8').toString('base64url');
}
