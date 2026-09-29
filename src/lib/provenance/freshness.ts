/**
 * Freshness engine (docs/strategy/08 §6). Every datapoint type has a
 * "fresh" and an "aging" limit in days; beyond that it is stale and the UI
 * shows "⚠️ Information may be outdated".
 */
import type { Freshness } from '@/lib/db/schema';
import type { Settings } from '@/lib/settings/defaults';

export type FreshnessKind = keyof Settings['freshness'];

const DAY_MS = 86_400_000;

export function ageInDays(at: Date, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - at.getTime()) / DAY_MS);
}

export function freshnessOf(
  checkedAt: Date | null | undefined,
  kind: FreshnessKind,
  rules: Settings['freshness'],
  now: Date = new Date(),
): Freshness {
  if (!checkedAt) return 'unknown';
  const [fresh, aging] = rules[kind];
  const age = ageInDays(checkedAt, now);
  if (age <= fresh) return 'fresh';
  if (age <= aging) return 'aging';
  return 'stale';
}

const ORDER: Record<Freshness, number> = { fresh: 0, aging: 1, stale: 2, unknown: 3 };

/**
 * Tool freshness = the worst of price and website freshness. A website that
 * was never checked does not make the tool "unknown" (price is the anchor);
 * a tool without any price observation is "unknown".
 */
export function toolFreshness(price: Freshness, website: Freshness): Freshness {
  if (price === 'unknown') return 'unknown';
  if (website === 'unknown') return price;
  return ORDER[price] >= ORDER[website] ? price : website;
}

export function isStale(f: Freshness): boolean {
  return f === 'stale';
}
