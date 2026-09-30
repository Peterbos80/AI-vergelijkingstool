/** Indexability gates, canonical/hreflang, structured data, sitemap and OG images. */
import { expect, test } from '@playwright/test';

test('tool pages are indexable with canonical, hreflang and JSON-LD', async ({ page }) => {
  await page.goto('/nl/tools/descript');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /\/nl\/tools\/descript$/);
  await expect(page.locator('link[rel=alternate][hreflang=en]')).toHaveAttribute('href', /\/en\/tools\/descript$/);
  const robots = await page.locator('meta[name=robots]').getAttribute('content');
  expect(robots ?? 'index').not.toContain('noindex');
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.length).toBeGreaterThan(0);
  for (const json of ld) expect(() => JSON.parse(json)).not.toThrow();
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/opengraph-image/);
});

test('personal and utility pages are not indexed', async ({ page }) => {
  for (const path of [`/en/match?q=${encodeURIComponent('write blog posts')}`, '/nl/my-stack', '/admin/login']) {
    await page.goto(path);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  }
});

test('robots.txt and sitemap', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toContain('Sitemap:');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect((sitemap.match(/<loc>/g) ?? []).length).toBeGreaterThan(100);
  expect(sitemap).toContain('/nl/tools/descript');
  expect(sitemap).not.toContain('/match');
  expect(sitemap).not.toContain('/admin');
});

test('the crawler page named in our user agent exists and says how to block the bot', async ({ page, request }) => {
  const res = await request.get('/bot', { maxRedirects: 0, headers: { 'Accept-Language': 'en' } });
  expect(res.status()).toBe(307);
  expect(res.headers()['location']).toMatch(/\/en\/bot$/);
  await page.goto('/nl/bot');
  await expect(page.locator('h1')).toContainText('AIToolsWijzerBot');
  await expect(page.getByTestId('bot-robots')).toContainText('User-agent: AIToolsWijzerBot');
});

test('OG receipts render as images', async ({ request }) => {
  for (const path of ['/nl/opengraph-image', '/en/tools/elevenlabs/opengraph-image', '/en/compare/chatgpt-vs-claude/opengraph-image']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
    expect((await res.body()).byteLength).toBeGreaterThan(10_000);
  }
});

test('llms.txt summarises the site for language models', async ({ request }) => {
  const res = await request.get('/llms.txt');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('AIToolsWijzer');
});
