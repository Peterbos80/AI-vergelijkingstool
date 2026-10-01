/**
 * "Wat krijg je echt gratis?" (docs/strategy/agents/B2 §4): per tool of a task
 * the free plan with its limit text, and the facts we hold with a source:
 * watermark, commercial use and (once recorded) whether a credit card is
 * needed. Unknown stays unknown (null), never "no".
 */
import type { Catalog, CatalogPlan, CatalogTask, CatalogTool } from '@/lib/catalog/types';
import { rankForCapability } from '@/lib/engine/rank';
import { parseQuotaClauses, type QuotaPer } from '@/lib/pricing/quota';
import { isEuropeanCountry, isTrulyFree } from './labels';

/** Fact key for "a credit card is needed for the free plan" (true = needed). Not recorded for any tool yet. */
export const CREDIT_CARD_FACT = 'credit_card_free_tier';

export interface FreeCheckRow {
  tool: CatalogTool;
  /** yes: a free plan; no: the tool has no free plan (sourced); unknown: not recorded. */
  free: 'yes' | 'no' | 'unknown';
  plan: CatalogPlan | null;
  /** The free plan's limit as the maker states it, and the period we could read from it. */
  limit: string | null;
  limitPer: QuotaPer | null;
  /** true: exports carry a watermark. */
  watermark: boolean | null;
  commercialUse: boolean | null;
  creditCard: boolean | null;
  trulyFree: boolean;
  european: boolean;
}

/** The tools a task page lists per step (same selection as "Tools per step"), in page order. */
export function taskTools(catalog: Catalog, task: CatalogTask): CatalogTool[] {
  const out = new Map<string, CatalogTool>();
  for (const step of task.steps) {
    const perStep = [...new Map(step.capabilityIds.flatMap((c) => rankForCapability(catalog, c).slice(0, 4)).map((x) => [x.id, x])).values()].slice(0, 5);
    for (const tool of perStep) if (!out.has(tool.id)) out.set(tool.id, tool);
  }
  return [...out.values()];
}

function factBool(tool: CatalogTool, key: string): boolean | null {
  const v = tool.facts[key]?.value;
  return typeof v === 'boolean' ? v : null;
}

export function freeCheckRow(tool: CatalogTool): FreeCheckRow {
  const plan = [...tool.plans].sort((a, b) => a.position - b.position).find((p) => p.isFree) ?? null;
  const free = plan || tool.hasFreeTier === true ? 'yes' : tool.hasFreeTier === false ? 'no' : 'unknown';
  const clauses = parseQuotaClauses(plan?.quota);
  return {
    tool,
    free,
    plan,
    limit: plan?.quota ?? null,
    limitPer: clauses[0]?.per ?? null,
    watermark: free === 'yes' ? tool.watermarkFreeTier : null,
    commercialUse: free === 'yes' ? tool.commercialUseFreeTier : null,
    creditCard: free === 'yes' ? factBool(tool, CREDIT_CARD_FACT) : null,
    trulyFree: isTrulyFree(tool),
    european: isEuropeanCountry(tool.companyCountry),
  };
}

export function freeCheck(catalog: Catalog, task: CatalogTask): FreeCheckRow[] {
  return taskTools(catalog, task).map(freeCheckRow);
}
