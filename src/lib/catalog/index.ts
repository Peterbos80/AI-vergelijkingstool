/**
 * Process-wide catalog cache, invalidated by the `data_version` setting.
 * The version is re-read at most every CHECK_MS; any agent or admin write that
 * changes published data bumps it (lib/settings → bumpDataVersion).
 */
import { getDb } from '@/lib/db/client';
import { readDataVersion } from '@/lib/settings';
import { fallbackChain, type Locale } from '@/i18n/config';
import { loadCatalog } from './load';
import type {
  Catalog,
  CatalogCapability,
  CatalogCategory,
  CatalogTask,
  CatalogTaskStep,
  CatalogTool,
  LocalizedName,
  ToolText,
} from './types';

export type * from './types';

const CHECK_MS = 15_000;

interface CacheState {
  catalog: Catalog | null;
  checkedAt: number;
  loading: Promise<Catalog> | null;
}

const g = globalThis as unknown as { __aitwCatalog?: CacheState };
const state: CacheState = (g.__aitwCatalog ??= { catalog: null, checkedAt: 0, loading: null });

export async function getCatalog(): Promise<Catalog> {
  const now = Date.now();
  if (state.catalog && now - state.checkedAt < CHECK_MS) return state.catalog;
  if (state.loading) return state.loading;
  state.loading = (async () => {
    try {
      const db = getDb();
      const version = await readDataVersion(db);
      if (state.catalog && state.catalog.version === version) {
        state.checkedAt = Date.now();
        return state.catalog;
      }
      const catalog = await loadCatalog(db, version);
      state.catalog = catalog;
      state.checkedAt = Date.now();
      return catalog;
    } finally {
      state.loading = null;
    }
  })();
  return state.loading;
}

/** Drop the cache (tests, admin "refresh now"). */
export function resetCatalogCache(): void {
  state.catalog = null;
  state.checkedAt = 0;
}

/* ───────── Localised accessors (fallback chain: requested → en → nl) ───────── */

function pick<T>(map: Partial<Record<Locale, T>>, locale: Locale): { value: T; locale: Locale } | null {
  for (const l of fallbackChain(locale)) {
    const v = map[l];
    if (v) return { value: v, locale: l };
  }
  return null;
}

export function toolText(tool: CatalogTool, locale: Locale): (ToolText & { locale: Locale }) | null {
  const hit = pick(tool.text, locale);
  return hit ? { ...hit.value, locale: hit.locale } : null;
}

export function nameOf(entity: CatalogCategory | CatalogCapability, locale: Locale): LocalizedName & { locale: Locale } {
  const hit = pick(entity.text as Partial<Record<Locale, LocalizedName>>, locale);
  return hit ? { ...hit.value, locale: hit.locale } : { name: entity.id, slug: entity.id, description: null, locale };
}

export function taskTextOf(task: CatalogTask, locale: Locale) {
  const hit = pick(task.text, locale);
  return hit
    ? { ...hit.value, locale: hit.locale }
    : { title: task.id, slug: task.id, summary: null, intentPhrases: [], locale };
}

export function stepLabel(step: CatalogTaskStep, locale: Locale): { label: string; hint: string | null } {
  return pick(step.text, locale)?.value ?? { label: step.key, hint: null };
}

/** Slug lookup for localized taxonomy slugs; falls back to any locale's slug. */
export function findBySlug<T extends { text: Partial<Record<Locale, { slug: string }>> }>(
  list: readonly T[],
  slug: string,
  locale: Locale,
): T | undefined {
  return list.find((x) => x.text[locale]?.slug === slug) ?? list.find((x) => Object.values(x.text).some((t) => t?.slug === slug));
}

export function taskSlug(task: CatalogTask, locale: Locale): string {
  return taskTextOf(task, locale).slug;
}

export function entitySlug(entity: CatalogCategory | CatalogCapability, locale: Locale): string {
  return nameOf(entity, locale).slug;
}

/** Tools that have `capabilityId`, primary first. */
export function toolsWithCapability(catalog: Catalog, capabilityId: string): CatalogTool[] {
  return catalog.tools
    .filter((t) => t.capabilities.some((c) => c.id === capabilityId))
    .sort((a, b) => {
      const sa = a.capabilities.find((c) => c.id === capabilityId)!.strength === 'primary' ? 0 : 1;
      const sb = b.capabilities.find((c) => c.id === capabilityId)!.strength === 'primary' ? 0 : 1;
      return sa - sb;
    });
}
