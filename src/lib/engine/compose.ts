/**
 * Stack composer: task steps → tools + plans, with three variants:
 *   recommended  balanced fit, quality, price and simplicity
 *   budget       cheapest viable stack (free plans first)
 *   fewest       as few tools as possible (greedy step coverage)
 *
 * RANKING INDEPENDENCE: this module never imports monetisation code; affiliate
 * programmes and sponsoring have no input here (tests/integration/engine.test.ts).
 */
import type { Catalog, CatalogPlan, CatalogTask, CatalogTaskStep, CatalogTool } from '@/lib/catalog/types';
import { toEurCents } from '@/lib/pricing/money';
import type { Constraints } from './intent';

export type Variant = 'recommended' | 'budget' | 'fewest';

export type ReasonCode =
  | { code: 'primary'; capabilityId: string }
  | { code: 'secondary'; capabilityId: string }
  | { code: 'free_plan' }
  | { code: 'within_budget' }
  | { code: 'beginner' }
  | { code: 'covers_steps'; steps: string[] }
  | { code: 'dutch' }
  | { code: 'eu' }
  | { code: 'no_training' }
  | { code: 'checked_price' }
  | { code: 'open_source' }
  | { code: 'self_hostable' }
  | { code: 'api' }
  | { code: 'platform'; platform: string }
  | { code: 'cheaper' }
  | { code: 'easier' };

export type LimitationCode =
  | { code: 'watermark_free' }
  | { code: 'no_commercial_free' }
  | { code: 'no_free_plan' }
  | { code: 'unknown_price' }
  | { code: 'stale' }
  | { code: 'unverified_price' }
  | { code: 'beta' }
  | { code: 'relaxed'; constraint: string }
  | { code: 'text'; text: string };

export interface StepPick {
  key: string;
  required: boolean;
  capabilityIds: string[];
  chosenCapabilityId: string | null;
  toolId: string | null;
  planKey: string | null;
  /** Earlier step that already uses this tool (shown as "in <tool>"). */
  sharedFromStep: string | null;
  score: number;
  reasons: ReasonCode[];
  limitations: LimitationCode[];
  alternatives: { toolId: string; reason: ReasonCode | null }[];
  skipped: 'optional' | 'no_candidate' | null;
}

export interface StackLine {
  toolId: string;
  steps: string[];
  /** All steps of this line are optional. */
  optional: boolean;
  planKey: string | null;
  /** Monthly cost of the recommended paid plan (× team size when per user). */
  paidCents: number | null;
  /** Monthly cost to start (free plan if available). */
  startCents: number | null;
  currency: string | null;
  freePlanAvailable: boolean;
  perUser: boolean;
}

export interface Money {
  currency: string;
  cents: number;
}

export interface Totals {
  start: Money[];
  paid: Money[];
  startEurCents: number | null;
  paidEurCents: number | null;
}

export interface StackResult {
  version: 1;
  taskId: string | null;
  variant: Variant;
  steps: StepPick[];
  lines: StackLine[];
  /** core = required steps only; all = including optional steps. */
  totals: { core: Totals; all: Totals; fxDay: string | null };
  budget: { limitCents: number; currency: string; paidWithin: boolean | null; startWithin: boolean | null } | null;
  relaxed: string[];
  confidence: number;
}

/* ───────────── Plans ───────────── */

export function freePlan(tool: CatalogTool): CatalogPlan | null {
  return tool.plans.find((p) => p.isFree) ?? null;
}

export function entryPaidPlan(tool: CatalogTool): CatalogPlan | null {
  return (
    tool.plans
      .filter((p) => !p.isFree && !p.isCustom && p.monthlyCents !== null && p.monthlyCents > 0 && p.currency)
      .sort((a, b) => a.monthlyCents! - b.monthlyCents! || a.position - b.position)[0] ?? null
  );
}

function seats(plan: CatalogPlan | null, c: Constraints): number {
  return plan && (plan.unit === 'per_user' || plan.unit === 'per_seat') ? Math.max(1, c.teamSize ?? 1) : 1;
}

interface Costing {
  planKey: string | null;
  paidCents: number | null;
  startCents: number | null;
  currency: string | null;
  free: CatalogPlan | null;
  entry: CatalogPlan | null;
  perUser: boolean;
}

