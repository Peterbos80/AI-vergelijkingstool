/**
 * Every key page of the static edition paints, in Chromium and in WebKit: the
 * engine of every browser on an iPhone. On 3 Oct 2026 the home page stayed a
 * white page on iPhones while Chromium was fine; a page that never finishes
 * loading, or never shows its heading, fails here. CI runs this for every
 * change; the Browser check workflow runs it for any commit, without deploying.
 */
import { expect, test } from '@playwright/test';

const PAGES = [
  '/nl',
  '/en',
  '/nl/tools',
  '/nl/tools/elevenlabs',
  '/nl/tools/le-chat',
  '/nl/categories',
  '/nl/categories/ai-assistenten',
  '/nl/compare/adobe-firefly-vs-midjourney',
  '/nl/pulse',
];

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

test('the home page: the question, the stage with a receipt, ten worlds and the facts band', async ({ page }) => {
  await page.goto('/nl');
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  await expect(page.locator('.stage .stage-paper')).toBeVisible();
  await expect(page.locator('.bento .tile[data-world]')).toHaveCount(10);
  await expect(page.locator('.stats-band .stat')).toHaveCount(3);
});
