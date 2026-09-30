import { expect, type Page } from '@playwright/test';

export const E2E_ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-owner@example.test',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-password-not-for-production',
};

/** Collect console errors and failed same-origin requests during a test. */
export function watchErrors(page: Page): { errors: string[] } {
  const state = { errors: [] as string[] };
  page.on('pageerror', (e) => state.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) state.errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (r.status() >= 500 && url.origin === new URL(page.url() || 'http://x').origin) state.errors.push(`${r.status()} ${url.pathname}`);
  });
  return state;
}

export async function loginAsOwner(page: Page) {
  await page.goto('/admin/login');
  await page.fill('#email', E2E_ADMIN.email);
  await page.fill('#password', E2E_ADMIN.password);
  await Promise.all([page.waitForURL(/\/admin$/), page.click('button[type=submit]')]);
  await expect(page.locator('main h1')).toBeVisible();
}
