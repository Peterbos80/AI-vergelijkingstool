/**
 * Computed labels (docs/strategy/agents/B2 §6): predicates that follow from
 * sourced data, never winners or scores. Each label has a reason the page
 * links to. Pure module, no monetisation input.
 */
import type { CatalogTool } from '@/lib/catalog/types';

export type ComputedLabel = 'cheapest' | 'truly_free' | 'european';

/** EU and EEA member states, the United Kingdom and Switzerland (ISO 3166-1 alpha-2). */
export const EUROPEAN_COUNTRIES: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
]);

/** True only when the company's country is known and European; unknown is not "outside Europe". */
export function isEuropeanCountry(country: string | null | undefined): boolean {
  return !!country && EUROPEAN_COUNTRIES.has(country.toUpperCase());
}

/**
 * "Echt bruikbaar gratis": a free plan, no watermark and commercial use
 * allowed — only when both facts are known. An unknown fact never counts as
 * a yes.
 */
export function isTrulyFree(tool: Pick<CatalogTool, 'hasFreeTier' | 'plans' | 'watermarkFreeTier' | 'commercialUseFreeTier'>): boolean {
  const hasFree = tool.plans.some((p) => p.isFree) || tool.hasFreeTier === true;
  return hasFree && tool.watermarkFreeTier === false && tool.commercialUseFreeTier === true;
}
