/**
 * "Just in" lists the tool scout's tools only, by the scout's own record:
 * never editorial tools, however recently they were added.
 */
import { describe, expect, it } from 'vitest';
import { inQuarantine, newTools } from '@/lib/catalog/new-tools';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';

const NOW = new Date('2026-10-02T08:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

function tool(slug: string, extra: Partial<CatalogTool> = {}): CatalogTool {
  return { id: `id-${slug}`, slug, name: slug, quarantineUntil: null, discovery: null, ...extra } as CatalogTool;
}

function catalog(live: CatalogTool[], quarantined: CatalogTool[]): Catalog {
  return { tools: live, quarantined } as Catalog;
}

const scout = (addedDaysAgo: number) => ({ addedAt: daysAgo(addedDaysAgo), promotedAt: null, signals: [] });

describe('newTools', () => {
  it('lists scout tools in quarantine and scout tools promoted in the last days, newest first', () => {
    const c = catalog(
      [
        tool('editorial-today'), // added by hand or by the seed today: not a scout discovery
        tool('promoted-3d', { discovery: { ...scout(8), addedAt: daysAgo(6) } }),
        tool('promoted-long-ago', { discovery: scout(30) }),
      ],
      [tool('fresh', { quarantineUntil: daysAgo(-6), discovery: scout(1) }), tool('slow-check', { quarantineUntil: daysAgo(-1), discovery: scout(10) })],
    );
    expect(newTools(c, NOW).map((t) => t.slug)).toEqual(['fresh', 'promoted-3d', 'slow-check']);
    expect(newTools(c, NOW, 3).map((t) => t.slug)).toEqual(['fresh', 'slow-check']);
  });
  it('never lists editorial tools, also not when they are in quarantine for another reason', () => {
    const c = catalog([tool('a'), tool('b')], [tool('manual', { quarantineUntil: daysAgo(-3) })]);
    expect(newTools(c, NOW)).toEqual([]);
    expect(inQuarantine(tool('manual', { quarantineUntil: daysAgo(-3) }))).toBe(true);
  });
});
