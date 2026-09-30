/**
 * Action ledger: every automated change is recorded with before/after so it
 * can be explained ("what did the system do last night?") and reverted per
 * action or per run (docs/strategy/12 §4.5).
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { agentActions, changeEvents, pricingPlans, tools, type Decision } from '@/lib/db/schema';

export interface ActionInput {
  action: string;
  entityType?: string;
  entityId?: string;
  toolId?: string | null;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  sourceUrl?: string | null;
  confidence?: number | null;
  decision: Decision;
  reason?: string;
}

export interface ActionLogger {
  action: (input: ActionInput) => Promise<string>;
}

export function actionLogger(db: Database, runId: string | null, agent: string): ActionLogger {
  return {
    action: async (a) => {
      const [row] = await db
        .insert(agentActions)
        .values({
          runId,
          agent,
          action: a.action,
          entityType: a.entityType ?? null,
          entityId: a.entityId ?? null,
          toolId: a.toolId ?? null,
          field: a.field ?? null,
          oldValue: (a.oldValue ?? null) as never,
          newValue: (a.newValue ?? null) as never,
          sourceUrl: a.sourceUrl ?? null,
          confidence: a.confidence ?? null,
          decision: a.decision,
          reason: a.reason ?? null,
        })
        .returning({ id: agentActions.id });
      return row!.id;
    },
  };
}

type Reverter = (db: Database, action: typeof agentActions.$inferSelect) => Promise<boolean>;

/** Inverse operations for reversible actions. Unknown actions are not reverted. */
const REVERTERS: Record<string, Reverter> = {
  // A published price change: remove the new plan row and reopen the previous one.
  price_published: async (db, a) => {
    const v = a.newValue as { planRowId?: string; previousRowId?: string } | null;
    if (!v?.planRowId || !v.previousRowId) return false;
    const [current] = await db.select().from(pricingPlans).where(eq(pricingPlans.id, v.planRowId));
    if (!current || current.validTo !== null) return false; // changed since → conflict, no overwrite
    await db.delete(pricingPlans).where(eq(pricingPlans.id, v.planRowId));
    await db.update(pricingPlans).set({ validTo: null }).where(eq(pricingPlans.id, v.previousRowId));
    return true;
  },
  // A plan confirmed on the official page: restore its previous provenance.
  plan_verified: async (db, a) => {
    const old = a.oldValue as { status: string; confidence: number; verifiedAt: string | null; evidence: string | null } | null;
    if (!old || !a.entityId) return false;
    await db
      .update(pricingPlans)
      .set({
        status: old.status as never,
        confidence: old.confidence,
        verifiedAt: old.verifiedAt ? new Date(old.verifiedAt) : null,
        evidence: old.evidence,
      })
      .where(and(eq(pricingPlans.id, a.entityId), isNull(pricingPlans.validTo)));
    return true;
  },
  event_published: async (db, a) => {
    if (!a.entityId) return false;
    await db.update(changeEvents).set({ status: 'rejected' }).where(eq(changeEvents.id, a.entityId));
    return true;
  },
  website_status: async (db, a) => {
    const old = a.oldValue as { websiteStatus: 'up' | 'down' | 'unknown'; unreachableSince: string | null } | null;
    if (!old || !a.toolId) return false;
    await db
      .update(tools)
      .set({ websiteStatus: old.websiteStatus, unreachableSince: old.unreachableSince ? new Date(old.unreachableSince) : null })
      .where(eq(tools.id, a.toolId));
    return true;
  },
};

export async function revertAction(db: Database, actionId: string, by: string): Promise<'reverted' | 'not_reversible' | 'already' | 'conflict'> {
  const [a] = await db.select().from(agentActions).where(eq(agentActions.id, actionId));
  if (!a) return 'not_reversible';
  if (a.revertedAt) return 'already';
  const fn = REVERTERS[a.action];
  if (!fn) return 'not_reversible';
  const ok = await fn(db, a);
  if (!ok) return 'conflict';
  await db.update(agentActions).set({ revertedAt: new Date(), revertedBy: by }).where(eq(agentActions.id, actionId));
  return 'reverted';
}

/** Revert every reversible action of a run, newest first. */
export async function revertRun(db: Database, runId: string, by: string): Promise<{ reverted: number; skipped: number }> {
  const list = await db.select().from(agentActions).where(eq(agentActions.runId, runId)).orderBy(desc(agentActions.createdAt));
  let reverted = 0;
  let skipped = 0;
  for (const a of list) {
    if (!REVERTERS[a.action] || a.revertedAt) {
      skipped++;
      continue;
    }
    (await revertAction(db, a.id, by)) === 'reverted' ? reverted++ : skipped++;
  }
  return { reverted, skipped };
}

export function isReversible(action: string): boolean {
  return action in REVERTERS;
}
