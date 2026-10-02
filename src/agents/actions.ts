/**
 * Action ledger: every automated change is recorded with before/after so it
 * can be explained ("what did the system do last night?") and reverted per
 * action or per run (docs/strategy/12 §4.5).
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { affiliateLinks, agentActions, changeEvents, pricingPlans, sources, toolCandidates, toolCapabilities, tools, videos, type Decision } from '@/lib/db/schema';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import { bumpDataVersion, loadSettings, saveSetting } from '@/lib/settings';

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

export function actionLogger(db: Database, runId: string | null, agent: string, now: () => Date = () => new Date()): ActionLogger {
  return {
    action: async (a) => {
      const [row] = await db
        .insert(agentActions)
        .values({
          createdAt: now(),
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
    const v = a.newValue as { planRowId?: string; previousRowId?: string; eventId?: string | null } | null;
    if (!v?.planRowId || !v.previousRowId) return false;
    const [current] = await db.select().from(pricingPlans).where(eq(pricingPlans.id, v.planRowId));
    if (!current || current.validTo !== null) return false; // changed since → conflict, no overwrite
    await db.delete(pricingPlans).where(eq(pricingPlans.id, v.planRowId));
    await db.update(pricingPlans).set({ validTo: null }).where(eq(pricingPlans.id, v.previousRowId));
    if (v.eventId) await db.update(changeEvents).set({ status: 'rejected' }).where(eq(changeEvents.id, v.eventId));
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
  llm_gating_adjusted: async (db, a) => {
    const old = a.oldValue as { gatingThreshold?: number } | null;
    if (typeof old?.gatingThreshold !== 'number') return false;
    const current = await loadSettings(db);
    await saveSetting(db, 'llm', { ...current.llm, gatingThreshold: old.gatingThreshold }, 'revert');
    return true;
  },
  affiliate_link_deactivated: async (db, a) => {
    if (!a.entityId) return false;
    await db.update(affiliateLinks).set({ active: true }).where(eq(affiliateLinks.id, a.entityId));
    return true;
  },
  tool_published: async (db, a) => {
    if (!a.toolId) return false;
    await db.update(tools).set({ published: false, quarantineUntil: null }).where(eq(tools.id, a.toolId));
    return true;
  },
  // Tool scout (docs/strategy/12 §4.4): a tool published in quarantine goes offline again.
  tool_quarantined: async (db, a) => {
    if (!a.toolId) return false;
    const [tool] = await db.select().from(tools).where(eq(tools.id, a.toolId));
    if (!tool?.published) return false;
    await db.update(tools).set({ published: false }).where(eq(tools.id, a.toolId));
    await db.update(changeEvents).set({ status: 'rejected' }).where(and(eq(changeEvents.toolId, a.toolId), eq(changeEvents.kind, 'new_tool')));
    if (tool.discovery?.candidateId) await db.update(toolCandidates).set({ status: 'rejected', notes: 'publication reverted' }).where(eq(toolCandidates.id, tool.discovery.candidateId));
    return true;
  },
  // A depublished tool comes back in quarantine (at least one more day of checks).
  tool_depublished: async (db, a) => {
    const old = a.oldValue as { quarantineUntil?: string | null } | null;
    if (!a.toolId) return false;
    const [tool] = await db.select().from(tools).where(eq(tools.id, a.toolId));
    if (!tool || tool.published) return false;
    const until = old?.quarantineUntil ? new Date(old.quarantineUntil) : null;
    await db
      .update(tools)
      .set({ published: true, quarantineUntil: until && until.getTime() > Date.now() ? until : new Date(Date.now() + 86_400_000) })
      .where(eq(tools.id, a.toolId));
    await db.update(changeEvents).set({ status: 'published' }).where(and(eq(changeEvents.toolId, a.toolId), eq(changeEvents.kind, 'new_tool')));
    if (tool.discovery?.candidateId) await db.update(toolCandidates).set({ status: 'promoted', notes: 'depublication reverted' }).where(eq(toolCandidates.id, tool.discovery.candidateId));
    return true;
  },
  // A promoted tool goes back into quarantine; its main function is secondary again.
  tool_promoted: async (db, a) => {
    const old = a.oldValue as { quarantineUntil?: string | null; primaryCapability?: string | null } | null;
    if (!a.toolId) return false;
    const [tool] = await db.select().from(tools).where(eq(tools.id, a.toolId));
    if (!tool || tool.quarantineUntil !== null) return false;
    const until = old?.quarantineUntil ? new Date(old.quarantineUntil) : null;
    await db
      .update(tools)
      .set({
        quarantineUntil: until && until.getTime() > Date.now() ? until : new Date(Date.now() + 86_400_000),
        discovery: tool.discovery ? { ...tool.discovery, promotedAt: null } : null,
      })
      .where(eq(tools.id, a.toolId));
    if (old?.primaryCapability) {
      await db.update(toolCapabilities).set({ strength: 'secondary' }).where(and(eq(toolCapabilities.toolId, a.toolId), eq(toolCapabilities.capabilityId, old.primaryCapability)));
    }
    return true;
  },
  // A pricing page found on the official home page: the tool goes back to having none; the source is no longer checked.
  pricing_url_found: async (db, a) => {
    const v = a.newValue as { pricingUrl?: string; sourceId?: string } | null;
    if (!a.toolId || !v?.pricingUrl) return false;
    await db.update(tools).set({ pricingUrl: null }).where(and(eq(tools.id, a.toolId), eq(tools.pricingUrl, v.pricingUrl)));
    if (v.sourceId) await db.update(sources).set({ role: 'other' }).where(eq(sources.id, v.sourceId));
    return true;
  },
  video_added: async (db, a) => {
    if (!a.entityId) return false;
    await db.update(videos).set({ status: 'removed' }).where(eq(videos.id, a.entityId));
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
  // Published data changed: refresh the tool snapshot and every cache.
  if (a.toolId) await recomputeToolSnapshot(db, a.toolId, (await loadSettings(db)).freshness, new Date());
  await bumpDataVersion(db, `revert:${by}`);
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
    if ((await revertAction(db, a.id, by)) === 'reverted') reverted++;
    else skipped++;
  }
  return { reverted, skipped };
}

export function isReversible(action: string): boolean {
  return action in REVERTERS;
}
