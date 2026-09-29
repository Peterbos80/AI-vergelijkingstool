import { describe, expect, it } from 'vitest';
import { computeSnapshot, derivePricingModel, entryPlan, type SnapshotPlan } from '@/lib/provenance/snapshot';
import { computeQuality } from '@/lib/quality/score';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';
import { monthlyEquivalentCents, toCents, toEurCents } from '@/lib/pricing/money';

const now = new Date('2026-09-29T12:00:00Z');
const plan = (p: Partial<SnapshotPlan>): SnapshotPlan => ({
  planKey: 'x',
  name: 'X',
  position: 0,
  priceCents: null,
  currency: 'USD',
  billingPeriod: 'month',
  priceUnit: 'flat',
  monthlyEquivalentCents: null,
  isFree: false,
  isCustom: false,
  status: 'supported',
  confidence: 60,
  observedAt: now,
  verifiedAt: null,
  ...p,
});

describe('pricing normalisation', () => {
  it('converts major units and periods', () => {
    expect(toCents(18.33)).toBe(1833);
    expect(monthlyEquivalentCents(12000, 'year')).toBe(1000);
    expect(monthlyEquivalentCents(500, 'usage')).toBeNull();
  });
  it('converts to EUR with ECB quotes (1 EUR = rate × quote)', () => {
    expect(toEurCents(2000, 'USD', new Map([['USD', 1.25]]))).toBe(1600);
    expect(toEurCents(2000, 'EUR', new Map())).toBe(2000);
    expect(toEurCents(2000, 'GBP', new Map())).toBeNull();
  });
});

describe('snapshot', () => {
  const plans = [
    plan({ planKey: 'free', name: 'Free', isFree: true, priceCents: 0, monthlyEquivalentCents: 0 }),
    plan({ planKey: 'pro', name: 'Pro', position: 2, priceCents: 2000, monthlyEquivalentCents: 2000 }),
    plan({ planKey: 'starter', name: 'Starter', position: 1, priceCents: 600, monthlyEquivalentCents: 600 }),
    plan({ planKey: 'ent', name: 'Enterprise', position: 3, isCustom: true }),
  ];
  it('derives the pricing model and the cheapest paid entry plan', () => {
    expect(derivePricingModel(plans, null)).toBe('freemium');
    expect(derivePricingModel([plans[3]!], null)).toBe('contact');
    expect(derivePricingModel(plans, true)).toBe('open_source');
    expect(entryPlan(plans)?.name).toBe('Starter');
  });
  it('computes snapshot fields from facts and plans', () => {
    const snap = computeSnapshot(
      {
        facts: [
          { key: 'platforms', value: ['web', 'ios'], status: 'unverified', confidence: 57, observedAt: now, verifiedAt: null },
          { key: 'status', value: 'beta', status: 'supported', confidence: 60, observedAt: now, verifiedAt: null },
        ],
        plans,
        currentStatus: 'active',
        websiteCheckedAt: null,
        published: true,
        locales: ['nl', 'en'],
        primaryCapabilities: 1,
        alternatives: 4,
        websiteStatus: 'unknown',
      },
      DEFAULT_SETTINGS.freshness,
      now,
    );
    expect(snap.status).toBe('beta');
    expect(snap.platforms).toEqual(['web', 'ios']);
    expect(snap.hasFreeTier).toBe(true);
    expect(snap.entryPriceCents).toBe(600);
    expect(snap.entryPlanName).toBe('Starter');
    expect(snap.freshness).toBe('fresh');
    expect(snap.indexable).toEqual({ tool: true, pricing: true, alternatives: true });
  });
});

describe('quality gates', () => {
  const base = {
    published: true,
    status: 'active' as const,
    locales: ['nl', 'en'],
    planCount: 3,
    pricingStatus: 'supported' as const,
    primaryCapabilities: 1,
    alternatives: 3,
    freshness: 'fresh' as const,
    websiteStatus: 'up' as const,
    confidence: 60,
  };
  it('indexes complete pages', () => {
    expect(computeQuality(base).indexable).toEqual({ tool: true, pricing: true, alternatives: true });
  });
  it('keeps thin or unverified pages out of the index', () => {
    expect(computeQuality({ ...base, pricingStatus: 'unverified' }).indexable.pricing).toBe(false);
    expect(computeQuality({ ...base, alternatives: 2 }).indexable.alternatives).toBe(false);
    expect(computeQuality({ ...base, freshness: 'stale' }).indexable.pricing).toBe(false);
    expect(computeQuality({ ...base, published: false }).indexable.tool).toBe(false);
    expect(computeQuality({ ...base, primaryCapabilities: 0 }).indexable.tool).toBe(false);
  });
});
