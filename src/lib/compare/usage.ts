/**
 * Usage meters: "what does it cost for my usage?" (docs/strategy/agents/B2 §2).
 *
 * Each meter has an editorial list of tools, and per tool the limit subjects
 * that measure the meter's work ("voice generation" for Murf, "AI" minutes
 * for Happy Scribe). A time limit with another subject (Descript's media hours
 * for audio clean-up, VEED's subtitle hours) is never assigned to the meter.
 *
 * Per tool the result is the cheapest plan whose limit covers the usage, in
 * the vendor's currency and in euros via the ECB reference rate. Plans that
 * cannot be computed keep a reason. Overage (extra usage above a bundle) is
 * not modelled: a heavier usage moves to a bigger plan or out of reach.
 *
 * The order is the computed price only; this module never imports
 * monetisation code (tests/integration/engine.test.ts). Pure: the browser runs
 * computeMeter() with the data buildMeter() prepared at build time.
 */
import type { Catalog, CatalogPlan } from '@/lib/catalog/types';
import type { FactStatus } from '@/lib/db/schema';
import { toEurCents } from '@/lib/pricing/money';
import { parseQuotaClauses, type QuotaClause, type QuotaFlag } from '@/lib/pricing/quota';
import { isEuropeanCountry } from './labels';

export type MeterId = 'transcribe' | 'voiceover' | 'avatar' | 'audio-cleanup' | 'dubbing';

export interface MeterDef {
  id: MeterId;
  /** Unit of the slider and of the price per unit. */
  unit: 'hour' | 'minute';
  /** Slider range and starting value, in `unit`. */
  min: number;
  max: number;
  step: number;
  initial: number;
  /** Task pages that show this meter. */
  tasks: string[];
  /**
   * Editorial list. `subjects`: the limit subjects (as parsed, lower case;
   * null = a plain "300 minutes per month") that measure this meter's work for
   * that tool. An empty list keeps the tool visible with the reason its
   * limits do not count.
   */
  tools: { slug: string; subjects: (string | null)[] }[];
}

export const METERS: readonly MeterDef[] = [
  {
    id: 'transcribe',
    unit: 'hour',
    min: 1,
    max: 100,
    step: 1,
    initial: 10,
    tasks: ['transcribe-audio', 'automatic-meeting-notes'],
    tools: [
      { slug: 'amberscript', subjects: [null, 'audio'] },
      { slug: 'happy-scribe', subjects: ['ai'] },
      { slug: 'otter', subjects: [null] },
      { slug: 'turboscribe', subjects: ['transcription'] },
      // Descript's media hours are the audio and video it transcribes.
      { slug: 'descript', subjects: ['media'] },
    ],
  },
  {
    id: 'voiceover',
    unit: 'minute',
    min: 5,
    max: 600,
    step: 5,
    initial: 60,
    tasks: ['create-ai-voiceovers'],
    tools: [
      { slug: 'murf', subjects: ['voice generation'] },
      { slug: 'elevenlabs', subjects: [] },
    ],
  },
  {
    id: 'avatar',
    unit: 'minute',
    min: 1,
    max: 120,
    step: 1,
    initial: 10,
    tasks: ['training-videos-ai-presenter'],
    tools: [
      { slug: 'synthesia', subjects: [null, 'video'] },
      { slug: 'heygen', subjects: [] },
      { slug: 'colossyan', subjects: [] },
    ],
  },
  {
    id: 'audio-cleanup',
    unit: 'hour',
    min: 1,
    max: 100,
    step: 1,
    initial: 10,
    tasks: ['clean-up-audio'],
    tools: [
      { slug: 'auphonic', subjects: [null, 'processed audio'] },
      { slug: 'adobe-podcast', subjects: ['enhance speech'] },
      // Descript's media hours are not clean-up hours (Studio Sound is a plan feature without its own limit).
      { slug: 'descript', subjects: [] },
    ],
  },
  {
    id: 'dubbing',
    unit: 'minute',
    min: 5,
    max: 600,
    step: 5,
    initial: 30,
    tasks: ['translate-and-dub-videos'],
    tools: [
      { slug: 'rask-ai', subjects: [null] },
      { slug: 'heygen', subjects: [] },
      { slug: 'elevenlabs', subjects: [] },
    ],
  },
];

