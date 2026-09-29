/**
 * Comparison matrix, verdicts and the Fair Fight gate (docs/strategy/05 §5).
 * No overall winner: verdicts say "choose X if …" per criterion, derived only
 * from known values. Monetisation data is never an input.
 */
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import type { FactStatus } from '@/lib/db/schema';
import { statusRank } from '@/lib/provenance/confidence';

export type CriterionKey =
  | 'entry_price'
  | 'free_plan'
  | 'free_trial'
  | 'pricing_model'
  | 'platforms'
  | 'api'
  | 'open_source'
  | 'self_hostable'
  | 'eu_data_residency'
  | 'gdpr_dpa'
  | 'supports_dutch'
  | 'trains_on_user_data'
  | 'watermark_free_tier'
  | 'commercial_use_free_tier'
  | 'skill_level'
  | 'capabilities';

export interface Cell {
  toolId: string;
  /** Raw comparable value; null = unknown. */
  value: unknown;
  status: FactStatus | null;
  best: boolean;
}

export interface Row {
  key: CriterionKey;
  cells: Cell[];
  differs: boolean;
}

const LEVEL = { beginner: 0, intermediate: 1, advanced: 2 } as const;

function factStatus(tool: CatalogTool, key: string): FactStatus | null {
  return tool.facts[key]?.status ?? null;
}

function boolRow(
  key: CriterionKey,
  tools: CatalogTool[],
  get: (t: CatalogTool) => boolean | null,
  factKey: string,
  better: boolean | null,
): Row {
  const cells = tools.map((t) => ({ toolId: t.id, value: get(t), status: factStatus(t, factKey), best: false }));
  const known = cells.filter((c) => c.value !== null);
  const differs = known.length >= 2 && new Set(known.map((c) => c.value)).size > 1;
  if (differs && better !== null) for (const c of cells) c.best = c.value === better;
  return { key, cells, differs };
}

export function buildMatrix(tools: CatalogTool[]): Row[] {
  const rows: Row[] = [];
  // Entry price: lowest known monthly entry price (free plan counts as 0).
  const price = tools.map((t) => ({
    toolId: t.id,
    value: t.entryPriceCents !== null ? { cents: t.entryPriceCents, currency: t.entryPriceCurrency } : null,
    status: t.pricingStatus,
    best: false,
  }));
  const knownPrices = price.filter((p) => p.value !== null) as (Cell & { value: { cents: number; currency: string } })[];
  const sameCurrency = new Set(knownPrices.map((p) => p.value.currency)).size === 1;
  const priceDiffers = knownPrices.length >= 2 && sameCurrency && new Set(knownPrices.map((p) => p.value.cents)).size > 1;
  if (priceDiffers) {
    const min = Math.min(...knownPrices.map((p) => p.value.cents));
    for (const p of knownPrices) p.best = p.value.cents === min;
  }
  rows.push({ key: 'entry_price', cells: price, differs: priceDiffers });
  rows.push(boolRow('free_plan', tools, (t) => t.hasFreeTier, 'has_free_tier', true));
  rows.push(boolRow('free_trial', tools, (t) => t.hasFreeTrial, 'has_free_trial', true));
  {
    const cells = tools.map((t) => ({ toolId: t.id, value: t.pricingModel === 'unknown' ? null : t.pricingModel, status: t.pricingStatus, best: false }));
    const known = cells.filter((c) => c.value !== null);
    rows.push({ key: 'pricing_model', cells, differs: known.length >= 2 && new Set(known.map((c) => c.value)).size > 1 });
  }
  {
    const cells = tools.map((t) => ({ toolId: t.id, value: t.platforms.length ? t.platforms : null, status: factStatus(t, 'platforms'), best: false }));
    const sets = cells.filter((c) => c.value !== null).map((c) => [...(c.value as string[])].sort().join(','));
    rows.push({ key: 'platforms', cells, differs: sets.length >= 2 && new Set(sets).size > 1 });
  }
  rows.push(boolRow('api', tools, (t) => t.apiAvailable ?? (t.platforms.includes('api') ? true : null), 'api_available', true));
  rows.push(boolRow('open_source', tools, (t) => t.openSource, 'open_source', true));
  rows.push(boolRow('self_hostable', tools, (t) => t.selfHostable, 'self_hostable', true));
  rows.push(boolRow('eu_data_residency', tools, (t) => t.euDataResidency, 'eu_data_residency', true));
  rows.push(boolRow('gdpr_dpa', tools, (t) => t.gdprDpa, 'gdpr_dpa', true));
  rows.push(boolRow('supports_dutch', tools, (t) => t.supportsDutch, 'supports_dutch', true));
  {
    const cells = tools.map((t) => ({ toolId: t.id, value: t.trainsOnUserData, status: factStatus(t, 'trains_on_user_data'), best: false }));
    const known = cells.filter((c) => c.value !== null);
    const differs = known.length >= 2 && new Set(known.map((c) => c.value)).size > 1;
    if (differs) for (const c of cells) c.best = c.value === 'no';
    rows.push({ key: 'trains_on_user_data', cells, differs });
  }
  rows.push(boolRow('watermark_free_tier', tools, (t) => t.watermarkFreeTier, 'watermark_free_tier', false));
  rows.push(boolRow('commercial_use_free_tier', tools, (t) => t.commercialUseFreeTier, 'commercial_use_free_tier', true));
  {
    const cells = tools.map((t) => ({ toolId: t.id, value: t.skillLevel, status: null, best: false }));
    const differs = new Set(cells.map((c) => c.value)).size > 1;
    if (differs) {
      const min = Math.min(...tools.map((t) => LEVEL[t.skillLevel]));
      for (const c of cells) c.best = LEVEL[c.value as keyof typeof LEVEL] === min;
    }
    rows.push({ key: 'skill_level', cells, differs });
  }
  {
    const cells = tools.map((t) => ({ toolId: t.id, value: t.capabilities.map((c) => c.id), status: null, best: false }));
    const sets = cells.map((c) => [...(c.value as string[])].sort().join(','));
    rows.push({ key: 'capabilities', cells, differs: new Set(sets).size > 1 });
  }
  return rows;
}

