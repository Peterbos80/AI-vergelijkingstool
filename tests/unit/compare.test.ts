/**
 * Unique comparisons (src/lib/compare): usage meters, team costs, the EU
 * selection and the computed labels, on small hand-made catalogs. The real
 * seed is covered in tests/integration/compare.test.ts.
 */
import { describe, expect, it } from 'vitest';
import type { Catalog, CatalogPlan, CatalogTool } from '@/lib/catalog/types';
import { buildMeter, classifyPlan, computeMeter, type MeterDef } from '@/lib/compare/usage';
import { buildTeam, computeTeam } from '@/lib/compare/team';
import { euAlternatives } from '@/lib/compare/eu';
import { freeCheckRow } from '@/lib/compare/free';
import { isEuropeanCountry, isTrulyFree } from '@/lib/compare/labels';

const observedAt = new Date('2026-09-29T00:00:00Z');

function plan(key: string, price: number | null, quota: string | null, extra: Partial<CatalogPlan> = {}): CatalogPlan {
  return {
    key,
    name: key[0]!.toUpperCase() + key.slice(1),
    position: 0,
    priceCents: price === null ? null : Math.round(price * 100),
    currency: 'USD',
    period: 'month',
    unit: 'flat',
    monthlyCents: price === null ? null : Math.round(price * 100),
    annualMonthlyCents: null,
    isFree: price === 0,
    isCustom: false,
    quota,
    status: 'supported',
    confidence: 70,
    observedAt,
    verifiedAt: null,
    pendingChange: false,
    ...extra,
  };
}

function tool(slug: string, extra: Partial<CatalogTool> = {}): CatalogTool {
  return {
    id: `id-${slug}`,
    slug,
    name: slug.replace(/(^|-)(\w)/g, (_, s: string, c: string) => (s ? ' ' : '') + c.toUpperCase()),
    aliases: [],
    websiteUrl: `https://${slug}.example`,
    pricingUrl: null,
    githubRepo: null,
    companyName: null,
    companyCountry: null,
    status: 'active',
    skillLevel: 'beginner',
    audience: [],
    platforms: [],
    pricingModel: 'freemium',
    hasFreeTier: null,
    hasFreeTrial: null,
    apiAvailable: null,
    openSource: null,
    selfHostable: null,
    supportsDutch: null,
    euDataResidency: null,
    gdprDpa: null,
    trainsOnUserData: null,
    commercialUseFreeTier: null,
    watermarkFreeTier: null,
    modelDependencies: [],
    entryPriceCents: null,
    entryPriceCurrency: null,
    entryPlanName: null,
    confidence: 70,
    freshness: 'fresh',
    priceCheckedAt: observedAt,
    lastCheckedAt: observedAt,
    lastChangedAt: null,
    websiteStatus: 'up',
    unreachableSince: null,
    quarantineUntil: null,
    logo: null,
    qualityScore: 80,
    indexable: { tool: true, pricing: true, alternatives: true },
    text: {},
    capabilities: [],
    plans: [],
    facts: {},
    pricingStatus: 'supported',
    alternatives: [],
    relations: [],
    ...extra,
  };
}

function catalog(tools: CatalogTool[], rates: Record<string, number> = {}): Catalog {
  return {
    version: 1,
    loadedAt: observedAt,
    tools,
    toolsBySlug: new Map(tools.map((t) => [t.slug, t])),
    toolsById: new Map(tools.map((t) => [t.id, t])),
    categories: [],
    categoriesById: new Map(),
    capabilities: [],
    capabilitiesById: new Map(),
    tasks: [],
    tasksById: new Map(),
    fx: { day: Object.keys(rates).length ? '2026-09-30' : null, rates: new Map(Object.entries(rates)) },
    events: [],
    stats: { tools: tools.length, facts: 0, plans: 0, sources: 0, supportedShare: 1, checked30dShare: 1, lastCheckAt: null },
  };
}

