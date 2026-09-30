/**
 * Indexable pages (docs/strategy/05 §5): only pages that carry enough unique,
 * sourced data are listed; thin pages stay out. Pure function over the
 * catalog so the sitemap route and the owner reports count the same pages.
 */
import { LOCALE_META, type Locale } from '@/i18n/config';
import { entitySlug, taskSlug } from '@/lib/catalog';
import type { Catalog } from '@/lib/catalog/types';
import { fairFightGate } from '@/lib/engine/compare';
import { href } from '@/lib/routes';

export type SitemapKind = 'home' | 'hub' | 'static' | 'tool' | 'pricing' | 'alternatives' | 'task' | 'category' | 'capability' | 'fair_fight';

export interface SitemapEntry {
  kind: SitemapKind;
  /** Site-relative path. */
  path: string;
  lastModified?: Date;
  priority: number;
  /** hreflang → site-relative path of every locale version. */
  languages: Record<string, string>;
}

export function sitemapEntries(catalog: Catalog, locales: Locale[], opts: { newsletter: boolean }): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  const add = (kind: SitemapKind, pathFor: (l: Locale) => string, o: { lastModified?: Date | null; locales?: Locale[]; priority: number }) => {
    const ls = (o.locales ?? locales).filter((l) => locales.includes(l));
    const languages = Object.fromEntries(ls.map((l) => [LOCALE_META[l].hreflang, pathFor(l)]));
    for (const l of ls) out.push({ kind, path: pathFor(l), lastModified: o.lastModified ?? undefined, priority: o.priority, languages });
  };

  add('home', (l) => `/${l}`, { priority: 1, lastModified: catalog.stats.lastCheckAt });
  for (const p of ['tools', 'tasks', 'categories', 'pulse', 'compare', 'doctor'] as const) add('hub', (l) => `/${l}/${p}`, { priority: 0.7 });
  for (const p of ['methodology', 'disclosure', 'corrections', 'about', 'privacy', 'api'] as const) add('static', (l) => href.page(l, p), { priority: 0.3 });
  if (opts.newsletter) add('static', (l) => href.page(l, 'newsletter'), { priority: 0.3 });

  for (const tool of catalog.tools) {
    const withText = (Object.keys(tool.text) as Locale[]).filter((l) => tool.text[l]);
    const lm = tool.lastCheckedAt ?? tool.priceCheckedAt;
    if (tool.indexable.tool) add('tool', (l) => href.tool(l, tool.slug), { locales: withText, lastModified: lm, priority: 0.8 });
    if (tool.indexable.pricing) add('pricing', (l) => href.toolPricing(l, tool.slug), { locales: withText, lastModified: tool.priceCheckedAt, priority: 0.6 });
    if (tool.indexable.alternatives) add('alternatives', (l) => href.toolAlternatives(l, tool.slug), { locales: withText, lastModified: lm, priority: 0.6 });
  }
  for (const task of catalog.tasks) {
    const ok = task.steps
      .filter((s) => s.required)
      .every((s) => catalog.tools.filter((x) => x.status !== 'shutdown' && x.capabilities.some((c) => s.capabilityIds.includes(c.id))).length >= 2);
    if (ok) add('task', (l) => href.task(l, taskSlug(task, l)), { locales: Object.keys(task.text) as Locale[], priority: 0.7 });
  }
  // Taxonomy pages only in locales that have their own text (no fallback duplicates in the index).
  for (const cat of catalog.categories) add('category', (l) => href.category(l, entitySlug(cat, l)), { locales: Object.keys(cat.text) as Locale[], priority: 0.5 });
  for (const cap of catalog.capabilities) {
    const primary = catalog.tools.filter((x) => x.status !== 'shutdown' && x.capabilities.some((c) => c.id === cap.id && c.strength === 'primary')).length;
    if (primary >= 4) add('capability', (l) => href.capability(l, entitySlug(cap, l)), { locales: Object.keys(cap.text) as Locale[], priority: 0.6 });
  }
  const seen = new Set<string>();
  for (const tool of catalog.tools) {
    for (const alt of tool.alternatives.filter((a) => a.source !== 'computed')) {
      const other = catalog.toolsById.get(alt.id);
      if (!other) continue;
      const key = [tool.slug, other.slug].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      if (fairFightGate(tool, other).ok) add('fair_fight', (l) => href.fairFight(l, tool.slug, other.slug), { priority: 0.5 });
    }
  }
  return out;
}

/** Indexable page counts per kind (owner dashboard, weekly report). */
export function indexableCounts(entries: SitemapEntry[]): Record<SitemapKind, number> & { total: number } {
  const counts = { home: 0, hub: 0, static: 0, tool: 0, pricing: 0, alternatives: 0, task: 0, category: 0, capability: 0, fair_fight: 0, total: entries.length };
  for (const e of entries) counts[e.kind]++;
  return counts;
}
