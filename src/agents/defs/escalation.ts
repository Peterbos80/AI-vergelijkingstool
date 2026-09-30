/**
 * Escalation agent (docs/strategy/12 §5): keeps the owner inbox small and
 * meaningful.
 *  1. auto-resolve items whose cause has cleared;
 *  2. apply the safe default action once the deadline passes;
 *  3. expire stale P3 items;
 *  4. detect failing agents (3 consecutive failures → disable + P2);
 *  5. enforce the weekly escalation budget (demote low-priority P2 → P3).
 */
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { agentConfigs, agentRuns, healthChecks, pendingChanges, reviewItems, tools } from '@/lib/db/schema';
import { resolveItem } from '@/lib/ops/inbox';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import { publishPriceChange, type PriceChange } from '../lib/publish-price';
import type { AgentContext, AgentDefinition } from '../types';

type Item = typeof reviewItems.$inferSelect;
type Outcome = 'defaulted' | 'expired' | 'auto_resolved' | 'keep';

const NEVER_DISABLE = new Set(['escalation', 'health']);

async function autoResolvable(ctx: AgentContext, item: Item): Promise<boolean> {
  const { db } = ctx;
  if (item.kind === 'broken_link') {
    const list = Array.isArray(item.payload.items) ? (item.payload.items as { tool: string }[]) : [];
    if (!list.length) return false;
    const rows = await db.select({ slug: tools.slug, st: tools.websiteStatus }).from(tools).where(inArray(tools.slug, list.map((x) => x.tool)));
    return rows.length > 0 && rows.every((r) => r.st !== 'down');
  }
  if (item.kind === 'agent_failing') {
    const agent = String(item.payload.agent ?? '');
    const [last] = await db.select().from(agentRuns).where(eq(agentRuns.agent, agent)).orderBy(desc(agentRuns.startedAt)).limit(1);
    return last?.status === 'success';
  }
  if (item.kind === 'dependency' && typeof item.payload.check === 'string') {
    const [h] = await db.select().from(healthChecks).where(eq(healthChecks.key, item.payload.check));
    return h?.status === 'ok';
  }
  if (item.kind === 'dependency' && item.reasonCode === 'network_suspected') {
    const [last] = await db.select().from(agentRuns).where(eq(agentRuns.agent, 'broken-link')).orderBy(desc(agentRuns.startedAt)).limit(1);
    return last?.status === 'success';
  }
  return false;
}

async function applyDefault(ctx: AgentContext, item: Item): Promise<Outcome> {
  const { db } = ctx;
  switch (item.defaultAction) {
    case 'publish_with_label': {
      const c = item.payload as unknown as PriceChange & { oldCents: number | null; pendingId?: string };
      const r = await publishPriceChange(db, { ...c, evidence: `${c.evidence} [large change, confirmed by repeated measurement; published after the review window]` }, ctx.log, 'auto_published_flagged', 'agent:escalation', ctx.now());
      if (c.pendingId) await db.update(pendingChanges).set({ status: r.published ? 'confirmed' : 'superseded' }).where(eq(pendingChanges.id, c.pendingId));
      if (r.published) await recomputeToolSnapshot(db, c.toolId, ctx.settings.freshness, ctx.now());
      return 'defaulted';
    }
    case 'discard_after_7d': {
      const changes = Array.isArray(item.payload.changes) ? (item.payload.changes as { pendingId?: string }[]) : [];
      const ids = changes.map((c) => c.pendingId).filter((x): x is string => Boolean(x));
      if (ids.length) await db.update(pendingChanges).set({ status: 'expired' }).where(inArray(pendingChanges.id, ids));
      return 'expired';
    }
    case 'keep_old_price_flag':
    case 'keep_published':
    case 'keep_current_value':
    case 'reject_after_30d':
      return 'defaulted';
    case 'auto_resolve_when_up':
    case 'auto_resolve_when_checks_pass':
    case 'keep_open':
      return 'keep';
    default:
      return item.severity === 'p3' ? 'expired' : 'keep';
  }
}