const METER: MeterDef = {
  id: 'transcribe',
  unit: 'hour',
  min: 1,
  max: 100,
  step: 1,
  initial: 10,
  tasks: [],
  tools: [
    { slug: 'eu-scribe', subjects: [null, 'audio'] },
    { slug: 'us-scribe', subjects: ['ai'] },
    { slug: 'unlimited-scribe', subjects: ['transcription'] },
    { slug: 'credit-scribe', subjects: [] },
  ],
};

const tools = [
  tool('eu-scribe', {
    companyCountry: 'NL',
    plans: [
      plan('payg', 10, '€10 per audio hour', { currency: 'EUR', period: 'usage', unit: 'usage', monthlyCents: null }),
      plan('starter', 19, '300 minutes per month', { currency: 'EUR' }),
      plan('pro', 29, '600 minutes per month', { currency: 'EUR' }),
      plan('custom', null, null, { isCustom: true, currency: null, period: 'custom' }),
    ],
  }),
  tool('us-scribe', {
    companyCountry: 'US',
    plans: [plan('free', 0, '30 AI minutes per month'), plan('pro', 20, '600 AI minutes per month', { annualMonthlyCents: 1500 }), plan('daily', 5, '1 hour per day')],
  }),
  tool('unlimited-scribe', { companyCountry: 'US', plans: [plan('unlimited', 25, 'Unlimited transcription')] }),
  tool('credit-scribe', { plans: [plan('basic', 9, '5,000 credits per month')] }),
];

describe('usage meters', () => {
  it('classifies plans and gives the reason when a plan cannot be computed', () => {
    expect(classifyPlan(plan('x', null, null, { isCustom: true }), [null])).toEqual({ ok: false, reason: 'price_on_request' });
    expect(classifyPlan(plan('x', 9, null), [null])).toEqual({ ok: false, reason: 'no_limit' });
    expect(classifyPlan(plan('x', 9, 'Enhance Speech 1 hour per day'), ['enhance speech'])).toEqual({ ok: false, reason: 'daily_only' });
    expect(classifyPlan(plan('x', 9, '2 AI minutes per week'), ['ai'])).toEqual({ ok: false, reason: 'weekly_only' });
    expect(classifyPlan(plan('x', 0, '10 minutes of voice generation in total'), ['voice generation'])).toEqual({ ok: false, reason: 'one_off' });
    expect(classifyPlan(plan('x', 9, '30,000 credits per month'), [])).toEqual({ ok: false, reason: 'credits' });
    expect(classifyPlan(plan('x', 9, '3 videos per month, max 1 minute'), [null])).toEqual({ ok: false, reason: 'not_time' });
    // A time limit that measures something else never counts for the meter.
    expect(classifyPlan(plan('x', 9, 'About 10 hours of media per user per month'), [])).toEqual({ ok: false, reason: 'other_feature' });
    expect(classifyPlan(plan('x', 9, '1080p, auto subtitles (144 hours/year)'), [null, 'video'])).toEqual({ ok: false, reason: 'other_feature' });
  });

  it('uses the annual price when the limit belongs to the annual plan', () => {
    const c = classifyPlan(plan('business', 99, '96 hours of voice generation per year (annual plan)', { annualMonthlyCents: 6600 }), ['voice generation']);
    expect(c).toMatchObject({ ok: true, plan: { minutes: 480, priceCents: 6600, billing: 'annual' } });
  });

  it('picks the cheapest plan that covers the usage, per tool, and ranks by euro price only', () => {
    const data = buildMeter(catalog(tools, { USD: 1.25 }), METER);
    const at10h = computeMeter(data, 600);
    expect(at10h.ranked.map((r) => [r.tool.slug, r.best!.plan.key, r.best!.eurCents])).toEqual([
      ['us-scribe', 'pro', 1600], // $20 / 1.25
      ['unlimited-scribe', 'unlimited', 2000], // $25 / 1.25
      ['eu-scribe', 'pro', 2900], // €29 (pay as you go would be €100)
    ]);
    expect(at10h.cheapestEurCents).toBe(1600);
    expect(at10h.notComputable.map((t) => t.slug)).toEqual(['credit-scribe']);

    const at20min = computeMeter(data, 20);
    expect(at20min.ranked[0]).toMatchObject({ tool: { slug: 'us-scribe' }, best: { cents: 0, eurCents: 0 } });
    // Pay as you go, pro rata: 20 minutes of €10 per hour.
    expect(at20min.ranked.find((r) => r.tool.slug === 'eu-scribe')!.best).toMatchObject({ cents: 333 });

    const at30h = computeMeter(data, 1800);
    expect(at30h.ranked.map((r) => r.tool.slug)).toEqual(['unlimited-scribe', 'eu-scribe']);
    expect(at30h.ranked.find((r) => r.tool.slug === 'eu-scribe')!.best!.plan.key).toBe('payg');
    expect(at30h.notCovered.map((r) => [r.tool.slug, r.maxMinutes])).toEqual([['us-scribe', 600]]);
  });

  it('keeps plans without an ECB rate out of the euro ranking', () => {
    const data = buildMeter(catalog(tools), METER);
    const r = computeMeter(data, 600);
    expect(r.ranked.map((x) => x.tool.slug)).toEqual(['eu-scribe']);
    expect(r.unconverted.map((x) => [x.tool.slug, x.best!.cents])).toEqual([
      ['us-scribe', 2000],
      ['unlimited-scribe', 2500],
    ]);
    expect(data.fx).toEqual({ day: null, rates: {} });
  });

  it('carries status, date and the limit text of every plan', () => {
    const data = buildMeter(catalog(tools, { USD: 1.25 }), METER);
    const p = data.tools.find((t) => t.slug === 'us-scribe')!.plans.find((x) => x.key === 'pro')!;
    expect(p).toMatchObject({ status: 'supported', observedAt: '2026-09-29', quota: '600 AI minutes per month', annualMonthlyCents: 1500, currency: 'USD' });
    expect(data.tools.find((t) => t.slug === 'us-scribe')!.skipped).toEqual([
      { key: 'daily', name: 'Daily', reason: 'daily_only', quota: '1 hour per day', status: 'supported', observedAt: '2026-09-29' },
    ]);
  });
});

