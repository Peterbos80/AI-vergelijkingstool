/** Automated accessibility checks (WCAG 2.1 AA rules in axe-core) on the key templates. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/nl',
  '/en/tools',
  '/nl/tools/descript',
  '/en/tools/elevenlabs/pricing',
  '/en/compare/chatgpt-vs-claude',
  '/nl/tasks/create-social-media-videos',
  `/en/match?q=${encodeURIComponent('make social media videos')}&skip=1`,
  '/en/doctor',
  '/nl/pulse',
  '/en/methodology',
  '/nl/corrections',
  '/admin/login',
];

for (const path of PAGES) {
  test(`a11y ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

test('keyboard: skip link moves focus to the content', async ({ page }) => {
  await page.goto('/nl');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});
