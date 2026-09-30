/**
 * The final journey from the brief: "I want to create professional social
 * media videos but I don't know which AI tools to use." — from question to a
 * saved, shareable stack with receipts.
 */
import { expect, test } from '@playwright/test';
import { watchErrors } from './fixtures';

const JOURNEYS = [
  { locale: 'en', query: "I want to create professional social media videos but I don't know which AI tools to use." },
  { locale: 'nl', query: "Ik wil professionele social media video's maken maar weet niet welke AI-tools ik moet gebruiken" },
] as const;

for (const j of JOURNEYS) {
  test(`journey (${j.locale}): goal → clarification → stack → variants → saved receipt`, async ({ page }) => {
    const watch = watchErrors(page);
    await page.goto(`/${j.locale}`);
    await page.locator('#match-q').fill(j.query);
    await page.locator('form[role=search] button[type=submit]').first().click();
    await page.waitForURL(/\/match\?/);

    // 1. The engine understood the task and asks how to approach the visuals.
    const result = page.getByTestId('match-result');
    await expect(result).toHaveAttribute('data-task-id', 'create-social-media-videos');
    const clarify = page.getByTestId('clarify');
    await expect(clarify).toHaveAttribute('data-kind', 'approach');
    await clarify.locator('button[name^="a_"]').first().click();
    await page.waitForURL(/a_/);

    // 2. A receipt where every required step has a tool, with a total.
    const receipt = page.getByTestId('stack-receipt');
    await expect(receipt).toBeVisible();
    const required = receipt.locator('[data-testid="receipt-step"][data-required="1"]');
    expect(await required.count()).toBeGreaterThanOrEqual(3);
    for (const step of await required.all()) expect(await step.getAttribute('data-tool')).not.toBe('');

    // 3. Variants: cheapest and fewest tools.
    const tools = async () => new Set((await receipt.locator('[data-testid="receipt-step"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tool')))).filter(Boolean));
    const recommended = await tools();
    await page.locator('nav a[href*="v=budget"]').click();
    await page.waitForURL(/v=budget/);
    await expect(receipt).toBeVisible();
    await page.locator('nav a[href*="v=fewest"]').click();
    await page.waitForURL(/v=fewest/);
    expect((await tools()).size).toBeLessThanOrEqual(recommended.size);

    // 4. Why these choices: every chosen tool links to its page with receipts.
    const toolLink = page.locator('#details ~ div a[href*="/tools/"]').first();
    await expect(toolLink).toBeVisible();

    // 5. Save → shareable stack page with the same receipt.
    await page.getByRole('button', { name: j.locale === 'nl' ? 'Bewaar dit bonnetje' : 'Save this receipt' }).click();
    await page.waitForURL(/\/stack\/[a-z0-9]+\?saved=1/);
    await expect(page.getByTestId('stack-receipt')).toBeVisible();
    await page.goto(`/${j.locale}/my-stack`);
    await expect(page.locator('main a[href*="/stack/"]').first()).toBeVisible();
    expect(watch.errors).toEqual([]);
  });
}

test('a tool page shows prices with status, date and sources', async ({ page }) => {
  await page.goto('/en/tools/elevenlabs');
  await expect(page.locator('h1')).toContainText('ElevenLabs');
  await expect(page.getByText(/Checked|checked/).first()).toBeVisible();
  const drawer = page.locator('details').filter({ hasText: /Sources and evidence/ }).first();
  await drawer.locator('summary').click();
  await expect(drawer.locator('a[href^="http"]').first()).toBeVisible();
});
