/**
 * 20+ real use cases through the real Match page (the golden set): the right
 * task is understood, every required step gets a usable tool, and questions
 * we cannot answer honestly say so instead of guessing.
 */
import { expect, test } from '@playwright/test';
import { GOLDEN } from '../../src/lib/engine/golden';

test.describe.configure({ mode: 'parallel' });

for (const c of GOLDEN) {
  test(`${c.id}: ${c.query}`, async ({ page }) => {
    const res = await page.goto(`/${c.locale}/match?q=${encodeURIComponent(c.query)}&skip=1`);
    expect(res?.status()).toBe(200);
    if (c.expect?.noMatch) {
      await expect(page.getByTestId('match-nomatch')).toBeVisible();
      return;
    }
    const result = page.getByTestId('match-result');
    await expect(result).toBeVisible();
    expect(c.tasks).toContain(await result.getAttribute('data-task-id'));
    const steps = page.locator('[data-testid="receipt-step"][data-required="1"]');
    expect(await steps.count()).toBeGreaterThan(0);
    for (const s of await steps.all()) expect(await s.getAttribute('data-tool'), await s.getAttribute('data-step') ?? '').not.toBe('');
  });
}

test('the golden set has at least 20 use cases', () => {
  expect(GOLDEN.length).toBeGreaterThanOrEqual(20);
});
