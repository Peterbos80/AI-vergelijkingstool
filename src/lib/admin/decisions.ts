/**
 * What "approve" and "reject" mean for each inbox item kind. Owner decisions
 * go through the same code paths as the agents (publishPriceChange, revert,
 * promote) and are recorded in the action ledger and the audit log.
 */
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { affiliatePrograms, agentActions, pendingChanges, toolCandidates, type ReviewItem } from '@/lib/db/schema';
import { actionLogger, revertAction } from '@/agents/actions';
import { publishPriceChange, type PriceChange } from '@/agents/lib/publish-price';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import { bumpDataVersion, loadSettings, saveSetting } from '@/lib/settings';
import { resolveItem } from '@/lib/ops/inbox';
import type { AdminUser } from '@/lib/auth/session';
import { promoteCandidate } from './candidates';

type Item = ReviewItem;
type Change = PriceChange & { oldCents: number | null; pendingId?: string };

export type DecisionResult = { ok: true; redirectTo?: string } | { ok: false; reason: 'conflict' | 'not_pending' };

async function publish(db: Database, c: Change, by: string): Promise<boolean> {
  const log = actionLogger(db, null, 'owner');
  const r = await publishPriceChange(db, c, log, 'auto_published', by, new Date());
  if (c.pendingId) await db.update(pendingChanges).set({ status: r.published ? 'confirmed' : 'superseded' }).where(eq(pendingChanges.id, c.pendingId));
  if (r.published) await recomputeToolSnapshot(db, c.toolId, (await loadSettings(db)).freshness, new Date());
  return r.published;
}

async function discard(db: Database, changes: Change[]): Promise<void> {
  const ids = changes.map((c) => c.pendingId).filter((x): x is string => Boolean(x));
  if (ids.length) await db.update(pendingChanges).set({ status: 'superseded' }).where(inArray(pendingChanges.id, ids));
}

/** Revert the most recent un-reverted price publication for a tool plan. */
async function revertPublished(db: Database, c: { toolId: string; planKey: string }, by: string): Promise<boolean> {
  const [a] = await db
    .select()
    .from(agentActions)
    .where(and(eq(agentActions.action, 'price_published'), eq(agentActions.toolId, c.toolId), eq(agentActions.field, `plan:${c.planKey}`), isNull(agentActions.revertedAt)))
    .orderBy(desc(agentActions.createdAt))
    .limit(1);
  return a ? (await revertAction(db, a.id, by)) === 'reverted' : false;
}

export async function applyDecision(db: Database, item: Item, decision: 'approve' | 'reject', user: AdminUser, note: string | null): Promise<DecisionResult> {
  if (item.status !== 'pending') return { ok: false, reason: 'not_pending' };
  const by = `owner:${user.email}`;
  let redirectTo: string | undefined;
  let changed = false;

  switch (item.kind) {
    case 'price_change': {
      if (item.reasonCode === 'flagged_for_post_check') {
        // Already published; "reject" undoes the publication(s).
        const list = (Array.isArray(item.payload.items) ? item.payload.items : [item.payload]) as Change[];
        if (decision === 'reject') for (const c of list) changed = (await revertPublished(db, c, by)) || changed;
      } else {
        const c = item.payload as unknown as Change;
        if (decision === 'approve') changed = await publish(db, c, by);
        else await discard(db, [c]);
      }
      break;
    }
    case 'anomaly_freeze': {
      const list = (Array.isArray(item.payload.changes) ? item.payload.changes : []) as Change[];
      if (decision === 'approve') for (const c of list) changed = (await publish(db, c, by)) || changed;
      else await discard(db, list);
      break;
    }
    case 'new_tool': {
      const candidateId = typeof item.payload.candidateId === 'string' ? item.payload.candidateId : null;
      if (candidateId && decision === 'approve') {
        const r = await promoteCandidate(db, candidateId);
        if (r) redirectTo = `/admin/tools/${r.toolId}?flash=draftCreated`;
      } else if (candidateId) {
        await db.update(toolCandidates).set({ status: 'rejected', notes: 'rejected by owner' }).where(eq(toolCandidates.id, candidateId));
      }
      break;
    }
    case 'opportunity': {
      // Affiliate coverage: record the owner's choice so the question is not repeated.
      if (item.reasonCode === 'affiliate_coverage' && item.toolId) {
        const [existing] = await db.select().from(affiliatePrograms).where(eq(affiliatePrograms.toolId, item.toolId)).limit(1);
        const status = decision === 'approve' ? 'applied' : 'rejected';
        if (existing) await db.update(affiliatePrograms).set({ status, notes: note ?? existing.notes }).where(eq(affiliatePrograms.id, existing.id));
        else await db.insert(affiliatePrograms).values({ toolId: item.toolId, network: 'unknown', status, notes: note });
      }
      break;
    }
    case 'autonomy_proposal': {
      if (decision === 'approve' && item.reasonCode === 'precision_below_target') {
        const s = await loadSettings(db);
        const autoPublish = Math.min(100, s.policy.autoPublish + 2);
        await saveSetting(db, 'policy', { ...s.policy, autoPublish, autoFlag: Math.min(autoPublish, s.policy.autoFlag + 2) }, by);
      }
      break;
    }
    case 'broken_link': {
      // Affiliate link: "reject" means the link is fine → re-activate it.
      if (decision === 'reject' && item.reasonCode === 'affiliate_link_broken') {
        const [a] = await db
          .select()
          .from(agentActions)
          .where(and(eq(agentActions.action, 'affiliate_link_deactivated'), eq(agentActions.entityId, String(item.payload.linkId ?? '')), isNull(agentActions.revertedAt)))
          .orderBy(desc(agentActions.createdAt))
          .limit(1);
        if (a) changed = (await revertAction(db, a.id, by)) === 'reverted';
      }
      break;
    }
    default:
      break; // acknowledgement only
  }
  if (changed) await bumpDataVersion(db, by);
  await resolveItem(db, item.id, decision === 'approve' ? 'approved' : 'rejected', by, note ?? undefined, decision);
  return { ok: true, redirectTo };
}
