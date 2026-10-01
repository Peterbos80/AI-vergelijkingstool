/**
 * The ten worlds with what a page shows of them: name, place, tool count
 * and the tools at the top of the engine's ranking for the world's first
 * function (never sponsoring, like every engine ranking).
 */
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { rankForCapability } from '@/lib/engine/rank';
import { href } from '@/lib/routes';
import { isWorld, type WorldId } from '@/lib/world-ids';
import { nameOf } from './helpers';
import type { Catalog, CatalogTool } from './types';

export interface WorldSummary {
  id: WorldId;
  name: string;
  place: string;
  description: string | null;
  href: string;
  toolCount: number;
  top: CatalogTool[];
}

export function worldSummaries(catalog: Catalog, t: Translator, locale: Locale, topN = 3): WorldSummary[] {
  const out: WorldSummary[] = [];
  for (const cat of catalog.categories) {
    if (!isWorld(cat.id)) continue;
    const caps = catalog.capabilities.filter((c) => c.categoryId === cat.id).sort((a, b) => a.position - b.position);
    const capIds = new Set(caps.map((c) => c.id));
    const toolCount = catalog.tools.filter((x) => x.status !== 'shutdown' && x.capabilities.some((c) => capIds.has(c.id))).length;
    const top: CatalogTool[] = [];
    for (const cap of caps) {
      for (const tool of rankForCapability(catalog, cap.id)) if (top.length < topN && !top.includes(tool)) top.push(tool);
      if (top.length >= topN) break;
    }
    const n = nameOf(cat, locale);
    out.push({ id: cat.id, name: n.name, place: t(`worlds.places.${cat.id}`), description: n.description, href: href.category(locale, n.slug), toolCount, top });
  }
  return out;
}