function costing(tool: CatalogTool, c: Constraints, variant: Variant): Costing {
  const free = freePlan(tool);
  const entry = entryPaidPlan(tool);
  const useFree = Boolean(free) && (c.freeOnly || variant === 'budget' || !entry);
  const plan = useFree ? free : (entry ?? free ?? tool.plans.find((p) => p.isCustom) ?? null);
  const currency = entry?.currency ?? free?.currency ?? null;
  const paid = c.freeOnly ? (free ? 0 : null) : entry ? entry.monthlyCents! * seats(entry, c) : free ? 0 : null;
  const start = free ? 0 : paid;
  return {
    planKey: plan?.key ?? null,
    paidCents: variant === 'budget' && free ? 0 : paid,
    startCents: start,
    currency,
    free,
    entry,
    perUser: Boolean(entry && seats(entry, c) > 1),
  };
}

function eur(cents: number | null, currency: string | null, rates: ReadonlyMap<string, number>): number | null {
  if (cents === null) return null;
  if (cents === 0) return 0;
  if (!currency) return null;
  return toEurCents(cents, currency, rates);
}

/**
 * Comparable amount for *ranking only*: EUR when an ECB rate is known,
 * otherwise the nominal amount (currency parity). Never shown to users; the
 * displayed totals stay per currency when no rate is available.
 */
function rankAmount(cents: number | null, currency: string | null, rates: ReadonlyMap<string, number>): number | null {
  if (cents === null) return null;
  return eur(cents, currency, rates) ?? cents;
}

/* ───────────── Candidates and scoring ───────────── */

const LEVEL = { beginner: 0, intermediate: 1, advanced: 2 } as const;

type Filter = { key: string; test: (t: CatalogTool) => boolean };

function hardFilters(c: Constraints): Filter[] {
  const f: Filter[] = [];
  if (c.freeOnly) f.push({ key: 'freeOnly', test: (t) => Boolean(freePlan(t)) || t.hasFreeTier === true });
  if (c.eu) f.push({ key: 'eu', test: (t) => t.euDataResidency === true });
  if (c.dutch) f.push({ key: 'dutch', test: (t) => t.supportsDutch === true });
  if (c.platform) f.push({ key: 'platform', test: (t) => t.platforms.includes(c.platform!) });
  if (c.openSource) f.push({ key: 'openSource', test: (t) => t.openSource === true });
  if (c.api) f.push({ key: 'api', test: (t) => t.apiAvailable === true || t.platforms.includes('api') });
  if (c.local) f.push({ key: 'local', test: (t) => t.selfHostable === true });
  if (c.level === 'beginner') f.push({ key: 'level', test: (t) => LEVEL[t.skillLevel] <= LEVEL.intermediate });
  return f;
}

function usable(t: CatalogTool, c: Constraints): boolean {
  if (t.status === 'shutdown' || t.status === 'deprecated' || t.status === 'waitlist') return false;
  if (c.avoidToolIds?.includes(t.id)) return false;
  return true;
}

function stepCapabilities(step: CatalogTaskStep, c: Constraints): string[] {
  const chosen = c.approach?.[step.key];
  return chosen && step.capabilityIds.includes(chosen) ? [chosen] : step.capabilityIds;
}

function strengthFor(tool: CatalogTool, caps: string[]): { capabilityId: string; strength: 'primary' | 'secondary' } | null {
  const hits = tool.capabilities.filter((x) => caps.includes(x.id));
  if (!hits.length) return null;
  const primary = hits.find((x) => x.strength === 'primary');
  return primary ? { capabilityId: primary.id, strength: 'primary' } : { capabilityId: hits[0]!.id, strength: 'secondary' };
}

interface Scored {
  tool: CatalogTool;
  score: number;
  cost: Costing;
  eurPaid: number | null;
  reasons: ReasonCode[];
  limitations: LimitationCode[];
  capabilityId: string;
}

