/**
 * Layout gates for the site chrome: the header has at most five navigation
 * items with search, view level and language; below 1024px it shows logo,
 * search and a full-screen menu that closes with Esc and returns focus.
 */
import { expect, test, type Page } from '@playwright/test';

/** Client components react to clicks and keys only after hydration. */
async function hydrated(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'));
  }, selector);
}

test('desktop header: five navigation items, search, view level and language', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/nl/tools');
  const nav = page.getByRole('navigation', { name: 'Hoofdnavigatie' });
  await expect(nav.getByRole('link')).toHaveCount(5);
  await expect(nav.getByRole('link', { name: 'Alle tools' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Zoek een tool' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('tab', { name: 'Technisch', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Taal kiezen' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Menu/ })).toBeHidden();
  expect((await page.getByRole('banner').boundingBox())!.height).toBeLessThanOrEqual(65);
  // No ticker: "Wat is nieuw" (Pulse) carries the number of changes of the last 30 days (hidden at 0).
  await expect(nav.getByRole('link', { name: /^Wat is nieuw( \d+ wijziging(en)? in de laatste 30 dagen)?$/ })).toBeVisible();
  await expect(page.locator('[class*="ticker"]')).toHaveCount(0);
});

test('below 1024px: logo, search and a full-screen menu that closes with Esc', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/nl/tools/descript');
  await expect(page.getByRole('navigation', { name: 'Hoofdnavigatie' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Zoek een tool' })).toBeVisible();
  expect((await page.getByRole('banner').boundingBox())!.height).toBeLessThanOrEqual(57);

  const menu = page.getByRole('button', { name: 'Menu openen' });
  await hydrated(page, '.menu-btn');
  await menu.click();
  const dialog = page.getByRole('dialog', { name: 'Menu' });
  await expect(dialog).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  const box = (await dialog.boundingBox())!;
  expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, 390, 844]);
  await expect(dialog.getByRole('link', { name: 'Check je tools' })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: /Technisch/ })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'English' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  // Following a link closes the menu.
  await menu.click();
  await dialog.getByRole('link', { name: /^Wat is nieuw/ }).click();
  await expect(page).toHaveURL(/\/nl\/pulse$/);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('search opens with "/" and leads to the tool explorer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/nl/pulse');
  await hydrated(page, '.search-btn');
  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'Zoek tussen alle tools' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('searchbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Zoek een tool' })).toBeFocused();

  await page.getByRole('button', { name: 'Zoek een tool' }).click();
  await page.keyboard.type('notion');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/nl\/tools\?q=notion$/);
});
