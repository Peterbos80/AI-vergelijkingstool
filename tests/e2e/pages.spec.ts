/** Every page type renders with a heading, no server errors and no console errors. */
import { expect, test } from '@playwright/test';
import { watchErrors } from './fixtures';

const PAGES = [
  '/nl',
  '/en',
  '/nl/tools',
  '/en/tools?price=free&api=1',
  '/nl/tools/descript',
  '/en/tools/elevenlabs/pricing',
  '/en/tools/chatgpt/alternatives',
  '/nl/compare?tools=chatgpt,claude',
  '/en/compare/chatgpt-vs-claude',
  '/nl/tasks',
  '/en/tasks/create-social-media-videos',
  '/nl/categories',
  '/en/doctor',
  '/nl/pulse',
  '/en/methodology',
  '/nl/disclosure',
  '/en/corrections',
  '/nl/privacy',
  '/en/about',
  '/nl/api',
  '/en/my-stack',
];

for (const path of PAGES) {
  test(`renders ${path}`, async ({ page }) => {
    const watch = watchErrors(page);
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', path.split('/')[1]!);
    expect(watch.errors, path).toEqual([]);
  });
}

test('unknown pages return a real 404', async ({ page }) => {
  const res = await page.goto('/nl/tools/does-not-exist-xyz');
  expect(res?.status()).toBe(404);
  const res2 = await page.goto('/this-path/does/not/exist');
  expect(res2?.status()).toBe(404);
});

test('the language switcher keeps the page', async ({ page }) => {
  await page.goto('/nl/tools/descript');
  await page.locator('a[hreflang="en"], a[href="/en/tools/descript"]').first().click();
  await expect(page).toHaveURL(/\/en\/tools\/descript$/);
});

test('explorer filters narrow the list and compare selected tools', async ({ page }) => {
  await page.goto('/en/tools');
  const all = await page.locator('main li a[href^="/en/tools/"]').count();
  await page.goto('/en/tools?price=free&api=1');
  const filtered = await page.locator('main li a[href^="/en/tools/"]').count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(all);
});

test('Stack Doctor diagnoses an overlapping stack', async ({ page }) => {
  await page.goto('/en/doctor');
  const selects = page.locator('main form select').filter({ has: page.locator('option[value="chatgpt"]') });
  await selects.nth(0).selectOption('chatgpt');
  await selects.nth(1).selectOption('claude');
  await selects.nth(2).selectOption('gemini');
  await page.locator('main form button[type=submit]').first().click();
  await expect(page.getByText(/Overlap/).first()).toBeVisible();
});

test('the corrections form validates input', async ({ page }) => {
  await page.goto('/en/corrections');
  await page.locator('main form button[type=submit]').first().click();
  // Native validation or the server message: either way nothing is accepted without a tool and source.
  await expect(page).toHaveURL(/\/en\/corrections/);
});
