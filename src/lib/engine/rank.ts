/**
 * Capability ranking (public /capabilities pages). The parameters are
 * published on /methodology (Omnibus, art. 6:193e BW): core capability first,
 * then data reliability and freshness, then entry price. No monetisation input.
 */
import type { Catalog, CatalogTool } from '@/lib/catalog/types';

const FRESH = { fresh: 6, aging: 3, stale: -6, unknown: 0 } as const;
const STATUS = { verified: 6, supported: 4, community: 1, unverified: 0 } as const;

export function capabilityScore(tool: CatalogTool, capabilityId: string): number {
  const cap = tool.capabilities.find((c) => c.id === capabilityId);
  if (!cap) return -Infinity;
  let s = cap.strength === 'primary' ? 100 : 0;
  s += tool.confidence * 0.2;
  s += FRESH[tool.freshness];
  s += tool.pricingStatus ? STATUS[tool.pricingStatus] : -2;
  if (tool.hasFreeTier) s += 3;
  if (tool.entryPriceCents !== null) s += 5 * (1 - Math.min(1, tool.entryPriceCents / 10000));
  if (tool.status === 'beta') s -= 2;
  return s;
}

export function rankForCapability(catalog: Catalog, capabilityId: string): CatalogTool[] {
  return catalog.tools
    // Tools in quarantine (tool scout) are never ranked; the catalog keeps them out of `tools`, this guards hand-built catalogs.
    .filter((t) => t.status !== 'shutdown' && t.quarantineUntil === null && t.capabilities.some((c) => c.id === capabilityId))
    .map((t) => ({ t, s: capabilityScore(t, capabilityId) }))
    .sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name))
    .map((x) => x.t);
}
