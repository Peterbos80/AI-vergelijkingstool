/**
 * Publish a confirmed price change: close the current plan row, insert the new
 * one with provenance, create a Pulse event and log a reversible action.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { changeEvents, pricingPlans, type Decision } from '@/lib/db/schema';
import { formatMoney } from '@/i18n/formatters';
import { monthlyEquivalentCents } from '@/lib/pricing/money';
import type { ActionLogger } from '../actions';
import { eventText } from './event-text';

export interface PriceChange {
  toolId: string;
  toolName: string;
  planKey: string;
  newCents: number;
  currency: string;
  evidence: string;
  sourceId: string | null;
  sourceUrl: string | null;
  confidence: number;
  status: 'verified' | 'supported';
}

export async function publishPriceChange(
  db: Database,
  change: PriceChange,
  log: ActionLogger,
  decision: Decision,
  by: string,
  now: Date = new Date(),
): Promise<{ published: boolean; eventId: string | null }> {
  const [current] = await db
    .select()
    .from(pricingPlans)
    .where(and(eq(pricingPlans.toolId, change.toolId), eq(pricingPlans.planKey, change.planKey), isNull(pricingPlans.validTo)))
    .limit(1);
  if (!current) return { published: false, eventId: null };
  if (current.priceCents === change.newCents && current.currency === change.currency) return { published: false, eventId: null };
  await db.update(pricingPlans).set({ validTo: now }).where(eq(pricingPlans.id, current.id));
  const [row] = await db
    .insert(pricingPlans)
    .values({
      toolId: current.toolId,
      planKey: current.planKey,
      name: current.name,
      position: current.position,
      priceCents: change.newCents,
      currency: change.currency,
      billingPeriod: current.billingPeriod,
      priceUnit: current.priceUnit,
      monthlyEquivalentCents: monthlyEquivalentCents(change.newCents, current.billingPeriod),
      annualMonthlyCents: null,
      isFree: change.newCents === 0,
      isCustom: false,
      quota: current.quota,
      status: change.status,
      confidence: change.confidence,
      sourceId: change.sourceId ?? current.sourceId,
      extraSourceIds: [],
      evidence: change.evidence.slice(0, 600),
      method: 'agent',
      observedAt: now,
      verifiedAt: change.status === 'verified' ? now : null,
      validFrom: now,
      createdBy: by,
    })
    .returning({ id: pricingPlans.id });
  const up = current.priceCents !== null && change.newCents > current.priceCents;
  const [ev] = await db
    .insert(changeEvents)
    .values({
      toolId: change.toolId,
      kind: up ? 'price_increase' : 'price_decrease',
      title: eventText('priceChange', (l) => ({
        plan: current.name,
        direction: up ? 'up' : 'down',
        old: formatMoney(current.priceCents, current.currency, l),
        new: formatMoney(change.newCents, change.currency, l),
      })),
      summary: null,
      oldValue: { priceCents: current.priceCents, currency: current.currency },
      newValue: { priceCents: change.newCents, currency: change.currency },
      sourceId: change.sourceId,
      sourceUrl: change.sourceUrl,
      sourceType: 'official',
      occurredAt: now,
      detectedAt: now,
      detectedBy: by,
      confidence: change.confidence,
      significance: 80,
      status: 'published',
      dedupeKey: `price:${change.toolId}:${change.planKey}:${change.newCents}:${now.toISOString().slice(0, 10)}`,
    })
    .onConflictDoNothing({ target: changeEvents.dedupeKey })
    .returning({ id: changeEvents.id });
  await log.action({
    action: 'price_published',
    entityType: 'pricing_plan',
    entityId: row!.id,
    toolId: change.toolId,
    field: `plan:${change.planKey}`,
    oldValue: { priceCents: current.priceCents, currency: current.currency },
    newValue: { priceCents: change.newCents, currency: change.currency, planRowId: row!.id, previousRowId: current.id, eventId: ev?.id ?? null },
    sourceUrl: change.sourceUrl,
    confidence: change.confidence,
    decision,
    reason: up ? 'price_increase' : 'price_decrease',
  });
  return { published: true, eventId: ev?.id ?? null };
}
