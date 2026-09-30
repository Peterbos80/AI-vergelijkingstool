/**
 * Performance budgets on the production build (Core Web Vitals in the lab):
 * LCP, CLS, TTFB and the amount of JavaScript shipped per template.
 */
import { expect, test } from '@playwright/test';

const BUDGET = { lcpMs: 2500, cls: 0.1, ttfbMs: 800, jsKb: 200 };

const PAGES = ['/nl', '/nl/tools/descript', '/en/tools', `/en/match?q=${encodeURIComponent('automatic meeting notes')}&skip=1`, '/en/compare/chatgpt-vs-claude'];

test.describe.configure({ mode: 'serial' });

for (const path of PAGES) {
  test(`budget ${path}`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CWV APIs are Chromium-only');
    await page.addInitScript(() => {
      const w = window as unknown as { __lcp: number; __cls: number };
      w.__lcp = 0;
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__lcp = Math.max(w.__lcp, e.startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const js = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter((r) => r.initiatorType === 'script' || r.name.endsWith('.js'));
      const w = window as unknown as { __lcp: number; __cls: number };
      return { ttfb: nav.responseStart - nav.requestStart, lcp: w.__lcp, cls: w.__cls, jsKb: js.reduce((s, r) => s + (r.transferSize || r.encodedBodySize), 0) / 1024 };
    });
    test.info().annotations.push({ type: 'metrics', description: JSON.stringify(m) });
    expect(m.lcp, 'LCP ms').toBeLessThan(BUDGET.lcpMs);
    expect(m.cls, 'CLS').toBeLessThan(BUDGET.cls);
    expect(m.ttfb, 'TTFB ms').toBeLessThan(BUDGET.ttfbMs);
    expect(m.jsKb, 'JS KB').toBeLessThan(BUDGET.jsKb);
  });
}
