/**
 * The home page feature update: the conversational question box, prompts
 * that switch the view level and the tool matrix, and the live panels that
 * show only real data.
 */
import { expect, test } from '@playwright/test';
import { watchErrors } from './fixtures';

test('a prompt fills the question box and switches the level and the matrix', async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto('/nl');
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-level', 'advanced');

  await page.getByRole('link', { name: /LLM via API koppelen/ }).click();
  await expect(page).toHaveURL(/\/nl$/);
  await expect(page.locator('html')).toHaveAttribute('data-level', 'advanced');
  await expect(page.locator('#match-q')).toHaveValue(/API/);
  const panel = page.locator('#tool-matrix .matrix-panel:not([hidden])');
  await expect(panel).toHaveCount(1);
  await expect(panel.locator('thead th:visible')).toContainText(['Tool', 'API', 'Integraties']);
  await expect(panel.locator('thead th', { hasText: 'Kosten' })).toBeHidden();

  // Back to Basis with the tabs; the choice sticks across pages.
  await page.getByRole('tab', { name: /Basis/ }).last().click();
  await expect(page.locator('html')).toHaveAttribute('data-level', 'basis');
  await expect(panel.locator('thead th', { hasText: 'Kosten' })).toBeVisible();
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

test('the stage shows the world of the question', async ({ page }) => {
  await page.goto('/nl');
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  const stage = page.locator('.stage');
  await expect(stage).toHaveAttribute('data-world', 'home');
  await page.getByRole('tab', { name: 'Typ je vraag' }).click();
  await page.locator('#match-q').fill('ik wil een podcast opnemen');
  await expect(stage).toHaveAttribute('data-world', 'audio');
  await expect(page.locator('.stage-caption a')).toHaveAttribute('href', /^\/nl\/categories\//);
  // A prompt previews its world while the pointer is on it.
  await page.getByRole('link', { name: /Social video/ }).hover();
  await expect(stage).toHaveAttribute('data-world', 'video');
  await page.mouse.move(0, 0);
  await expect(stage).toHaveAttribute('data-world', 'audio');
  // An empty box goes back to the wijzer's office.
  await page.locator('#match-q').fill('');
  await expect(stage).toHaveAttribute('data-world', 'home');
});

test('ten worlds, each a link to its category with its tool count', async ({ page }) => {
  await page.goto('/nl');
  const cards = page.locator('section[aria-labelledby="worlds-title"] .world-card');
  await expect(cards).toHaveCount(10);
  for (const card of await cards.all()) {
    await expect(card).toHaveAttribute('href', /^\/nl\/categories\//);
    await expect(card.locator('.world-card-meta')).toHaveText(/^\d+ tools?$/);
  }
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
