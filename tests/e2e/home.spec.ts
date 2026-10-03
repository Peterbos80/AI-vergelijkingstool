/**
 * The home page: the question box (pick from lists or type), prompts that
 * fill the box and switch the view level, the stage with the receipt of the
 * world asked about, the worlds as tiles, and the live panels that show only
 * real data.
 */
import { expect, test } from '@playwright/test';
import { watchErrors } from './fixtures';

test('a prompt fills the question box and switches the level', async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto('/nl');
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-level', 'advanced');

  await page.getByRole('link', { name: /AI koppelen aan je eigen app/ }).click();
  await expect(page).toHaveURL(/\/nl$/);
  await expect(page.locator('html')).toHaveAttribute('data-level', 'advanced');
  await expect(page.locator('#match-q')).toHaveValue(/API/);
  await expect(page.getByRole('link', { name: /AI koppelen aan je eigen app/ })).toHaveAttribute('aria-current', 'true');

  // Back to Basis with the tabs in the header; the choice sticks across pages.
  await page.getByRole('tab', { name: /Basis/ }).last().click();
  await expect(page.locator('html')).toHaveAttribute('data-level', 'basis');
  await page.getByRole('tab', { name: /Technisch/ }).last().click();
  await page.goto('/nl/tasks');
  await expect(page.locator('html')).toHaveAttribute('data-level', 'advanced');

  // Asking goes to Match with the level of the chosen view.
  await page.goto('/nl');
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  await page.getByRole('tab', { name: 'Typ je vraag' }).click();
  await page.locator('#match-q').fill('ik wil gratis mijn vergaderingen laten notuleren');
  await page.locator('#match-q').press('Enter');
  await page.waitForURL(/\/nl\/match\?/);
  expect(new URL(page.url()).searchParams.get('lvl')).toBe('advanced');
  expect(watch.errors).toEqual([]);
});

test('the radar shows real records, never invented ones', async ({ page }) => {
  await page.goto('/nl');
  // Agent status is internal (Admin → Operations), not a public panel.
  await expect(page.locator('section[aria-labelledby="agents-title"]')).toHaveCount(0);
  const radar = page.locator('section[aria-labelledby="radar-title"]');
  await expect(radar).toBeVisible();
  // Every news item and every tool change links to its origin.
  for (const item of await radar.locator('section[aria-labelledby="radar-news"] .news-item, section[aria-labelledby="radar-changes"] .radar-item').all()) {
    await expect(item.locator('a[href^="http"]')).toHaveCount(1);
  }
});

test('the starter plans follow the view level', async ({ page }) => {
  await page.goto('/nl');
  const starters = page.locator('section[aria-labelledby="start-title"] .starter-card');
  await expect(starters.filter({ visible: true })).toHaveCount(3);
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  const first = await starters.filter({ visible: true }).first().innerText();
  await page.getByRole('tab', { name: /Technisch/ }).last().click();
  await expect(starters.filter({ visible: true })).toHaveCount(3);
  expect(await starters.filter({ visible: true }).first().innerText()).not.toBe(first);
});

test('the stage shows the world of the question, with the receipt of its top tool', async ({ page }) => {
  await page.goto('/nl');
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  const stage = page.locator('.stage');
  await expect(stage).toHaveAttribute('data-world', 'home');
  // Before asking: the latest checked price, with its status, date and source.
  const receipt = stage.locator('.stage-paper');
  await expect(receipt.locator('.stage-tool')).toHaveAttribute('href', /^\/nl\/tools\//);
  await expect(receipt.locator('.stage-status')).toHaveText(/^(Gecontroleerd|Onderbouwd)$/);
  await expect(receipt.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  await page.getByRole('tab', { name: 'Typ je vraag' }).click();
  await page.locator('#match-q').fill('ik wil een podcast opnemen');
  await expect(stage).toHaveAttribute('data-world', 'audio');
  await expect(page.locator('.stage-caption a')).toHaveAttribute('href', /^\/nl\/categories\//);
  await expect(receipt.locator('.stage-tool')).toHaveAttribute('href', /^\/nl\/tools\//);
  // A prompt previews its world while the pointer is on it.
  await page.getByRole('link', { name: /Social video/ }).hover();
  await expect(stage).toHaveAttribute('data-world', 'video');
  await page.mouse.move(0, 0);
  await expect(stage).toHaveAttribute('data-world', 'audio');
  // An empty box goes back to the wijzer's office.
  await page.locator('#match-q').fill('');
  await expect(stage).toHaveAttribute('data-world', 'home');
});

test('ten worlds, each a tile linking to its category with its tool count, and one tile for all tools', async ({ page }) => {
  await page.goto('/nl');
  const tiles = page.locator('section[aria-labelledby="worlds-title"] .tile[data-world]');
  await expect(tiles).toHaveCount(10);
  for (const tile of await tiles.all()) {
    await expect(tile).toHaveAttribute('href', /^\/nl\/categories\//);
    await expect(tile.locator('.tile-count')).toHaveText(/^\d+ tools?$/);
  }
  await expect(page.locator('section[aria-labelledby="worlds-title"] .tile-all')).toHaveAttribute('href', '/nl/tools');
});

test('pick from lists: what you want to do, what exactly, what it may cost', async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto('/nl');
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  // Picking from lists is the default way to ask.
  await expect(page.getByRole('tab', { name: 'Kies uit een lijst' })).toHaveAttribute('aria-selected', 'true');
  const go = page.getByRole('button', { name: 'Laat de tools zien' });
  await expect(go).toBeDisabled();
  await page.getByRole('combobox', { name: 'Wat wil je doen?' }).selectOption('video');
  // The stage follows the world, the second list shows its tasks.
  await expect(page.locator('.stage')).toHaveAttribute('data-world', 'video');
  await expect(page.getByRole('combobox', { name: 'Wat precies?' })).toHaveValue('create-social-media-videos');
  await page.getByRole('combobox', { name: 'Wat mag het kosten?' }).selectOption('free');
  await go.click();
  await page.waitForURL(/\/nl\/match\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('task')).toBe('create-social-media-videos');
  expect(url.searchParams.get('b')).toBe('free');
  await expect(page.getByTestId('match-result')).toHaveAttribute('data-task-id', 'create-social-media-videos');
  expect(watch.errors).toEqual([]);
});
