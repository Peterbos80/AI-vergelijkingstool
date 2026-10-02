/**
 * "Just in": the tools the tool scout added (docs/strategy/12 §4.4). Based on
 * the scout's own record (`tool.discovery`), never on when a row was created,
 * so editorial tools added by hand or by the seed never count as new here.
 * Pure: no database access, usable in server and client components.
 */
import type { Catalog, CatalogTool } from './types';

const DAY = 86_400_000;

/** A tool in quarantine (live on its own page, not yet in rankings or recommendations). */
export function inQuarantine(tool: Pick<CatalogTool, 'quarantineUntil'>): boolean {
  return tool.quarantineUntil !== null;
}

/**
 * Scout tools added in the last `days` days, plus every scout tool still in
 * quarantine (it carries the "new, being checked" label until promoted).
 * Newest first.
 */
export function newTools(catalog: Catalog, now: Date, days = 7): CatalogTool[] {
  const since = now.getTime() - days * DAY;
  const seen = new Set<string>();
  const out: CatalogTool[] = [];
  for (const tool of [...(catalog.quarantined ?? []), ...catalog.tools]) {
    if (seen.has(tool.id) || !tool.discovery) continue;
    if (tool.discovery.addedAt.getTime() > now.getTime()) continue;
    if (!inQuarantine(tool) && tool.discovery.addedAt.getTime() < since) continue;
    seen.add(tool.id);
    out.push(tool);
  }
  return out.sort((a, b) => b.discovery!.addedAt.getTime() - a.discovery!.addedAt.getTime() || a.name.localeCompare(b.name));
}
