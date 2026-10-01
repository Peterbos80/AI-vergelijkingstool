/**
 * Duels (Fair Fights): pairs from the editorial alternatives that pass the
 * fair-fight gate, the best-documented first, each tool once and, where
 * possible, one pair per world.
 */
import { fairFightGate } from '@/lib/engine/compare';
import { toolWorld } from './helpers';
import type { Catalog, CatalogTool } from './types';

export function allDuels(catalog: Catalog): [CatalogTool, CatalogTool][] {
  const fights: [CatalogTool, CatalogTool][] = [];
  const seen = new Set<string>();
  for (const tool of catalog.tools) {
    for (const alt of tool.alternatives.filter((a) => a.source === 'editorial')) {
      const other = catalog.toolsById.get(alt.id);
      if (!other) continue;
      const key = [tool.slug, other.slug].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      if (fairFightGate(tool, other).ok) fights.push([tool, other]);
    }
  }
  return fights.sort((x, y) => y[0].qualityScore + y[1].qualityScore - (x[0].qualityScore + x[1].qualityScore));
}

export function pickDuels(catalog: Catalog, n: number): [CatalogTool, CatalogTool][] {
  const fights = allDuels(catalog);
  const out: [CatalogTool, CatalogTool][] = [];
  const usedTools = new Set<string>();
  const usedWorlds = new Set<string>();
  for (const strict of [true, false]) {
    for (const [a, b] of fights) {
      if (out.length >= n || usedTools.has(a.id) || usedTools.has(b.id) || (strict && usedWorlds.has(toolWorld(a, catalog)))) continue;
      out.push([a, b]);
      usedTools.add(a.id).add(b.id);
      usedWorlds.add(toolWorld(a, catalog));
    }
  }
  return out;
}
