/**
 * Sitemap with indexability gates (docs/strategy/05 §5): only pages that
 * carry enough unique, sourced data are listed; thin pages stay out.
 */
import type { MetadataRoute } from 'next';
import { enabledLocales, LOCALE_META, type Locale } from '@/i18n/config';
import { entitySlug, getCatalog, taskSlug } from '@/lib/catalog';
import { fairFightGate } from '@/lib/engine/compare';
import { href } from '@/lib/routes';
import { emailEnabled, siteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();
  const locales = enabledLocales();
  const out: MetadataRoute.Sitemap = [];
  const add = (pathFor: (l: Locale) => string, opts: { lastModified?: Date | null; locales?: Locale[]; priority?: number } = {}) => {
    const ls = (opts.locales ?? locales).filter((l) => locales.includes(l));
    const languages = Object.fromEntries(ls.map((l) => [LOCALE_META[l].hreflang, siteUrl(pathFor(l))]));
    for (const l of ls) {
      out.push({
        url: siteUrl(pathFor(l)),
        lastModified: opts.lastModified ?? undefined,
        priority: opts.priority,
        alternates: { languages },
      });
    }
  };

  add((l) => `/${l}`, { priority: 1, lastModified: catalog.stats.lastCheckAt });
  for (const p of ['tools', 'tasks', 'categories', 'pulse', 'compare', 'doctor'] as const) add((l) => `/${l}/${p}`, { priority: 0.7 });
  for (const p of ['methodology', 'disclosure', 'corrections', 'about', 'privacy', 'api'] as const) add((l) => href.page(l, p), { priority: 0.3 });
  if (emailEnabled()) add((l) => href.page(l, 'newsletter'), { priority: 0.3 });

  for (const tool of catalog.tools) {
    const withText = (Object.keys(tool.text) as Locale[]).filter((l) => tool.text[l]);
    const lm = tool.lastCheckedAt ?? tool.priceCheckedAt;
    if (tool.indexable.tool) add((l) => href.tool(l, tool.slug), { locales: withText, lastModified: lm, priority: 0.8 });
    if (tool.indexable.pricing) add((l) => href.toolPricing(l, tool.slug), { locales: withText, lastModified: tool.priceCheckedAt, priority: 0.6 });
    if (tool.indexable.alternatives) add((l) => href.toolAlternatives(l, tool.slug), { locales: withText, lastModified: lm, priority: 0.6 });
  }
  for (const task of catalog.tasks) {
    const ok = task.steps
      .filter((s) => s.required)
      .every((s) => catalog.tools.filter((x) => x.status !== 'shutdown' && x.capabilities.some((c) => s.capabilityIds.includes(c.id))).length >= 2);
    if (ok) add((l) => href.task(l, taskSlug(task, l)), { locales: Object.keys(task.text) as Locale[], priority: 0.7 });
  }
  for (const cat of catalog.categories) add((l) => href.category(l, entitySlug(cat, l)), { priority: 0.5 });
  for (const cap of catalog.capabilities) {
    const primary = catalog.tools.filter((x) => x.status !== 'shutdown' && x.capabilities.some((c) => c.id === cap.id && c.strength === 'primary')).length;
    if (primary >= 4) add((l) => href.capability(l, entitySlug(cap, l)), { priority: 0.6 });
  }
  const seen = new Set<string>();
  for (const tool of catalog.tools) {
    for (const alt of tool.alternatives.filter((a) => a.source !== 'computed')) {
      const other = catalog.toolsById.get(alt.id);
      if (!other) continue;
      const key = [tool.slug, other.slug].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      if (fairFightGate(tool, other).ok) add((l) => href.fairFight(l, tool.slug, other.slug), { priority: 0.5 });
    }
  }
  return out;
}
