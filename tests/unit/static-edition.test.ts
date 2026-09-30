import { describe, expect, it } from 'vitest';
import { fileFor, goLinks, languagePage, pageLinks, redirectPage, RSC_SHIM } from '@/lib/static/export';
import { catalogFromWire, catalogToWire, reviveDates } from '@/lib/catalog/wire';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';

describe('static export helpers', () => {
  it('maps site paths to files the way static hosts resolve them', () => {
    expect(fileFor('/')).toBe('index.html');
    expect(fileFor('/nl')).toBe('nl.html');
    expect(fileFor('/nl/tools/descript/')).toBe('nl/tools/descript.html');
    expect(fileFor('/en/tasks/caf%C3%A9')).toBe('en/tasks/café.html');
  });

  it('crawls internal pages only, without queries, assets or server routes', () => {
    const html =
      '<a href="/nl/tools">x</a><a href="/nl/match?q=video&amp;b=free">m</a><a href="/go/descript?src=tool">g</a>' +
      '<a href="//cdn.example.com/x">c</a><a href="/_next/static/a.js">s</a><a href="/api/v1/tools">a</a><a href="/icon.svg">i</a><a href="https://x.test/">e</a>';
    expect(pageLinks(html).sort()).toEqual(['/nl/match', '/nl/tools']);
    expect(goLinks(html)).toEqual(['descript']);
  });

  it('writes safe redirect and language pages', () => {
    const page = redirectPage('https://example.com/?a=1&b="2"<');
    expect(page).toContain('content="0; url=https://example.com/?a=1&amp;b=&quot;2&quot;&lt;"');
    expect(page).toContain('\\u003c');
    expect(page).toContain('noindex');
    const lang = languagePage('/bot', ['nl', 'en'], 'https://site.test/nl/bot');
    expect(lang).toContain('url=/nl/bot');
    expect(lang).toContain('["nl","en"]');
  });

  it('only short-circuits Next.js data requests', () => {
    expect(RSC_SHIM).toContain('_rsc=');
    expect(RSC_SHIM).toContain('AbortError');
    expect(RSC_SHIM.startsWith('<script>')).toBe(true);
  });
});

describe('catalog wire format', () => {
  it('round-trips maps and dates through JSON', () => {
    const checked = new Date('2026-09-29T10:00:00.000Z');
    const tool = { id: 't1', slug: 'descript', name: 'Descript', priceCheckedAt: checked, lastCheckedAt: null } as unknown as CatalogTool;
    const catalog = {
      version: 7,
      loadedAt: checked,
      tools: [tool],
      toolsBySlug: new Map([['descript', tool]]),
      toolsById: new Map([['t1', tool]]),
      categories: [],
      categoriesById: new Map(),
      capabilities: [],
      capabilitiesById: new Map(),
      tasks: [],
      tasksById: new Map(),
      fx: { day: '2026-09-29', rates: new Map([['USD', 1.1]]) },
      events: [],
      stats: { tools: 1, facts: 0, plans: 0, sources: 0, supportedShare: 0, checked30dShare: 0, lastCheckAt: checked },
    } as unknown as Catalog;
    const back = catalogFromWire(JSON.parse(JSON.stringify(catalogToWire(catalog)), reviveDates));
    expect(back.toolsBySlug.get('descript')?.priceCheckedAt).toEqual(checked);
    expect(back.toolsById.get('t1')?.name).toBe('Descript');
    expect(back.fx.rates.get('USD')).toBe(1.1);
    expect(back.fx.day).toBe('2026-09-29');
    expect(back.stats.lastCheckAt).toEqual(checked);
  });
});