describe('team costs', () => {
  const assistants = [
    tool('alpha-chat', {
      capabilities: [{ id: 'chat-assistant', strength: 'primary' }],
      plans: [plan('team', 25, 'Two-seat minimum', { unit: 'per_seat', annualMonthlyCents: 2000 })],
    }),
    tool('beta-chat', {
      companyCountry: 'FR',
      capabilities: [{ id: 'chat-assistant', strength: 'primary' }],
      plans: [plan('team', 30, '2–10 seats', { unit: 'per_user' }), plan('enterprise', 39, 'Annual billing only', { unit: 'per_seat', annualMonthlyCents: 3900 })],
    }),
  ];
  const data = buildTeam(catalog(assistants, { USD: 1 }));
  const group = data.groups.find((g) => g.id === 'assistants')!;

  it('builds groups from per-user and per-seat plans with their seat rules', () => {
    expect(group.plans.map((p) => [p.tool, p.key, p.minSeats, p.maxSeats, p.annualOnly, p.monthlyCents])).toEqual([
      ['alpha-chat', 'team', 2, null, false, 2500],
      ['beta-chat', 'team', 2, 10, false, 3000],
      ['beta-chat', 'enterprise', null, null, true, null],
    ]);
  });

  it('multiplies users by the price, applies the seat minimum and compares monthly with annual billing', () => {
    const one = computeTeam(group, data.fx, 1, 'monthly');
    expect(one.ranked.map((r) => [r.plan.tool, r.seats, r.monthlyPerYear, r.annualPerYear, r.savingPerYear])).toEqual([
      ['alpha-chat', 2, 60000, 48000, 12000],
      ['beta-chat', 2, 72000, null, null],
    ]);
    // Annual billing only: no monthly price, listed after the ranked rows.
    expect(one.unknown.map((r) => r.plan.key)).toEqual(['enterprise']);
    expect(one.unconverted).toEqual([]);

    const annual = computeTeam(group, data.fx, 5, 'annual');
    expect(annual.ranked.map((r) => [r.plan.tool, r.plan.key, r.eurPerYear])).toEqual([
      ['alpha-chat', 'team', 120000],
      ['beta-chat', 'enterprise', 234000],
    ]);
    expect(annual.unknown.map((r) => r.plan.key)).toEqual(['team']);

    const many = computeTeam(group, data.fx, 12, 'monthly');
    expect(many.tooMany.map((p) => `${p.tool}/${p.key}`)).toEqual(['beta-chat/team']);
  });
});

