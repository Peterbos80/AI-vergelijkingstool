/**
 * Compare: pick tools by tapping them (logo, name, price), filter by world or
 * search by name, get the alternatives of the last pick, at most four.
 * Without JavaScript it is a plain form of checkboxes that still works.
 */
import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './fixtures';

const tile = (page: Page, name: string) => page.locator('label.pick').filter({ has: page.locator('.pick-name', { hasText: new RegExp(`^${name}$`) }) });

test('pick tools by tapping them, with alternatives as suggestions', async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto('/nl/compare');
  await expect(page.locator('.chooser[data-hydrated]')).toBeVisible();
  const submit = page.locator('.chooser button[type=submit]');
  await expect(submit).toBeDisabled();
  await tile(page, 'ChatGPT').click();
  await expect(submit).toHaveText('Kies nog 1 tool');
  // The alternatives of the last pick come as one-tap suggestions.
  await expect(page.locator('.chooser-suggest')).toContainText('Alternatieven voor ChatGPT');
  await page.locator('.chooser-suggest button').first().click();
  await expect(submit).toHaveText('Vergelijk 2 tools');
  await submit.click();
  await page.waitForURL(/\/nl\/compare\?tools=chatgpt,[a-z0-9-]+$/);
  await expect(page.locator('main table thead')).toContainText('ChatGPT');
  // With a result on screen the chooser folds away.
  await expect(page.locator('details.chooser-box')).not.toHaveAttribute('open', '');
  expect(watch.errors).toEqual([]);
});

test('a world narrows the list, search finds by name, four is the limit', async ({ page }) => {
  await page.goto('/nl/compare');
  await expect(page.locator('.chooser[data-hydrated]')).toBeVisible();
  const tiles = page.locator('label.pick');
  const all = await tiles.count();
  await page.locator('.chooser-worlds').getByRole('button', { name: 'Video', exact: true }).click();
  const video = await tiles.count();
  expect(video).toBeGreaterThan(0);
  expect(video).toBeLessThan(all);
  for (const t of await tiles.all()) await expect(t).toHaveAttribute('data-world', 'video');
  await page.locator('.chooser-worlds').getByRole('button', { name: 'Alles' }).click();
  await page.locator('#chooser-q').fill('clau');
  await expect(tiles.first()).toContainText('Claude');
  await page.locator('#chooser-q').fill('');
  for (const name of ['ChatGPT', 'Claude', 'Gemini', 'Ollama']) await tile(page, name).click();
  await expect(tile(page, 'Microsoft Copilot').locator('input')).toBeDisabled();
  await expect(page.locator('.chooser-full')).toBeVisible();
  // Taking one away frees a place.
  await page.getByRole('button', { name: 'Ollama weghalen' }).click();
  await expect(tile(page, 'Microsoft Copilot').locator('input')).toBeEnabled();
});

test('without JavaScript the form still compares', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/nl/compare');
  await tile(page, 'ChatGPT').click();
  await tile(page, 'Claude').click();
  await page.locator('.chooser button[type=submit]').click();
  await expect(page).toHaveURL(/tools=chatgpt&tools=claude/);
  await expect(page.locator('main table thead')).toContainText('Claude');
  await ctx.close();
});
