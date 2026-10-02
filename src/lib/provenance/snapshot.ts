/**
 * Tool snapshot: the denormalised "current values" on the `tools` row, derived
 * from current facts (valid_to IS NULL) and current pricing plans. Reads use
 * the snapshot; provenance stays in facts/pricing_plans.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import {
  facts,
  pricingPlans,
  toolCapabilities,
  toolI18n,
  toolRelations,
  tools,
  type BillingPeriod,
  type FactStatus,
  type Freshness,
  type NewTool,
  type PricingModel,
  type PriceUnit,
  type ToolStatus,
} from '@/lib/db/schema';
import type { Settings } from '@/lib/settings/defaults';
import { freshnessOf, toolFreshness } from './freshness';
import { computeQuality } from '@/lib/quality/score';

export interface SnapshotFact {
  key: string;
  value: unknown;
  status: FactStatus;
  confidence: number;
  observedAt: Date;
  verifiedAt: Date | null;
}

export interface SnapshotPlan {
  planKey: string;
  name: string;
  position: number;
  priceCents: number | null;
  currency: string | null;
  billingPeriod: BillingPeriod;
  priceUnit: PriceUnit;
  monthlyEquivalentCents: number | null;
  isFree: boolean;
  isCustom: boolean;
  status: FactStatus;
  confidence: number;
  observedAt: Date;
  verifiedAt: Date | null;
}

export interface SnapshotInput {
  facts: SnapshotFact[];
  plans: SnapshotPlan[];
  currentStatus: ToolStatus;
  websiteCheckedAt: Date | null;
  published: boolean;
  locales: string[];
  primaryCapabilities: number;
  alternatives: number;
  websiteStatus: 'up' | 'down' | 'unknown';
}

const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const strArray = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;

function maxDate(dates: (Date | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
}

export function derivePricingModel(plans: SnapshotPlan[], openSource: boolean | null): PricingModel {
  if (openSource) return 'open_source';
  if (plans.length === 0) return 'unknown';
  const hasFree = plans.some((p) => p.isFree);
  const paid = plans.filter((p) => !p.isFree && !p.isCustom && (p.priceCents ?? 0) > 0);
  const custom = plans.filter((p) => p.isCustom);
  if (hasFree && paid.length > 0) return 'freemium';
  if (hasFree && custom.length > 0) return 'freemium';
  if (hasFree) return 'free';
  if (paid.length > 0) return 'paid';
  return 'contact';
}

/** The cheapest paid monthly-comparable plan ("from" price). */
export function entryPlan(plans: SnapshotPlan[]): SnapshotPlan | null {
  const candidates = plans
    .filter((p) => !p.isFree && !p.isCustom && p.monthlyEquivalentCents !== null && p.monthlyEquivalentCents > 0 && p.currency)
    .sort((a, b) => (a.monthlyEquivalentCents ?? 0) - (b.monthlyEquivalentCents ?? 0) || a.position - b.position);
  return candidates[0] ?? null;
}

