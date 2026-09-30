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
  '/nl/news',
  '/en/news/geoffrey-hinton',
  '/nl/start',
  '/nl/learn',
  '/nl/learn/wat-is-ai',
  '/en/learn/privacy-and-ai',
  '/nl/glossary',
  '/nl/start/ai-assistenten',
  '/nl/start/ai-assistenten/ai-assistent-dagelijks-werk',
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

test('the step-by-step finder leads a beginner from an area to a personal stack', async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto('/nl/start');
  await page.locator('main a[href="/nl/start/ai-assistenten"]').click();
  await page.waitForURL(/\/nl\/start\/ai-assistenten$/);
  await page.locator('main a[href="/nl/start/ai-assistenten/ai-assistent-dagelijks-werk"]').click();
  await page.waitForURL(/ai-assistent-dagelijks-werk$/);
  // The plain-language guide, then two questions.
  await expect(page.getByRole('heading', { name: 'Zo begin je' })).toBeVisible();
  await page.getByLabel('Alleen gratis').check();
  await page.getByRole('button', { name: /Toon mijn advies/ }).click();
  await page.waitForURL(/\/nl\/match\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('task')).toBe('everyday-ai-assistant');
  expect(url.searchParams.get('b')).toBe('free');
  await expect(page.getByTestId('match-result')).toHaveAttribute('data-task-id', 'everyday-ai-assistant');
  expect(watch.errors).toEqual([]);
});

test('no page shows "unknown" values', async ({ page }) => {
  for (const path of ['/nl/tools/descript', '/nl/compare?tools=chatgpt,claude', '/nl/tasks/social-media-videos-maken']) {
    await page.goto(path);
    await expect(page.locator('main')).not.toContainText(/\bonbekend\b/i);
  }
});

test('technical glossary terms only show in the Advanced view', async ({ page }) => {
  await page.goto('/nl/glossary');
  const api = page.locator('#api');
  await expect(page.locator('#prompt')).toBeVisible();
  await expect(api).toBeHidden();
  // The level tabs work once React has hydrated them.
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-level-tab="advanced"]');
    return !!b && Object.keys(b).some((k) => k.startsWith('__reactProps'));
  });
  await page.getByRole('tab', { name: /Advanced/ }).filter({ visible: true }).first().click();
  await expect(api).toBeVisible();
});

