/** The public read-only data API. */
import { expect, test } from '@playwright/test';

test('tools endpoint returns values with status, confidence and dates', async ({ request }) => {
  const res = await request.get('/api/v1/tools?locale=en');
  expect(res.status()).toBe(200);
  expect(res.headers()['access-control-allow-origin']).toBe('*');
  const body = (await res.json()) as { tools: { slug: string; pricing_status: string | null; confidence: number; price_checked_at: string | null }[]; attribution: string };
  expect(body.attribution).toContain('AIToolsWijzer');
  expect(body.tools.length).toBeGreaterThan(50);
  expect(body.tools.every((t) => typeof t.confidence === 'number')).toBe(true);
  const one = await request.get(`/api/v1/tools/${body.tools[0]!.slug}?locale=en`);
  expect(one.status()).toBe(200);
  const tool = await one.json();
  expect(JSON.stringify(tool)).toMatch(/"status":"(verified|supported|community|unverified)"/);
});

test('unknown tool gives 404 JSON', async ({ request }) => {
  const res = await request.get('/api/v1/tools/does-not-exist');
  expect(res.status()).toBe(404);
});

test('tasks and changes endpoints respond', async ({ request }) => {
  for (const path of ['/api/v1/tasks', '/api/v1/changes']) expect((await request.get(path)).status(), path).toBe(200);
});
