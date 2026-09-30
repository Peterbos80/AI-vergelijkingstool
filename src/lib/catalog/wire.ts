/**
 * Catalog ↔ JSON for the static edition's browser pages (Match, Stack Doctor,
 * explorer, compare): maps travel as arrays and ISO timestamps are revived as
 * Dates, so the same pure engine and views run in the browser.
 */
import type { Catalog } from './types';

export interface CatalogWire {
  version: number;
  loadedAt: Date;
  tools: Catalog['tools'];
  categories: Catalog['categories'];
  capabilities: Catalog['capabilities'];
  tasks: Catalog['tasks'];
  fx: { day: string | null; rates: [string, number][] };
  stats: Catalog['stats'];
}

export function catalogToWire(c: Catalog): CatalogWire {
  return {
    version: c.version,
    loadedAt: c.loadedAt,
    tools: c.tools,
    categories: c.categories,
    capabilities: c.capabilities,
    tasks: c.tasks,
    fx: { day: c.fx.day, rates: [...c.fx.rates] },
    stats: c.stats,
  };
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/** JSON.parse reviver: full ISO timestamps become Dates (plain dates such as fx days stay strings). */
export function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_TIMESTAMP.test(value) ? new Date(value) : value;
}

export function catalogFromWire(w: CatalogWire): Catalog {
  return {
    version: w.version,
    loadedAt: new Date(w.loadedAt),
    tools: w.tools,
    toolsBySlug: new Map(w.tools.map((t) => [t.slug, t])),
    toolsById: new Map(w.tools.map((t) => [t.id, t])),
    categories: w.categories,
    categoriesById: new Map(w.categories.map((c) => [c.id, c])),
    capabilities: w.capabilities,
    capabilitiesById: new Map(w.capabilities.map((c) => [c.id, c])),
    tasks: w.tasks,
    tasksById: new Map(w.tasks.map((t) => [t.id, t])),
    fx: { day: w.fx.day, rates: new Map(w.fx.rates) },
    events: [],
    stats: w.stats,
  };
}
