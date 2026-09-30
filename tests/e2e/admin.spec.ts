/** The owner area: login, dashboard, inbox, operations, reports, automation. */
import { expect, test } from '@playwright/test';
import { loginAsOwner, watchErrors } from './fixtures';

test('owner can log in and see the dashboard and every section', async ({ page }) => {
  const watch = watchErrors(page);
  await loginAsOwner(page);
  await expect(page.locator('#attention')).toBeVisible();
  for (const path of ['/admin/inbox', '/admin/reports', '/admin/operations', '/admin/automation', '/admin/tools', '/admin/candidates', '/admin/commerce', '/admin/errors']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
  }
  // Tool editor opens from the list.
  await page.goto('/admin/tools?q=descript');
  await page.locator('main a[href^="/admin/tools/"]').first().click();
  await expect(page.locator('main h1')).toContainText('Descript');
  expect(watch.errors).toEqual([]);
});

test('settings validation rejects inconsistent thresholds', async ({ page }) => {
  await loginAsOwner(page);
  await page.goto('/admin/automation');
  const policy = page.locator('#policy form');
  await policy.locator('input[name=autoFlag]').fill('99');
  await policy.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/flash=invalid/);
});