export function computeSnapshot(
  input: SnapshotInput,
  freshnessRules: Settings['freshness'],
  now: Date = new Date(),
): Omit<NewTool, 'slug' | 'name' | 'websiteUrl'> {
  const f = new Map(input.facts.map((x) => [x.key, x]));
  const val = (k: string) => f.get(k)?.value;

  const openSource = bool(val('open_source'));
  const plans = [...input.plans].sort((a, b) => a.position - b.position);
  const entry = entryPlan(plans);
  const hasFreeFact = bool(val('has_free_tier'));
  const hasFreeTier = hasFreeFact ?? (plans.length > 0 ? plans.some((p) => p.isFree) : null);
  const pricingPublicFact = bool(val('pricing_public'));
  const pricingPublic =
    pricingPublicFact ?? (plans.length > 0 ? plans.some((p) => !p.isCustom && p.priceCents !== null) : null);

  const statusFact = val('status');
  const status: ToolStatus =
    typeof statusFact === 'string' &&
    ['active', 'beta', 'waitlist', 'deprecated', 'shutdown', 'unknown'].includes(statusFact)
      ? (statusFact as ToolStatus)
      : input.currentStatus;

  const priceCheckedAt = maxDate(plans.map((p) => p.verifiedAt ?? p.observedAt));
  const priceFreshness: Freshness = plans.length
    ? freshnessOf(priceCheckedAt, 'price', freshnessRules, now)
    : 'unknown';
  const websiteFreshness = freshnessOf(input.websiteCheckedAt, 'website', freshnessRules, now);

  const confidences = plans.length ? plans.map((p) => p.confidence) : input.facts.map((x) => x.confidence);
  const confidence = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0;

  const trains = val('trains_on_user_data');
  const freshness = toolFreshness(priceFreshness, websiteFreshness);
  const lowestPricingStatus = plans.reduce<FactStatus | null>((acc, p) => {
    const rank = { unverified: 0, community: 1, supported: 2, verified: 3 } as const;
    if (!acc) return p.status;
    return rank[p.status] < rank[acc] ? p.status : acc;
  }, null);

  const quality = computeQuality({
    published: input.published,
    status,
    locales: input.locales,
    planCount: plans.length,
    pricingStatus: lowestPricingStatus,
    primaryCapabilities: input.primaryCapabilities,
    alternatives: input.alternatives,
    freshness,
    websiteStatus: input.websiteStatus,
    confidence,
  });

  return {
    status,
    platforms: strArray(val('platforms')) ?? [],
    pricingModel: derivePricingModel(plans, openSource),
    hasFreeTier,
    hasFreeTrial: bool(val('has_free_trial')),
    pricingPublic,
    apiAvailable: bool(val('api_available')),
    openSource,
    selfHostable: bool(val('self_hostable')),
    supportsDutch: bool(val('supports_dutch')),
    euDataResidency: bool(val('eu_data_residency')),
    gdprDpa: bool(val('gdpr_dpa')),
    trainsOnUserData: trains === 'no' || trains === 'opt_out' || trains === 'yes' ? trains : null,
    commercialUseFreeTier: bool(val('commercial_use_free_tier')),
    watermarkFreeTier: bool(val('watermark_free_tier')),
    modelDependencies: strArray(val('model_dependencies')) ?? [],
    entryPriceCents: entry?.monthlyEquivalentCents ?? null,
    entryPriceCurrency: entry?.currency ?? null,
    entryPricePeriod: entry ? 'month' : null,
    entryPlanName: entry?.name ?? null,
    confidence,
    freshness,
    priceCheckedAt,
    lastVerifiedAt: maxDate([...plans.map((p) => p.verifiedAt), ...input.facts.map((x) => x.verifiedAt)]),
    lastCheckedAt: maxDate([priceCheckedAt, input.websiteCheckedAt]),
    qualityScore: quality.score,
    qualityIssues: quality.issues,
    indexable: quality.indexable,
  };
}

/** Load current facts/plans for a tool and write its snapshot. */
export async function recomputeToolSnapshot(
  db: Database,
  toolId: string,
  freshnessRules: Settings['freshness'],
  now: Date = new Date(),
): Promise<void> {
  const [tool] = await db.select().from(tools).where(eq(tools.id, toolId)).limit(1);
  if (!tool) return;
  const currentFacts = await db
    .select()
    .from(facts)
    .where(and(eq(facts.toolId, toolId), isNull(facts.validTo), eq(facts.reviewStatus, 'published')));
  const currentPlans = await db
    .select()
    .from(pricingPlans)
    .where(and(eq(pricingPlans.toolId, toolId), isNull(pricingPlans.validTo), eq(pricingPlans.reviewStatus, 'published')));
  const locales = (await db.select({ locale: toolI18n.locale }).from(toolI18n).where(eq(toolI18n.toolId, toolId))).map(
    (r) => r.locale,
  );
  const [caps] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(toolCapabilities)
    .where(and(eq(toolCapabilities.toolId, toolId), eq(toolCapabilities.strength, 'primary')));
  const [alts] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(toolRelations)
    .where(and(eq(toolRelations.toolId, toolId), eq(toolRelations.kind, 'alternative')));

  const snap = computeSnapshot(
    {
      facts: currentFacts,
      plans: currentPlans,
      currentStatus: tool.status,
      websiteCheckedAt: tool.websiteCheckedAt,
      published: tool.published,
      locales,
      primaryCapabilities: caps?.n ?? 0,
      alternatives: alts?.n ?? 0,
      websiteStatus: tool.websiteStatus,
    },
    freshnessRules,
    now,
  );
  await db
    .update(tools)
    .set({ ...snap, updatedAt: now })
    .where(eq(tools.id, toolId));
}
