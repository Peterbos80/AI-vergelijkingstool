/**
 * Sponsored placements (docs/strategy/09 §4): clearly labelled slots that are
 * separate from every recommendation, ranking and comparison. A placement
 * never changes which tools are recommended or their order.
 *
 * RANKING INDEPENDENCE: nothing in src/lib/engine may import this module.
 */
import { and, eq, gt, lte, ne } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { placements } from '@/lib/db/schema';
import { readDataVersion } from '@/lib/settings';

/** Slots that are actually rendered (home page block, newsletter line). Only these can be sold. */
export const PLACEMENT_SLOTS = ['home_sponsored', 'newsletter'] as const;
export type Slot = (typeof PLACEMENT_SLOTS)[number];

export interface ActivePlacement {
  id: string;
  toolId: string;
  message: Partial<Record<string, string>>;
}

interface State {
  version: number;
  checkedAt: number;
  rows: (typeof placements.$inferSelect)[];
}
const g = globalThis as unknown as { __aitwPlacements?: State };
const TTL = 15_000;

async function load(): Promise<(typeof placements.$inferSelect)[]> {
  const now = Date.now();
  const cur = g.__aitwPlacements;
  if (cur && now - cur.checkedAt < TTL) return cur.rows;
  const db = getDb();
  const version = await readDataVersion(db);
  if (cur && cur.version === version && now - cur.checkedAt < 10 * 60_000) {
    cur.checkedAt = now;
    return cur.rows;
  }
  const rows = await db
    .select()
    .from(placements)
    .where(and(ne(placements.status, 'cancelled'), gt(placements.endsAt, new Date(now))));
  g.__aitwPlacements = { version, checkedAt: now, rows };
  return rows;
}

/** The placement running now in a slot (earliest start wins), or null. */
export async function activePlacement(slot: Slot, at: Date = new Date()): Promise<ActivePlacement | null> {
  try {
    const rows = (await load()).filter((p) => p.slot === slot && p.startsAt <= at && p.endsAt > at).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const p = rows[0];
    return p ? { id: p.id, toolId: p.toolId, message: p.message } : null;
  } catch {
    return null; // a sponsor slot must never break a page
  }
}

/** Direct query variant for agents (their own DB handle and clock). */
export async function activePlacementFrom(db: ReturnType<typeof getDb>, slot: Slot, at: Date): Promise<ActivePlacement | null> {
  const [p] = await db
    .select()
    .from(placements)
    .where(and(eq(placements.slot, slot), ne(placements.status, 'cancelled'), lte(placements.startsAt, at), gt(placements.endsAt, at)))
    .orderBy(placements.startsAt)
    .limit(1);
  return p ? { id: p.id, toolId: p.toolId, message: p.message } : null;
}
