/**
 * The static edition (GitHub Pages): pages load from files, and the pages
 * that depend on the URL (Match, Stack Doctor, explorer filters, Compare)
 * compute their result in the browser. No console errors anywhere.
 */
import { expect, test, type Page } from '@playwright/test';

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('the root picks a language and the home page renders', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/(nl|en)$/);
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the final journey runs entirely in the browser', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/en');
  // Enter asks once the question box is interactive.
  await expect(page.locator('.ask[data-hydrated]')).toBeVisible();
  // Typing is the second way to ask (picking from lists is the first).
  await page.locator('#ask-tab-type').click();
  await page.locator('#match-q').fill("I want to create professional social media videos but I don't know which AI tools to use.");
  await page.locator('#match-q').press('Enter');
  await expect(page).toHaveURL(/\/en\/match\?/);
  const result = page.getByTestId('match-result').or(page.getByTestId('clarify'));
  await expect(result.first()).toBeVisible();
  if (await page.getByTestId('clarify').isVisible()) {
    await page.getByRole('button', { name: /skip|overslaan/i }).click();
  }
  await expect(page.getByTestId('match-result')).toHaveAttribute('data-task-id', 'create-social-media-videos');
  const steps = page.getByTestId('receipt-step');
  expect(await steps.count()).toBeGreaterThan(2);
  await expect(page.getByTestId('stack-receipt')).toContainText(/\d/);
  expect(errors).toEqual([]);
});

test('variant links and internal links navigate as normal page loads', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(`/en/match?q=${encodeURIComponent('podcast recording and editing')}&skip=1`);
  await expect(page.getByTestId('match-result')).toBeVisible();
  await page.getByRole('link', { name: /cheapest|budget/i }).first().click();
  await expect(page).toHaveURL(/v=budget/);
  await expect(page.getByTestId('match-result')).toBeVisible();
  await page.goto('/en/tools');
  await page.locator('main a[href^="/en/tools/"]').first().click();
  await expect(page).toHaveURL(/\/en\/tools\/[a-z0-9-]+$/);
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('explorer filters, Compare and Stack Doctor compute from the URL', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/en/tools');
  const all = Number((await page.locator('#results-heading').innerText()).match(/\d+/)?.[0]);
  await page.goto('/en/tools?price=free');
  await expect(page.locator('#results-heading')).toBeVisible();
  const free = Number((await page.locator('#results-heading').innerText()).match(/\d+/)?.[0]);
  expect(free).toBeGreaterThan(0);
  expect(free).toBeLessThan(all);

  await page.goto('/en/compare?tools=chatgpt,claude');
  await expect(page.locator('table').first()).toBeVisible();

  await page.goto('/en/doctor?t=chatgpt&t=claude&t=jasper&submitted=1');
  await expect(page.locator('#diagnosis')).toBeVisible();
  expect(errors).toEqual([]);
});

test('static files: 404 page, outbound redirects, API, data, social images', async ({ page, request }) => {
  const missing = await request.get('/nl/does-not-exist');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('<html');

  const go = await (await request.get('/go/descript')).text();
  expect(go).toMatch(/http-equiv="refresh" content="0; url=https:\/\//);

  const api = await (await request.get('/api/v1/en/tools.json')).json();
  expect(api.tools.length).toBeGreaterThan(50);
  const data = await (await request.get('/data/en.json')).json();
  expect(data.catalog.tools.length).toBeGreaterThan(50);

  const errors = watchConsole(page);
  await page.goto('/nl/tools/descript');
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/\.png$/);
  const img = await request.get(new URL(og!).pathname);
  expect(img.status()).toBe(200);
  expect(img.headers()['content-type']).toBe('image/png');
  expect(errors).toEqual([]);
});

test('no page offers a server-only feature', async ({ page }) => {
  for (const path of ['/nl', '/nl/corrections', '/nl/tools/descript', '/en/doctor']) {
    await page.goto(path);
    expect(await page.locator('form[method="post"], form[method="POST"], input[name^="$ACTION"]').count(), path).toBe(0);
  }
  await page.goto('/nl/corrections');
  await expect(page.getByTestId('corrections-static')).toBeVisible();
  await page.goto('/nl/privacy');
  await expect(page.locator('main')).toContainText('GitHub');
});
