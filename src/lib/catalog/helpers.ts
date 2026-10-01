/**
 * Pure catalog accessors (localised names, slugs, texts). No database access,
 * so client components can use them too; `@/lib/catalog` re-exports them.
 */
import { fallbackChain, type Locale } from '@/i18n/config';
import { isWorld, type SceneId } from '@/lib/world-ids';
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

/** A tool's world: the category of its first primary function (else any function), or "home". */
export function toolWorld(tool: CatalogTool, catalog: Catalog): SceneId {
  const ordered = [...tool.capabilities].sort((a, b) => Number(b.strength === 'primary') - Number(a.strength === 'primary'));
  for (const c of ordered) {
    const category = catalog.capabilitiesById.get(c.id)?.categoryId;
    if (isWorld(category)) return category;
  }
  return 'home';
}
