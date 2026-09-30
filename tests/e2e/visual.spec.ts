/**
 * Visual regression for the key templates. Dynamic regions (ticker, dates,
 * receipt numbers) are masked. Baselines are Linux/Chromium; refresh with
 * `npx playwright test visual --update-snapshots` after intended UI changes.
 */
import { expect, test } from '@playwright/test';

test.skip(({ browserName }) => browserName !== 'chromium', 'baselines are Chromium-only');

const CASES = [
  { name: 'home-nl', path: '/nl' },
  { name: 'tool-nl', path: '/nl/tools/descript' },
  { name: 'pricing-en', path: '/en/tools/elevenlabs/pricing' },
  { name: 'fairfight-en', path: '/en/compare/chatgpt-vs-claude' },
  { name: 'match-en', path: `/en/match?q=${encodeURIComponent('podcast recording and editing')}&skip=1` },
  { name: 'admin-login', path: '/admin/login' },
];

for (const c of CASES) {
  test(`visual ${c.name}`, async ({ page }) => {
    await page.goto(c.path);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`${c.name}.png`, {
      fullPage: false,
      mask: [page.locator('[aria-label*="Pulse"]'), page.locator('time'), page.locator('[data-dynamic]'), page.locator('footer')],
    });
  });
}