export const escalationAgent: AgentDefinition = {
  name: 'escalation',
  description: 'Applies safe defaults after deadlines, auto-resolves cleared items, detects failing agents and enforces the escalation budget.',
  schedule: 'every:1h',
  autonomy: 'auto',
  maxItems: 200,
  timeoutMs: 5 * 60_000,
  async run(ctx) {
    const { db, settings } = ctx;
    const now = ctx.now();
    let dataChanged = false;
    const pending = await db
      .select()
      .from(reviewItems)
      .where(and(eq(reviewItems.status, 'pending'), or(isNull(reviewItems.snoozedUntil), lte(reviewItems.snoozedUntil, now))))
      .limit(ctx.limits.maxItems);

    for (const item of pending) {
      if (await autoResolvable(ctx, item)) {
        await resolveItem(db, item.id, 'auto_resolved', 'agent:escalation', 'condition cleared');
        ctx.stat('auto_resolved');
        continue;
      }
      const due = item.dueAt && item.dueAt <= now;
      const staleP3 = item.severity === 'p3' && now.getTime() - item.createdAt.getTime() > settings.autonomy.p3ExpiryDays * 86_400_000;
      if (!due && !staleP3) continue;
      const outcome = due ? await applyDefault(ctx, item) : 'expired';
      if (outcome === 'keep') continue;
      if (item.defaultAction === 'publish_with_label') dataChanged = true;
      await resolveItem(db, item.id, outcome, 'agent:escalation', due ? `default action: ${item.defaultAction}` : 'expired (P3 window)', item.defaultAction ?? undefined);
      ctx.stat(outcome);
    }

    // Failing agents → disable (except the safety agents) and escalate once.
    const failing = await db.select().from(agentConfigs).where(gte(agentConfigs.consecutiveFailures, 3));
    for (const a of failing) {
      await ctx.inbox.escalate({
        kind: 'agent_failing',
        severity: 'p2',
        category: 'technical',
        title: `Agent "${a.agent}" failed ${a.consecutiveFailures} times in a row`,
        reasonCode: 'consecutive_failures',
        payload: { agent: a.agent, failures: a.consecutiveFailures, disabled: !NEVER_DISABLE.has(a.agent) },
        defaultAction: 'keep_open',
        dedupeKey: `agent_failing:${a.agent}:${a.lastRunAt?.toISOString().slice(0, 10) ?? 'x'}`,
        createdBy: 'agent:escalation',
      });
      if (!NEVER_DISABLE.has(a.agent) && a.enabled) {
        await db.update(agentConfigs).set({ enabled: false }).where(eq(agentConfigs.agent, a.agent));
        await ctx.log.action({ action: 'agent_disabled', entityType: 'agent', entityId: a.agent, decision: 'auto_published', reason: `${a.consecutiveFailures} consecutive failures` });
      }
      ctx.stat('agents_failing');
    }

    // Escalation budget: keep the owner's weekly P2 load bounded.
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const openP2 = await db
      .select()
      .from(reviewItems)
      .where(and(eq(reviewItems.status, 'pending'), eq(reviewItems.severity, 'p2'), gte(reviewItems.createdAt, weekAgo)))
      .orderBy(desc(reviewItems.priority), desc(reviewItems.createdAt));
    const over = openP2.slice(settings.autonomy.escalationBudgetPerWeek).filter((i) => i.priority < 70 && i.kind !== 'security' && i.kind !== 'legal');
    for (const i of over) {
      await db
        .update(reviewItems)
        .set({ severity: 'p3', payload: sql`${reviewItems.payload} || '{"demotedByBudget": true}'::jsonb`, updatedAt: now })
        .where(eq(reviewItems.id, i.id));
      ctx.stat('demoted_by_budget');
    }
    return { status: 'success', summary: `${pending.length} open items reviewed`, dataChanged };
  },
};