function scoreTool(
  tool: CatalogTool,
  caps: string[],
  task: CatalogTask,
  stepKey: string,
  c: Constraints,
  variant: Variant,
  rates: ReadonlyMap<string, number>,
  chosenIds: Set<string>,
): Scored | null {
  const fit = strengthFor(tool, caps);
  if (!fit) return null;
  const reasons: ReasonCode[] = [];
  const limitations: LimitationCode[] = [];
  let score = fit.strength === 'primary' ? 35 : 16;
  reasons.push({ code: fit.strength, capabilityId: fit.capabilityId });

  const cost = costing(tool, c, variant);
  const eurPaid = rankAmount(cost.paidCents, cost.currency, rates);
  const priceWeight = variant === 'budget' ? 36 : 12;
  if (eurPaid !== null) score += priceWeight * (1 - Math.min(1, eurPaid / 6000));
  else score -= 4;
  if (cost.free) {
    score += variant === 'budget' ? 18 : 6;
    reasons.push({ code: 'free_plan' });
  } else {
    limitations.push({ code: 'no_free_plan' });
  }

  score += tool.confidence * 0.12;
  score += { fresh: 4, aging: 1, stale: -6, unknown: -2 }[tool.freshness];
  if (tool.freshness === 'stale') limitations.push({ code: 'stale' });
  if (tool.pricingStatus === 'verified' || tool.pricingStatus === 'supported') {
    score += tool.pricingStatus === 'verified' ? 4 : 2;
    reasons.push({ code: 'checked_price' });
  } else if (tool.pricingStatus === 'unverified' || tool.pricingStatus === 'community') {
    limitations.push({ code: 'unverified_price' });
  } else {
    score -= 3;
    limitations.push({ code: 'unknown_price' });
  }

  const lvl = LEVEL[tool.skillLevel];
  if (c.level === 'beginner') score += lvl === 0 ? 8 : lvl === 1 ? 0 : -10;
  else if (c.level === 'advanced') score += lvl === 2 ? 3 : 0;
  else score += lvl === 0 ? 2 : 0;
  if (tool.skillLevel === 'beginner' && c.level === 'beginner') reasons.push({ code: 'beginner' });

  if (c.dutch) score += tool.supportsDutch ? 8 : tool.supportsDutch === false ? -8 : 0;
  if (tool.supportsDutch && c.dutch) reasons.push({ code: 'dutch' });
  if (c.eu) score += tool.euDataResidency ? 8 : -4;
  if (tool.euDataResidency && c.eu) reasons.push({ code: 'eu' });
  if (c.privacy) {
    score += tool.trainsOnUserData === 'no' ? 6 : tool.trainsOnUserData === 'yes' ? -8 : 0;
    if (tool.trainsOnUserData === 'no') reasons.push({ code: 'no_training' });
    if (tool.selfHostable) score += 4;
  }
  if (c.local && tool.selfHostable) {
    score += 10;
    reasons.push({ code: 'self_hostable' });
  }
  if (c.openSource && tool.openSource) reasons.push({ code: 'open_source' });
  if (c.api && (tool.apiAvailable || tool.platforms.includes('api'))) {
    score += 4;
    reasons.push({ code: 'api' });
  }
  if (c.platform && tool.platforms.includes(c.platform)) {
    score += 5;
    reasons.push({ code: 'platform', platform: c.platform });
  }
  const onFree = cost.planKey !== null && cost.free?.key === cost.planKey;
  if (onFree && tool.watermarkFreeTier === true) {
    score -= c.noWatermark ? 20 : 6;
    limitations.push({ code: 'watermark_free' });
  }
  if (onFree && c.commercial && tool.commercialUseFreeTier === false) {
    score -= 6;
    limitations.push({ code: 'no_commercial_free' });
  }
  if (tool.status === 'beta') {
    score -= 2;
    limitations.push({ code: 'beta' });
  }

  // Simplicity: tools that also cover other required steps.
  const covers = task.steps
    .filter((s) => s.key !== stepKey && s.required)
    .filter((s) => tool.capabilities.some((x) => x.strength === 'primary' && s.capabilityIds.includes(x.id)))
    .map((s) => s.key);
  score += covers.length * (variant === 'fewest' ? 20 : 5);
  if (covers.length) reasons.push({ code: 'covers_steps', steps: covers });
  if (chosenIds.has(tool.id)) score += variant === 'fewest' ? 40 : 12;

  return { tool, score: Math.round(score * 10) / 10, cost, eurPaid, reasons, limitations, capabilityId: fit.capabilityId };
}

