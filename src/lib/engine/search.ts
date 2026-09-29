/**
 * Explorer search and filters over the in-memory catalog. Deterministic and
 * explainable; monetisation data is never an input (ranking independence).
 */
import type { Locale } from '@/i18n/config';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import { editDistance, normalize, stems } from './text';

export interface ToolFilters {
  q?: string;
  category?: string;
  capability?: string;
  price?: 'free' | 'freemium' | 'paid' | 'open_source';
  platform?: string;
  api?: boolean;
  openSource?: boolean;
  eu?: boolean;
  dutch?: boolean;
  level?: 'beginner' | 'intermediate' | 'advanced';
  maxPriceCents?: number;
  includeDiscontinued?: boolean;
  sort?: 'relevance' | 'name' | 'price' | 'fresh';
}

export interface SearchHit {
  tool: CatalogTool;
  score: number;
}

const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;

function textScore(tool: CatalogTool, catalog: Catalog, q: string, locale: Locale): number {
  const nq = normalize(q);
  if (!nq) return 0;
  const name = normalize(tool.name);
  let score = 0;
  if (name === nq) score += 100;
  else if (name.startsWith(nq)) score += 60;
  else if (name.includes(nq)) score += 40;
  else if (nq.length >= 4 && editDistance(name, nq, 2) <= 2) score += 30;
  for (const alias of tool.aliases) {
    const a = normalize(alias);
    if (a === nq) score += 80;
    else if (a.includes(nq)) score += 30;
  }
  const qStems = new Set(stems(q));
  if (qStems.size) {
    const text = tool.text[locale] ?? tool.text.en ?? tool.text.nl;
    const hay = new Set(stems(`${text?.tagline ?? ''} ${text?.description ?? ''} ${(text?.bestFor ?? []).join(' ')}`));
    let hits = 0;
    for (const s of qStems) if (hay.has(s)) hits++;
    score += (hits / qStems.size) * 25;
    for (const c of tool.capabilities) {
      const cap = catalog.capabilitiesById.get(c.id);
      const ct = cap?.text[locale] ?? cap?.text.en;
      if (!ct) continue;
      const capStems = new Set(stems(`${ct.name} ${ct.synonyms.join(' ')}`));
      let capHits = 0;
      for (const s of qStems) if (capStems.has(s)) capHits++;
      if (capHits) score += (capHits / qStems.size) * (c.strength === 'primary' ? 30 : 12);
    }
  }
  return score;
}

export function searchTools(catalog: Catalog, filters: ToolFilters, locale: Locale): SearchHit[] {
  const capabilityIds = filters.category
    ? new Set(catalog.capabilities.filter((c) => c.categoryId === filters.category).map((c) => c.id))
    : null;
  const q = filters.q?.trim() ?? '';
  const hits: SearchHit[] = [];
  for (const tool of catalog.tools) {
    if (!filters.includeDiscontinued && (tool.status === 'shutdown' || tool.status === 'deprecated')) continue;
    if (capabilityIds && !tool.capabilities.some((c) => capabilityIds.has(c.id))) continue;
    if (filters.capability && !tool.capabilities.some((c) => c.id === filters.capability)) continue;
    if (filters.price === 'free' && !tool.hasFreeTier) continue;
    if (filters.price === 'freemium' && tool.pricingModel !== 'freemium') continue;
    if (filters.price === 'paid' && tool.hasFreeTier) continue;
    if (filters.price === 'open_source' && !tool.openSource) continue;
    if (filters.platform && !tool.platforms.includes(filters.platform)) continue;
    if (filters.api && !(tool.apiAvailable || tool.platforms.includes('api'))) continue;
    if (filters.openSource && !tool.openSource) continue;
    if (filters.eu && !tool.euDataResidency) continue;
    if (filters.dutch && !tool.supportsDutch) continue;
    if (filters.level && LEVEL_RANK[tool.skillLevel] > LEVEL_RANK[filters.level]) continue;
    if (filters.maxPriceCents !== undefined && !tool.hasFreeTier && (tool.entryPriceCents ?? Infinity) > filters.maxPriceCents)
      continue;
    const score = q ? textScore(tool, catalog, q, locale) : 0;
    if (q && score < 8) continue;
    hits.push({ tool, score });
  }
  const sort = filters.sort ?? (q ? 'relevance' : 'name');
  const byName = (a: SearchHit, b: SearchHit) => a.tool.name.localeCompare(b.tool.name, locale, { sensitivity: 'base' });
  const priceOf = (t: CatalogTool) => (t.hasFreeTier ? 0 : (t.entryPriceCents ?? Number.MAX_SAFE_INTEGER));
  const freshRank = { fresh: 0, aging: 1, stale: 2, unknown: 3 } as const;
  hits.sort((a, b) => {
    if (sort === 'relevance') return b.score - a.score || byName(a, b);
    if (sort === 'price') return priceOf(a.tool) - priceOf(b.tool) || byName(a, b);
    if (sort === 'fresh') return freshRank[a.tool.freshness] - freshRank[b.tool.freshness] || byName(a, b);
    return byName(a, b);
  });
  return hits;
}

/** Parse explorer filters from URL search params (unknown values are ignored). */
export function parseFilters(sp: Record<string, string | string[] | undefined>, catalog: Catalog, locale: Locale): ToolFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.slice(0, 120);
  };
  const flag = (k: string) => one(k) === '1';
  const catSlug = one('category');
  const capSlug = one('capability');
  const category = catSlug
    ? catalog.categories.find((c) => c.id === catSlug || Object.values(c.text).some((x) => x?.slug === catSlug))
    : undefined;
  const capability = capSlug
    ? catalog.capabilities.find((c) => c.id === capSlug || Object.values(c.text).some((x) => x?.slug === capSlug))
    : undefined;
  const price = one('price');
  const level = one('level');
  const sort = one('sort');
  const max = Number(one('max'));
  void locale;
  return {
    q: one('q'),
    category: category?.id,
    capability: capability?.id,
    price: price === 'free' || price === 'freemium' || price === 'paid' || price === 'open_source' ? price : undefined,
    platform: one('platform'),
    api: flag('api'),
    openSource: flag('os'),
    eu: flag('eu'),
    dutch: flag('nl'),
    level: level === 'beginner' || level === 'intermediate' || level === 'advanced' ? level : undefined,
    maxPriceCents: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : undefined,
    includeDiscontinued: flag('all'),
    sort: sort === 'name' || sort === 'price' || sort === 'fresh' || sort === 'relevance' ? sort : undefined,
  };
}
