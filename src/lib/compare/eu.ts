/**
 * "Europees alternatief" (docs/strategy/agents/B2 §5): for a tool whose
 * company is outside Europe, tools of European companies (EU/EEA, UK,
 * Switzerland; `companyCountry`) with the same primary capabilities.
 *
 * Overlap = the share of the tool's primary capabilities that the European
 * tool also has as a primary capability. Order: overlap, then the entry price
 * in euros (ECB), then the name. No monetisation input. A European company
 * says nothing yet about where your data is stored; pages say so.
 */
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import { toEurCents } from '@/lib/pricing/money';
import { isEuropeanCountry } from './labels';

export interface EuAlternative {
  tool: CatalogTool;
  /** 0–1: share of the original tool's primary capabilities covered. */
  overlap: number;
  /** The shared primary capability ids. */
  shared: string[];
  /** Entry price in euro cents via ECB; null when unknown or without a rate. */
  entryEurCents: number | null;
}

const primary = (t: CatalogTool) => t.capabilities.filter((c) => c.strength === 'primary').map((c) => c.id);

/** Null when the company is European or its country is unknown (no section then). */
export function euAlternatives(catalog: Catalog, tool: CatalogTool, limit = 5): EuAlternative[] | null {
  if (!tool.companyCountry || isEuropeanCountry(tool.companyCountry)) return null;
  const own = primary(tool);
  if (!own.length) return [];
  const out: EuAlternative[] = [];
  for (const other of catalog.tools) {
    if (other.id === tool.id || other.status === 'shutdown' || !isEuropeanCountry(other.companyCountry)) continue;
    const theirs = new Set(primary(other));
    const shared = own.filter((c) => theirs.has(c));
    if (!shared.length) continue;
    const entryEurCents =
      other.entryPriceCents !== null && other.entryPriceCurrency
        ? toEurCents(other.entryPriceCents, other.entryPriceCurrency, catalog.fx.rates)
        : null;
    out.push({ tool: other, overlap: shared.length / own.length, shared, entryEurCents });
  }
  out.sort(
    (a, b) =>
      b.overlap - a.overlap ||
      (a.entryEurCents ?? Number.POSITIVE_INFINITY) - (b.entryEurCents ?? Number.POSITIVE_INFINITY) ||
      a.tool.name.localeCompare(b.tool.name, 'en', { sensitivity: 'base' }),
  );
  return out.slice(0, limit);
}