function candidatesFor(
  catalog: Catalog,
  step: CatalogTaskStep,
  task: CatalogTask,
  c: Constraints,
  variant: Variant,
  chosenIds: Set<string>,
  relaxed: Set<string>,
): Scored[] {
  const caps = stepCapabilities(step, c);
  const base = catalog.tools.filter((t) => usable(t, c) && strengthFor(t, caps));
  let pool = base;
  for (const f of hardFilters(c)) {
    const next = pool.filter(f.test);
    if (next.length === 0) {
      if (step.required) relaxed.add(f.key);
    } else pool = next;
  }
  return pool
    .map((t) => scoreTool(t, caps, task, step.key, c, variant, catalog.fx.rates, chosenIds))
    .filter((x): x is Scored => x !== null)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
}

/* ───────────── Composition ───────────── */

function altReason(chosen: Scored, alt: Scored): ReasonCode | null {
  if (alt.eurPaid !== null && chosen.eurPaid !== null && alt.eurPaid < chosen.eurPaid) return { code: 'cheaper' };
  if (alt.cost.free && !chosen.cost.free) return { code: 'free_plan' };
  if (LEVEL[alt.tool.skillLevel] < LEVEL[chosen.tool.skillLevel]) return { code: 'easier' };
  const p = alt.reasons.find((r) => r.code === 'primary');
  return p ?? null;
}

export function adHocTask(capabilityIds: string[]): CatalogTask {
  return {
    id: '__adhoc__',
    categoryId: '',
    position: 0,
    text: {},
    steps: capabilityIds.map((id, i) => ({ key: id, position: i, capabilityIds: [id], required: true, text: {} })),
  };
}

