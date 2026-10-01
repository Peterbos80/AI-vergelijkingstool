/**
 * "Wat kost het voor mij?" (/costs and the task pages), the free check and the
 * EU alternative: the slider changes order and amounts, no console errors,
 * axe without serious or critical issues. Works with and without ECB rates
 * (the e2e database is seeded without them).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './fixtures';

/** Tool rows of a calculator in page order, with their computed amounts. */
async function rows(page: Page, meter: string): Promise<{ order: string[]; cents: number[] }> {
  const items = page.locator(`[data-meter="${meter}"] li[data-tool]`);
  const order = await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-tool') ?? ''));
  const cents = await items.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-cents'))));
  return { order, cents };
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test('the costs hub renders, and moving the slider changes order and amounts', async ({ page }) => {
  const watch = watchErrors(page);
  const res = await page.goto('/nl/costs');
  expect(res?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Wat kost AI voor jouw gebruik?');
  const calc = page.locator('[data-meter="transcribe"][data-hydrated="1"]');
  await expect(calc).toBeVisible();

  const at10 = await rows(page, 'transcribe');
  expect(at10.order).toContain('amberscript');
  const summary = calc.getByTestId('cost-summary');
  const before = await summary.textContent();

  // Keyboard on the slider: Home = the minimum (1 hour a month).
  const slider = calc.getByRole('slider');
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(calc.getByRole('spinbutton')).toHaveValue('1');
  await expect(summary).not.toHaveText(before ?? '');
  const at1 = await rows(page, 'transcribe');
  expect(at1.order).not.toEqual(at10.order);
  expect(at1.cents).not.toEqual(at10.cents);
  // Amberscript: Pro (€29) at 10 hours, pay as you go (€10) at 1 hour.
  expect(at10.cents[at10.order.indexOf('amberscript')]).toBe(2900);
  expect(at1.cents[at1.order.indexOf('amberscript')]).toBe(1000);

  // The euro ranking is sorted by computed price only.
  const ranked = await calc.getByTestId('cost-ranking').locator('li[data-tool]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-cents'))));
  expect(ranked).toEqual([...ranked].sort((a, b) => a - b));

  // Typing a number works too.
  await calc.getByRole('spinbutton').fill('25');
  await expect(slider).toHaveValue('25');
  expect((await rows(page, 'transcribe')).cents).not.toEqual(at1.cents);
  expect(watch.errors).toEqual([]);
});

test('every meter and the team costs tab work', async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto('/en/costs');
  await expect(page.locator('[data-meter="transcribe"][data-hydrated="1"]')).toBeVisible();
  for (const meter of ['voiceover', 'avatar', 'audio-cleanup', 'dubbing']) {
    await page.locator(`input[type=radio][value="${meter}"]`).check({ force: true });
    await expect(page.locator(`[data-meter="${meter}"]`)).toBeVisible();
    await expect(page.locator(`[data-meter="${meter}"]`).getByTestId('cost-summary')).not.toBeEmpty();
  }
  // Avatar video: Synthesia's minutes per month are computable.
  await page.locator('input[type=radio][value="avatar"]').check({ force: true });
  expect((await rows(page, 'avatar')).order).toContain('synthesia');

  await page.getByRole('tab', { name: 'Team costs' }).click();
  const team = page.locator('[data-testid="team-costs"][data-hydrated="1"]');
  await expect(team).toBeVisible();
  const summary = team.getByTestId('team-summary');
  await expect(summary).toContainText('5 users');
  await team.getByRole('spinbutton').fill('1');
  await expect(summary).toContainText('1 user');
  // ChatGPT Business has a two-seat minimum: one user pays for two seats.
  await expect(team.locator('tr[data-plan="chatgpt/business"]')).toContainText('you pay for 2');
  await team.locator('input[type=radio][value="annual"]').check({ force: true });
  await expect(summary).toContainText('annual billing');
  expect(watch.errors).toEqual([]);
});

test('task pages show the calculator and the free check; tool pages the EU alternative', async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto('/nl/tasks/audio-transcriberen');
  await expect(page.getByRole('heading', { name: 'Wat kost het voor mij?' })).toBeVisible();
  await expect(page.locator('[data-meter="transcribe"][data-hydrated="1"]')).toBeVisible();
  const free = page.locator('section[aria-labelledby="free-check"]');
  await expect(free.getByRole('heading', { name: 'Wat krijg je echt gratis?' })).toBeVisible();
  // Unknown is shown as a dash with "onbekend", never as "nee".
  await expect(free).toContainText('onbekend');

  await page.goto('/nl/tasks/social-media-videos-maken');
  await expect(page.locator('section[aria-labelledby="free-check"]')).toBeVisible();
  await expect(page.locator('[data-meter]')).toHaveCount(0);

  await page.goto('/nl/tools/descript');
  const eu = page.getByTestId('eu-alternatives');
  await expect(eu.getByRole('heading', { name: 'Europees alternatief' })).toBeVisible();
  await expect(eu).toContainText('Een Europees bedrijf zegt nog niets over waar je data staat');
  await expect(eu.locator('a[data-label="european"]').first()).toHaveAttribute('href', '/nl/costs#label-european');
  // European companies get no EU-alternative section.
  await page.goto('/nl/tools/amberscript');
  await expect(page.getByTestId('eu-alternatives')).toHaveCount(0);
  expect(watch.errors).toEqual([]);
});

test('labels link to their reason', async ({ page }) => {
  await page.goto('/nl/costs');
  for (const id of ['label-cheapest', 'label-truly-free', 'label-european']) await expect(page.locator(`#${id}`)).toBeVisible();
});

for (const path of ['/nl/costs', '/en/tasks/transcribe-audio', '/nl/tasks/voice-over-maken']) {
  test(`a11y ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('[data-meter][data-hydrated="1"]').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
}

test('a11y /en/costs team tab', async ({ page }) => {
  await page.goto('/en/costs');
  await expect(page.locator('[data-meter][data-hydrated="1"]')).toBeVisible();
  await page.getByRole('tab', { name: 'Team costs' }).click();
  await expect(page.getByTestId('team-costs')).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test('a11y in the dark theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/nl/tasks/audio-transcriberen');
  await expect(page.locator('[data-meter][data-hydrated="1"]')).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test('no horizontal scrolling on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/nl/costs');
  await expect(page.locator('[data-meter][data-hydrated="1"]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.getByRole('tab', { name: 'Teamkosten' }).click();
  await expect(page.getByTestId('team-costs')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  // On task pages the new sections stay inside the viewport (wide tables scroll inside their own box).
  await page.goto('/nl/tasks/audio-transcriberen');
  await expect(page.locator('[data-meter][data-hydrated="1"]')).toBeVisible();
  for (const sel of ['section[aria-labelledby="task-costs"]', 'section[aria-labelledby="free-check"]']) {
    const right = await page.locator(sel).evaluate((el) => {
      const w = document.documentElement.clientWidth;
      let max = 0;
      const walk = (node: Element) => {
        const r = node.getBoundingClientRect();
        max = Math.max(max, r.right);
        const style = getComputedStyle(node);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') return; // scrolls inside its own box
        for (const child of node.children) walk(child);
      };
      walk(el);
      return max - w;
    });
    expect(right, sel).toBeLessThanOrEqual(1);
  }
});

test('the costs hub is in the sitemap', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/nl/costs');
  expect(sitemap).toContain('/en/costs');
});