export function meterById(id: string): MeterDef | undefined {
  return METERS.find((m) => m.id === id);
}

export function metersForTask(taskId: string): MeterDef[] {
  return METERS.filter((m) => m.tasks.includes(taskId));
}

/** Why a plan cannot be computed for a meter. */
export type SkipReason =
  | 'price_on_request'
  | 'not_monthly'
  | 'no_limit'
  | 'daily_only'
  | 'weekly_only'
  | 'one_off'
  | 'credits'
  | 'other_feature'
  | 'not_time';

export interface MeterPlan {
  key: string;
  name: string;
  /** allowance: a fixed number of minutes per month; unlimited: as the maker calls it; usage: priced per use. */
  kind: 'allowance' | 'unlimited' | 'usage';
  /** allowance: minutes per month included. */
  minutes: number | null;
  approximate: boolean;
  perUser: boolean;
  /** allowance/unlimited: price per month (one user); usage: price of `usageMinutes` of use. Minor units of `currency`. */
  priceCents: number;
  /** "annual" when the limit belongs to the annual plan ("(annual plan)") and `priceCents` is its monthly price. */
  billing: 'monthly' | 'annual';
  usageMinutes: number | null;
  /** Monthly price when billed annually, if published. */
  annualMonthlyCents: number | null;
  currency: string;
  status: FactStatus;
  /** YYYY-MM-DD of the observation. */
  observedAt: string;
  quota: string | null;
  flags: QuotaFlag[];
}

export interface SkippedPlan {
  key: string;
  name: string;
  reason: SkipReason;
  quota: string | null;
  status: FactStatus;
  observedAt: string;
}

export interface MeterTool {
  slug: string;
  name: string;
  country: string | null;
  european: boolean;
  plans: MeterPlan[];
  skipped: SkippedPlan[];
}

export interface FxData {
  /** ECB reference day (YYYY-MM-DD) or null when no rates are loaded. */
  day: string | null;
  /** 1 EUR = rate × currency. */
  rates: Record<string, number>;
}