export function composeStack(
  catalog: Catalog,
  task: CatalogTask,
  constraints: Constraints,
  variant: Variant = 'recommended',
): StackResult {
  const relaxed = new Set<string>();
  const chosen = new Map<string, Scored>(); // stepKey → pick
  const chosenIds = new Set<string>();
  const perStepCandidates = new Map<string, Scored[]>();
  const order = [...task.steps].sort((a, b) => a.position - b.position);
  const rates = catalog.fx.rates;

  // Fewest: greedy cover, weighting primary > secondary and required > optional.
  if (variant === 'fewest') {
    const covered = new Set<string>();
    const requiredKeys = order.filter((s) => s.required).map((s) => s.key);
    let guard = 0;
    while (requiredKeys.some((k) => !covered.has(k)) && guard++ < 10) {
      let best: { tool: CatalogTool; value: number; keys: string[] } | null = null;
      for (const tool of catalog.tools.filter((t) => usable(t, constraints))) {
        let value = 0;
        const keys: string[] = [];
        for (const step of order) {
          if (covered.has(step.key)) continue;
          const fit = strengthFor(tool, stepCapabilities(step, constraints));
          if (!fit) continue;
          keys.push(step.key);
          value += step.required ? (fit.strength === 'primary' ? 1 : 0.6) : fit.strength === 'primary' ? 0.4 : 0.3;
        }
        if (!keys.some((k) => requiredKeys.includes(k))) continue;
        const sample = scoreTool(tool, stepCapabilities(order.find((s) => s.key === keys[0])!, constraints), task, keys[0]!, constraints, 'recommended', rates, chosenIds);
        const total = value * 100 + (sample?.score ?? 0);
        if (!best || total > best.value) best = { tool, value: total, keys };
      }
      if (!best) break;
      chosenIds.add(best.tool.id);
      for (const k of best.keys) covered.add(k);
    }
  }

  const required = order.filter((s) => s.required);
  const optional = order.filter((s) => !s.required);

  for (const step of required) {
    const list = candidatesFor(catalog, step, task, constraints, variant, chosenIds, relaxed);
    perStepCandidates.set(step.key, list);
    if (!list.length) continue;
    const pick = list[0]!;
    chosen.set(step.key, pick);
    chosenIds.add(pick.tool.id);
  }

  // Budget handling for the core (required steps only).
  const budget =
    constraints.budgetMonthlyCents !== undefined
      ? { cents: constraints.budgetMonthlyCents, currency: constraints.budgetCurrency ?? 'EUR' }
      : null;
  const inBudgetCurrency = (amount: number) =>
    budget && budget.currency !== 'EUR' && rates.get(budget.currency) ? Math.round(amount * rates.get(budget.currency)!) : amount;
  const coreTotal = () => {
    const seen = new Set<string>();
    let sum = 0;
    for (const pick of chosen.values()) {
      if (seen.has(pick.tool.id)) continue;
      seen.add(pick.tool.id);
      sum += pick.eurPaid ?? 0;
    }
    return inBudgetCurrency(sum);
  };
  if (budget && variant === 'recommended') {
    let guard = 0;
    while (coreTotal() > budget.cents && guard++ < 16) {
      const byCost = [...chosen.entries()].sort((a, b) => (b[1].eurPaid ?? 0) - (a[1].eurPaid ?? 0));
      let changed = false;
      for (const [key, pick] of byCost) {
        if ((pick.eurPaid ?? 0) === 0) continue;
        const pickPrimary = pick.reasons.some((r) => r.code === 'primary');
        const cheaper = (perStepCandidates.get(key) ?? []).filter(
          (x) =>
            x.tool.id !== pick.tool.id &&
            (x.eurPaid ?? Infinity) < (pick.eurPaid ?? Infinity) &&
            x.score >= pick.score * 0.75 &&
            (!pickPrimary || x.reasons.some((r) => r.code === 'primary')),
        );
        if (cheaper.length) {
          chosen.set(key, cheaper[0]!);
          changed = true;
          break;
        }
        // Same tool on its free plan (keeps fit; limits are listed as limitations).
        if (pick.cost.free) {
          chosen.set(key, {
            ...pick,
            eurPaid: 0,
            cost: { ...pick.cost, planKey: pick.cost.free.key, paidCents: 0 },
            reasons: [...pick.reasons.filter((r) => r.code !== 'free_plan'), { code: 'free_plan' }],
          });
          changed = true;
          break;
        }
      }
      if (!changed) break;
    }
  }

  // Optional steps: include when reused, free, or affordable within the remaining budget.
  for (const step of optional) {
    const list = candidatesFor(catalog, step, task, constraints, variant, chosenIds, relaxed);
    perStepCandidates.set(step.key, list);
    if (!list.length) continue;
    const reuse = list.find((x) => chosenIds.has(x.tool.id));
    let pick = list[0]!;
    if (variant === 'fewest') {
      if (!reuse) continue;
      pick = reuse;
    } else if (variant === 'budget') {
      const free = reuse ?? list.find((x) => x.cost.free);
      if (!free) continue;
      pick = free;
    } else if (budget) {
      if (reuse && reuse.score >= pick.score * 0.8) pick = reuse;
      else if (!chosenIds.has(pick.tool.id) && (pick.eurPaid ?? 0) > 0 && coreTotal() + (pick.eurPaid ?? 0) > budget.cents) {
        const affordable = list.find((x) => x.cost.free || chosenIds.has(x.tool.id));
        if (!affordable) continue;
        pick = affordable.cost.free && !chosenIds.has(affordable.tool.id)
          ? { ...affordable, eurPaid: 0, cost: { ...affordable.cost, planKey: affordable.cost.free.key, paidCents: 0 } }
          : affordable;
      }
    } else if (reuse && reuse.score >= pick.score * 0.85) {
      pick = reuse;
    }
    chosen.set(step.key, pick);
    chosenIds.add(pick.tool.id);
  }

  // Assemble steps.
  const firstStepOfTool = new Map<string, string>();
  const steps: StepPick[] = order.map((step) => {
    const pick = chosen.get(step.key);
    const list = perStepCandidates.get(step.key) ?? [];
    if (!pick) {
      return {
        key: step.key,
        required: step.required,
        capabilityIds: step.capabilityIds,
        chosenCapabilityId: constraints.approach?.[step.key] ?? null,
        toolId: null,
        planKey: null,
        sharedFromStep: null,
        score: 0,
        reasons: [],
        limitations: [],
        alternatives: list.slice(0, 3).map((x) => ({ toolId: x.tool.id, reason: null })),
        skipped: list.length ? 'optional' : 'no_candidate',
      };
    }
    const shared = firstStepOfTool.get(pick.tool.id) ?? null;
    if (!shared) firstStepOfTool.set(pick.tool.id, step.key);
    const limitations: LimitationCode[] = [...pick.limitations];
    for (const r of relaxed) limitations.push({ code: 'relaxed', constraint: r });
    return {
      key: step.key,
      required: step.required,
      capabilityIds: step.capabilityIds,
      chosenCapabilityId: pick.capabilityId,
      toolId: pick.tool.id,
      planKey: pick.cost.planKey,
      sharedFromStep: shared,
      score: pick.score,
      reasons: pick.reasons.slice(0, 5),
      limitations: limitations.slice(0, 4),
      alternatives: list
        .filter((x) => x.tool.id !== pick.tool.id)
        .slice(0, 3)
        .map((x) => ({ toolId: x.tool.id, reason: altReason(pick, x) })),
      skipped: null,
    };
  });

  // Lines (one per distinct tool) and totals.
  const lines: StackLine[] = [];
  for (const s of steps) {
    if (!s.toolId) continue;
    const existing = lines.find((l) => l.toolId === s.toolId);
    if (existing) {
      existing.steps.push(s.key);
      if (s.required) existing.optional = false;
      continue;
    }
    const pick = chosen.get(s.key)!;
    lines.push({
      toolId: s.toolId,
      steps: [s.key],
      optional: !s.required,
      planKey: pick.cost.planKey,
      paidCents: pick.cost.paidCents,
      startCents: pick.cost.startCents,
      currency: pick.cost.currency,
      freePlanAvailable: Boolean(pick.cost.free),
      perUser: pick.cost.perUser,
    });
  }
  const sum = (key: 'paidCents' | 'startCents', includeOptional: boolean): Money[] => {
    const m = new Map<string, number>();
    for (const l of lines) {
      if (l.optional && !includeOptional) continue;
      const v = l[key];
      if (v === null || v === 0 || !l.currency) continue;
      m.set(l.currency, (m.get(l.currency) ?? 0) + v);
    }
    return [...m.entries()].map(([currency, cents]) => ({ currency, cents }));
  };
  const toEur = (list: Money[]) => {
    let total = 0;
    for (const x of list) {
      const e = toEurCents(x.cents, x.currency, rates);
      if (e === null) return null;
      total += e;
    }
    return total;
  };
  const block = (includeOptional: boolean): Totals => {
    const paid = sum('paidCents', includeOptional);
    const start = sum('startCents', includeOptional);
    return { paid, start, paidEurCents: toEur(paid), startEurCents: toEur(start) };
  };
  const core = block(false);
  const all = block(true);
  const unknownCost = lines.some((l) => !l.optional && l.paidCents === null);
  /** Budget check in the budget currency; null when a rate or a price is missing. */
  const within = (list: Money[]) => {
    if (!budget || unknownCost) return null;
    let total = 0;
    for (const x of list) {
      if (x.currency === budget.currency) total += x.cents;
      else {
        const e = toEurCents(x.cents, x.currency, rates);
        if (e === null) return null;
        total += budget.currency === 'EUR' ? e : rates.get(budget.currency) ? Math.round(e * rates.get(budget.currency)!) : NaN;
      }
    }
    return Number.isNaN(total) ? null : total <= budget.cents;
  };
  const confidences = lines.map((l) => catalog.toolsById.get(l.toolId)?.confidence ?? 0);

  return {
    version: 1,
    taskId: task.id === '__adhoc__' ? null : task.id,
    variant,
    steps,
    lines,
    totals: { core, all, fxDay: catalog.fx.day },
    budget: budget
      ? { limitCents: budget.cents, currency: budget.currency, paidWithin: within(core.paid), startWithin: within(core.start) }
      : null,
    relaxed: [...relaxed],
    confidence: confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0,
  };
}

export function composeVariants(catalog: Catalog, task: CatalogTask, constraints: Constraints): Record<Variant, StackResult> {
  return {
    recommended: composeStack(catalog, task, constraints, 'recommended'),
    budget: composeStack(catalog, task, constraints, 'budget'),
    fewest: composeStack(catalog, task, constraints, 'fewest'),
  };
}