describe('EU alternatives and labels', () => {
  const us = tool('us-video', { companyCountry: 'US', capabilities: [{ id: 'video-editing', strength: 'primary' }, { id: 'transcription', strength: 'primary' }] });
  const de = tool('de-video', {
    companyCountry: 'DE',
    entryPriceCents: 1500,
    entryPriceCurrency: 'EUR',
    capabilities: [{ id: 'video-editing', strength: 'primary' }, { id: 'transcription', strength: 'primary' }],
  });
  const gb = tool('gb-scribe', { companyCountry: 'GB', entryPriceCents: 900, entryPriceCurrency: 'USD', capabilities: [{ id: 'transcription', strength: 'primary' }] });
  const ch = tool('ch-scribe', { companyCountry: 'CH', capabilities: [{ id: 'transcription', strength: 'secondary' }] });
  const unknown = tool('nowhere', { capabilities: [{ id: 'transcription', strength: 'primary' }] });
  const cat = catalog([us, de, gb, ch, unknown], { USD: 1.2 });

  it('lists European companies with shared primary capabilities, by overlap and then entry price', () => {
    const alts = euAlternatives(cat, us)!;
    expect(alts.map((a) => [a.tool.slug, a.overlap, a.shared])).toEqual([
      ['de-video', 1, ['video-editing', 'transcription']],
      ['gb-scribe', 0.5, ['transcription']],
    ]);
    expect(alts[1]!.entryEurCents).toBe(750);
  });

  it('shows nothing for European companies or an unknown country', () => {
    expect(euAlternatives(cat, de)).toBeNull();
    expect(euAlternatives(cat, unknown)).toBeNull();
  });

  it('knows which countries are European (EU/EEA, UK, Switzerland)', () => {
    expect(['NL', 'DE', 'GB', 'CH', 'NO', 'lt'].every(isEuropeanCountry)).toBe(true);
    expect(['US', 'CA', 'IL', 'AU', 'CN'].some(isEuropeanCountry)).toBe(false);
    expect(isEuropeanCountry(null)).toBe(false);
  });

  it('"truly usable for free" needs both facts known', () => {
    const free = [plan('free', 0, '10 exports per month')];
    expect(isTrulyFree(tool('a', { plans: free, watermarkFreeTier: false, commercialUseFreeTier: true }))).toBe(true);
    expect(isTrulyFree(tool('b', { plans: free, watermarkFreeTier: null, commercialUseFreeTier: true }))).toBe(false);
    expect(isTrulyFree(tool('c', { plans: free, watermarkFreeTier: false, commercialUseFreeTier: null }))).toBe(false);
    expect(isTrulyFree(tool('d', { plans: [plan('pro', 9, null)], watermarkFreeTier: false, commercialUseFreeTier: true }))).toBe(false);
  });

  it('free check rows keep unknown as unknown, never no', () => {
    const row = freeCheckRow(tool('e', { plans: [plan('free', 0, '3 files per day')], watermarkFreeTier: true }));
    expect(row).toMatchObject({ free: 'yes', limit: '3 files per day', limitPer: 'day', watermark: true, commercialUse: null, creditCard: null, trulyFree: false });
    expect(freeCheckRow(tool('f', { hasFreeTier: false, plans: [plan('pro', 9, null)] }))).toMatchObject({ free: 'no', watermark: null });
    expect(freeCheckRow(tool('g', { plans: [plan('pro', 9, null)] }))).toMatchObject({ free: 'unknown', watermark: null });
    const card = freeCheckRow(
      tool('h', {
        plans: [plan('free', 0, null)],
        facts: { credit_card_free_tier: { value: false, status: 'supported', confidence: 70, observedAt, verifiedAt: null } },
      }),
    );
    expect(card.creditCard).toBe(false);
  });
});
