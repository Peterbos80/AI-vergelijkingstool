/** Security headers, access control and abuse guards. */
import { expect, test } from '@playwright/test';

test('HTML responses carry a nonce CSP and hardening headers', async ({ request }) => {
  const res = await request.get('/nl');
  const h = res.headers();
  expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy']).toContain("object-src 'none'");
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['strict-transport-security']).toContain('max-age=');
  expect(h['x-powered-by']).toBeUndefined();
});

test('admin pages require a session and are never indexed', async ({ page, request }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  const res = await request.get('/admin/login');
  expect(res.headers()['x-robots-tag']).toContain('noindex');
  expect(res.headers()['cache-control']).toContain('no-store');
});

test('cron endpoint rejects missing or wrong secrets', async ({ request }) => {
  expect([401, 503]).toContain((await request.post('/api/cron/agents')).status());
  expect([401, 503]).toContain((await request.post('/api/cron/agents', { headers: { Authorization: 'Bearer wrong-secret-wrong-secret' } })).status());
});

test('outbound redirect only goes to known tools', async ({ request }) => {
  const unknown = await request.get('/go/not-a-tool', { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
  const known = await request.get('/go/descript', { maxRedirects: 0 });
  expect(known.status()).toBe(302);
  expect(known.headers()['location']).toMatch(/^https:\/\//);
  expect(known.headers()['x-robots-tag']).toContain('noindex');
});

test('failed admin logins do not reveal whether an account exists', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('#email', 'nobody@example.test');
  await page.fill('#password', 'wrong-password-123');
  await page.click('button[type=submit]');
  await expect(page.locator('#login-error')).toBeVisible();
  const unknownMsg = await page.locator('#login-error').textContent();
  await page.fill('#email', 'e2e-owner@example.test');
  await page.fill('#password', 'wrong-password-456');
  await page.click('button[type=submit]');
  await expect(page.locator('#login-error')).toHaveText(unknownMsg ?? '');
});