export interface MeterData {
  id: MeterId;
  unit: 'hour' | 'minute';
  min: number;
  max: number;
  step: number;
  initial: number;
  tools: MeterTool[];
  fx: FxData;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const isTime = (c: QuotaClause) => c.unit === 'minute' || c.unit === 'hour';

type Classified = { ok: true; plan: MeterPlan } | { ok: false; reason: SkipReason };

/** Can this plan be computed for a meter whose work the given subjects measure? */
export function classifyPlan(p: CatalogPlan, subjects: readonly (string | null)[]): Classified {
  if (p.isCustom || p.period === 'custom' || (p.priceCents === null && !p.isFree)) return { ok: false, reason: 'price_on_request' };
  if (p.period === 'one_time') return { ok: false, reason: 'not_monthly' };
  const counts = (c: QuotaClause) => subjects.includes(c.subject);
  const clauses = parseQuotaClauses(p.quota);
  const base = {
    key: p.key,
    name: p.name,
    annualMonthlyCents: p.annualMonthlyCents,
    currency: p.currency ?? 'EUR',
    status: p.status,
    observedAt: day(p.observedAt),
    quota: p.quota,
    perUser: p.unit === 'per_user' || p.unit === 'per_seat',
  };
  const price = p.isFree ? 0 : p.priceCents!;

  if (p.period === 'usage') {
    const usage = clauses.find((c) => c.kind === 'usage_price' && isTime(c) && counts(c));
    if (!usage || (p.currency && usage.price!.currency !== p.currency)) return { ok: false, reason: p.quota ? 'not_time' : 'no_limit' };
    return {
      ok: true,
      plan: { ...base, kind: 'usage', minutes: null, approximate: false, priceCents: price, billing: 'monthly', usageMinutes: usage.minutes, flags: usage.flags },
    };
  }

  const monthly = p.period === 'year' ? (p.monthlyCents ?? Math.round(price / 12)) : price;
  if (!p.quota) return { ok: false, reason: 'no_limit' };
  const allowance = clauses.find((c) => c.kind === 'allowance' && isTime(c) && counts(c) && c.minutesPerMonth !== null);
  if (allowance) {
    // "96 hours … per year (annual plan)": the limit comes with the annual plan, so its price is the annual one.
    const annual = allowance.flags.includes('annual_plan') && p.annualMonthlyCents !== null;
    return {
      ok: true,
      plan: {
        ...base,
        kind: 'allowance',
        minutes: allowance.minutesPerMonth,
        approximate: allowance.approximate,
        perUser: base.perUser || allowance.perUser,
        priceCents: annual ? p.annualMonthlyCents! : monthly,
        billing: annual ? 'annual' : 'monthly',
        usageMinutes: null,
        flags: allowance.flags,
      },
    };
  }
  const unlimited = clauses.find((c) => c.kind === 'unlimited' && counts(c));
  if (unlimited) {
    return {
      ok: true,
      plan: { ...base, kind: 'unlimited', minutes: null, approximate: false, priceCents: monthly, billing: 'monthly', usageMinutes: null, flags: [] },
    };
  }
  if (clauses.some((c) => c.per === 'day')) return { ok: false, reason: 'daily_only' };
  if (clauses.some((c) => c.per === 'week')) return { ok: false, reason: 'weekly_only' };
  if (clauses.some((c) => c.per === 'total' && (!isTime(c) || counts(c)))) return { ok: false, reason: 'one_off' };
  if (clauses.some(isTime)) return { ok: false, reason: 'other_feature' };
  if (clauses.some((c) => c.unit === 'credit') || /\bcredits?\b/i.test(p.quota)) return { ok: false, reason: 'credits' };
  return { ok: false, reason: 'not_time' };
}

/** Meter data for the browser: every number with its plan, status and date (build time). */
export function buildMeter(catalog: Catalog, def: MeterDef): MeterData {
  const tools: MeterTool[] = [];
  const currencies = new Set<string>();
  for (const entry of def.tools) {
    const tool = catalog.toolsBySlug.get(entry.slug);
    if (!tool || tool.status === 'shutdown') continue;
    const plans: MeterPlan[] = [];
    const skipped: SkippedPlan[] = [];
    for (const p of [...tool.plans].sort((a, b) => a.position - b.position)) {
      const c = classifyPlan(p, entry.subjects);
      if (c.ok) {
        plans.push(c.plan);
        currencies.add(c.plan.currency);
      } else skipped.push({ key: p.key, name: p.name, reason: c.reason, quota: p.quota, status: p.status, observedAt: day(p.observedAt) });
    }
    tools.push({ slug: tool.slug, name: tool.name, country: tool.companyCountry, european: isEuropeanCountry(tool.companyCountry), plans, skipped });
  }
  const rates: Record<string, number> = {};
  for (const cur of currencies) {
    const r = catalog.fx.rates.get(cur.toUpperCase());
    if (r) rates[cur.toUpperCase()] = r;
  }
  return { id: def.id, unit: def.unit, min: def.min, max: def.max, step: def.step, initial: def.initial, tools, fx: { day: catalog.fx.day, rates } };
}

export interface PlanCost {
  plan: MeterPlan;
  /** Monthly cost for this usage, minor units of the plan's currency. */
  cents: number;
  /** The same in euro cents via the ECB rate; null without a rate. */
  eurCents: number | null;
}

export interface ToolCost {
  tool: MeterTool;
  /** Cheapest plan that covers the usage. */
  best: PlanCost | null;
  /** Largest computable allowance (minutes per month) when no plan covers the usage. */
  maxMinutes: number | null;
}

export interface MeterResult {
  /** Usage in minutes per month. */
  minutes: number;
  /** Covered and converted to euros: cheapest first (computed price only). */
  ranked: ToolCost[];
  /** Covered, but no ECB rate for the currency: in the vendor's currency, cheapest first per currency. */
  unconverted: ToolCost[];
  /** Computable plans exist, but none covers the usage. */
  notCovered: ToolCost[];
  /** No plan of the tool can be computed for this meter. */
  notComputable: MeterTool[];
  /** Lowest euro cost among `ranked` (the "cheapest for your usage" label). */
  cheapestEurCents: number | null;
}

export function eurFor(cents: number, currency: string, fx: FxData): number | null {
  if (cents === 0) return 0;
  return toEurCents(cents, currency, new Map(Object.entries(fx.rates)));
}

/** Cost of one plan for `minutes` per month, or null when it does not cover them. */
export function planCost(plan: MeterPlan, minutes: number): number | null {
  if (plan.kind === 'usage') return plan.usageMinutes ? Math.round((plan.priceCents * minutes) / plan.usageMinutes) : null;
  if (plan.kind === 'unlimited') return plan.priceCents;
  return plan.minutes !== null && plan.minutes >= minutes ? plan.priceCents : null;
}

const byName = (a: { tool: MeterTool }, b: { tool: MeterTool }) => a.tool.name.localeCompare(b.tool.name, 'en', { sensitivity: 'base' });

export function computeMeter(data: MeterData, minutes: number): MeterResult {
  const ranked: ToolCost[] = [];
  const unconverted: ToolCost[] = [];
  const notCovered: ToolCost[] = [];
  const notComputable: MeterTool[] = [];
  for (const tool of data.tools) {
    if (!tool.plans.length) {
      notComputable.push(tool);
      continue;
    }
    let best: PlanCost | null = null;
    for (const plan of tool.plans) {
      const cents = planCost(plan, minutes);
      if (cents === null) continue;
      const eurCents = eurFor(cents, plan.currency, data.fx);
      const cheaper =
        !best ||
        (plan.currency === best.plan.currency
          ? cents < best.cents
          : eurCents !== null && (best.eurCents === null || eurCents < best.eurCents));
      if (cheaper) best = { plan, cents, eurCents };
    }
    if (!best) {
      const caps = tool.plans.map((p) => p.minutes).filter((m): m is number => m !== null);
      notCovered.push({ tool, best: null, maxMinutes: caps.length ? Math.max(...caps) : null });
    } else if (best.eurCents === null) unconverted.push({ tool, best, maxMinutes: null });
    else ranked.push({ tool, best, maxMinutes: null });
  }
  ranked.sort((a, b) => a.best!.eurCents! - b.best!.eurCents! || byName(a, b));
  unconverted.sort((a, b) => a.best!.plan.currency.localeCompare(b.best!.plan.currency) || a.best!.cents - b.best!.cents || byName(a, b));
  notCovered.sort(byName);
  notComputable.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return {
    minutes,
    ranked,
    unconverted,
    notCovered,
    notComputable,
    cheapestEurCents: ranked.length ? ranked[0]!.best!.eurCents : null,
  };
}

/** Plan counts per meter: computable plans, and skipped plans with their reason (owner report, tests). */
export function meterCoverage(data: MeterData): { computable: string[]; skipped: { plan: string; reason: SkipReason }[] } {
  return {
    computable: data.tools.flatMap((t) => t.plans.map((p) => `${t.slug}/${p.key}`)),
    skipped: data.tools.flatMap((t) => t.skipped.map((s) => ({ plan: `${t.slug}/${s.key}`, reason: s.reason }))),
  };
}
