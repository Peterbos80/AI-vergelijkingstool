/**
 * A page of every kind in the static edition paints, in Chromium and in
 * WebKit: the engine of every browser on an iPhone. On 3 Oct 2026 the home
 * page stayed a white page on iPhones while Chromium was fine; a page that
 * never finishes loading, or never shows its heading, fails here. CI runs
 * this for every change; the Browser check workflow runs it for any commit,
 * without deploying.
 */
import { expect, test } from '@playwright/test';
// One page of every kind; scripts/render-check.mjs checks the same pages in older WebKits.
import PAGES from './render-pages.json';

for (const path of PAGES) {
  test(`renders ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(path, { timeout: 20_000 });
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    // Painted, not only parsed: the heading takes room on the screen.
    expect((await h1.boundingBox())?.height ?? 0).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('the home page: the question, ten worlds and the fair fights', async ({ page }) => {
  await page.goto('/nl');
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  await expect(page.locator('.world-grid .world-card[data-world]')).toHaveCount(10);
  await expect(page.locator('.duel-grid .duel').first()).toBeVisible();
});

// Nothing sticks out sideways on a phone, down to the 320px of an iPhone SE: a page wider than
// the screen pans sideways, and a fair fight 91px too wide never finished loading in the
// WebKit of iOS 17.4 (3 Oct 2026).
test.describe('on a narrow phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const path of PAGES) {
    test(`fits the screen: ${path}`, async ({ page }) => {
      // After hydration too: the question box shows its tabs only then.
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, 'pixels wider than the screen').toBeLessThanOrEqual(0);
    });
  }
});
