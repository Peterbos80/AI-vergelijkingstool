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
  await page.getByRole('tab', { name: /Advanced/ }).last().click();
  await page.goto('/nl/tasks');
  await expect(page.locator('html')).toHaveAttribute('data-level', 'advanced');

  // Asking goes to Match with the level of the chosen view.
  await page.goto('/nl');
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  await page.locator('#match-q').fill('ik wil gratis mijn vergaderingen laten notuleren');
  await page.locator('#match-q').press('Enter');
  await page.waitForURL(/\/nl\/match\?/);
  expect(new URL(page.url()).searchParams.get('lvl')).toBe('advanced');
  expect(watch.errors).toEqual([]);
});

test('the agent panel and the radar show real records, never invented ones', async ({ page }) => {
  await page.goto('/nl');
  const agents = page.locator('section[aria-labelledby="agents-title"]');
  await expect(agents).toBeVisible();
  // One row per public agent, each with a state label from its run log.
  await expect(agents.locator('.agent-row')).toHaveCount(13);
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
  await page.getByRole('tab', { name: /Advanced/ }).last().click();
  await expect(starters.filter({ visible: true })).toHaveCount(3);
  expect(await starters.filter({ visible: true }).first().innerText()).not.toBe(first);
});