export type VerdictReason =
  | { kind: 'cheaper' }
  | { kind: 'free_plan' }
  | { kind: 'free_trial' }
  | { kind: 'api' }
  | { kind: 'open_source' }
  | { kind: 'self_hostable' }
  | { kind: 'eu' }
  | { kind: 'dpa' }
  | { kind: 'dutch' }
  | { kind: 'no_training' }
  | { kind: 'no_watermark' }
  | { kind: 'commercial_free' }
  | { kind: 'easier' }
  | { kind: 'capability'; capabilityId: string }
  | { kind: 'platform'; platform: string };

export interface Verdict {
  toolId: string;
  reasons: VerdictReason[];
}

/** "Choose X if …" per tool, from rows where that tool is strictly better. */
export function verdicts(tools: CatalogTool[], rows: Row[]): Verdict[] {
  const map: Record<string, VerdictReason[]> = Object.fromEntries(tools.map((t) => [t.id, []]));
  const simple: Partial<Record<CriterionKey, VerdictReason>> = {
    entry_price: { kind: 'cheaper' },
    free_plan: { kind: 'free_plan' },
    free_trial: { kind: 'free_trial' },
    api: { kind: 'api' },
    open_source: { kind: 'open_source' },
    self_hostable: { kind: 'self_hostable' },
    eu_data_residency: { kind: 'eu' },
    gdpr_dpa: { kind: 'dpa' },
    supports_dutch: { kind: 'dutch' },
    trains_on_user_data: { kind: 'no_training' },
    watermark_free_tier: { kind: 'no_watermark' },
    commercial_use_free_tier: { kind: 'commercial_free' },
    skill_level: { kind: 'easier' },
  };
  for (const row of rows) {
    const reason = simple[row.key];
    if (!reason || !row.differs) continue;
    const bestCount = row.cells.filter((c) => c.best).length;
    if (bestCount === 0 || bestCount === row.cells.length) continue;
    for (const c of row.cells) if (c.best) map[c.toolId]!.push(reason);
  }
  // Unique primary capabilities and platforms.
  for (const t of tools) {
    const others = tools.filter((o) => o.id !== t.id);
    for (const c of t.capabilities.filter((x) => x.strength === 'primary')) {
      if (others.every((o) => !o.capabilities.some((oc) => oc.id === c.id))) map[t.id]!.push({ kind: 'capability', capabilityId: c.id });
    }
    for (const p of t.platforms) {
      if (p === 'web') continue;
      if (others.every((o) => o.platforms.length > 0 && !o.platforms.includes(p))) map[t.id]!.push({ kind: 'platform', platform: p });
    }
  }
  return tools.map((t) => ({ toolId: t.id, reasons: map[t.id]!.slice(0, 6) }));
}

export function sharedPrimary(a: CatalogTool, b: CatalogTool): string[] {
  const pa = a.capabilities.filter((c) => c.strength === 'primary').map((c) => c.id);
  return pa.filter((id) => b.capabilities.some((c) => c.id === id));
}

/** Fair Fight gate: meaningful pair, shared primary capability, priced, ≥ 4 differences. */
export function fairFightGate(a: CatalogTool, b: CatalogTool): { ok: boolean; differences: number; reasons: string[] } {
  const reasons: string[] = [];
  if (sharedPrimary(a, b).length === 0 && sharedPrimary(b, a).length === 0) reasons.push('no_shared_primary');
  const priced = (t: CatalogTool) => t.pricingStatus !== null && statusRank(t.pricingStatus) >= statusRank('supported');
  if (!priced(a) || !priced(b)) reasons.push('pricing_not_supported');
  const meaningful =
    a.alternatives.some((x) => x.id === b.id && x.source !== 'computed') ||
    b.alternatives.some((x) => x.id === a.id && x.source !== 'computed');
  if (!meaningful) reasons.push('not_a_meaningful_pair');
  const differences = buildMatrix([a, b]).filter((r) => r.differs).length;
  if (differences < 4) reasons.push('too_few_differences');
  if (a.status === 'shutdown' || b.status === 'shutdown') reasons.push('discontinued');
  return { ok: reasons.length === 0, differences, reasons };
}

export function fairFightsFor(catalog: Catalog, tool: CatalogTool, limit = 3): CatalogTool[] {
  return tool.alternatives
    .filter((x) => x.source !== 'computed')
    .map((x) => catalog.toolsById.get(x.id))
    .filter((x): x is CatalogTool => Boolean(x) && fairFightGate(tool, x!).ok)
    .slice(0, limit);
}

export function parsePair(pair: string, catalog: Catalog): [CatalogTool, CatalogTool] | null {
  const idx = pair.indexOf('-vs-');
  if (idx < 0) return null;
  const a = catalog.toolsBySlug.get(pair.slice(0, idx));
  const b = catalog.toolsBySlug.get(pair.slice(idx + 4));
  return a && b && a.id !== b.id ? [a, b] : null;
}
