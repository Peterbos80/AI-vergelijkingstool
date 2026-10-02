/**
 * A tool the tool scout put live in quarantine: its page carries the
 * "new, being checked" notice and noindex; Explore and Pulse show "Just in".
 * The tool is written straight into the e2e database (the agents themselves
 * are tested in tests/integration/scout.test.ts) and removed afterwards.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import nl from '../../src/i18n/messages/nl.json';

const DB = process.env.E2E_DATABASE_URL ?? 'postgres://aitw:aitw@localhost:5432/aitoolswijzer_e2e';
const SLUG = 'e2e-scoutly';

test.skip(Boolean(process.env.E2E_BASE_URL), 'writes to the e2e database');
test.describe.configure({ mode: 'serial' });

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

const bump = () =>
  sql(`INSERT INTO settings (key, value, updated_by) VALUES ('data_version', '1'::jsonb, 'e2e')
       ON CONFLICT (key) DO UPDATE SET value = to_jsonb(COALESCE((settings.value #>> '{}')::bigint, 0) + 1), updated_at = now()`);

test.beforeAll(async () => {
  const discovery = {
    candidateId: '00000000-0000-0000-0000-0000000000e2',
    addedAt: new Date(Date.now() - 3600_000).toISOString(),
    popularity: 4,
    signals: [
      { kind: 'hackernews', value: 231, url: 'https://news.ycombinator.com/item?id=41001', at: new Date(Date.now() - 86_400_000).toISOString(), label: null },
      { kind: 'github', value: 4200, url: 'https://github.com/scoutly-labs/scoutly', at: new Date().toISOString(), label: null },
    ],
    primaryCapability: 'transcription',
    checks: { green: 1, lastAt: new Date().toISOString(), lastOk: true, failures: 0, lastFailureAt: null, lastReason: null },
    promotedAt: null,
  };
  const [tool] = await sql<{ id: string }>(
    `INSERT INTO tools (slug, name, website_url, published, quarantine_until, discovery, website_status, skill_level)
     VALUES ($1, 'Scoutly', 'https://scoutly.example/', true, now() + interval '6 days', $2::jsonb, 'up', 'intermediate')
     ON CONFLICT (slug) DO UPDATE SET published = true, quarantine_until = EXCLUDED.quarantine_until, discovery = EXCLUDED.discovery
     RETURNING id`,
    [SLUG, JSON.stringify(discovery)],
  );
  await sql(`INSERT INTO tool_capabilities (tool_id, capability_id, strength) VALUES ($1, 'transcription', 'secondary') ON CONFLICT DO NOTHING`, [tool!.id]);
  const [src] = await sql<{ id: string }>(
    `INSERT INTO sources (url, domain, source_type, tool_id, role) VALUES ('https://scoutly.example/', 'scoutly.example', 'official', $1, 'website')
     ON CONFLICT (url) DO UPDATE SET tool_id = EXCLUDED.tool_id RETURNING id`,
    [tool!.id],
  );
  await sql(`DELETE FROM facts WHERE tool_id = $1`, [tool!.id]);
  await sql(
    `INSERT INTO facts (tool_id, key, value, status, confidence, source_id, evidence, method, observed_at, created_by)
     VALUES ($1, 'site_description', '"Transcribe your interviews with AI."'::jsonb, 'unverified', 95, $2, 'Transcribe your interviews with AI.', 'agent', now(), 'agent:new-tools')`,
    [tool!.id, src!.id],
  );
  await bump();
});

test.afterAll(async () => {
  await sql(`DELETE FROM sources WHERE url = 'https://scoutly.example/'`).catch(() => undefined);
  await sql(`DELETE FROM tools WHERE slug = $1`, [SLUG]);
  await bump();
});

test('Explore shows "Just in" with the new tool, its label, quote and sources', async ({ page }) => {
  const section = page.getByTestId('new-tools');
  // The server reloads its catalogue within 15 seconds of a data change.
  await expect(async () => {
    await page.goto('/nl/tools');
    await expect(section).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 45_000 });
  await expect(section.getByRole('heading', { name: nl.newTools.title })).toBeVisible();
  const card = section.getByRole('listitem').filter({ hasText: 'Scoutly' });
  await expect(card.getByRole('link', { name: 'Scoutly' })).toHaveAttribute('href', `/nl/tools/${SLUG}`);
  await expect(card).toContainText(nl.newTools.badge);
  await expect(card).toContainText(nl.newTools.inCheck);
  await expect(card).toContainText('“Transcribe your interviews with AI.”');
  await expect(card.getByRole('link', { name: 'Hacker News · 231 punten' })).toHaveAttribute('href', 'https://news.ycombinator.com/item?id=41001');
  await expect(card.getByRole('link', { name: 'GitHub · 4.200 sterren' })).toBeVisible();
  const results = await new AxeBuilder({ page: page as never }).include('[data-testid="new-tools"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('the tool page says "new, being checked" and is noindex', async ({ page }) => {
  await page.goto(`/nl/tools/${SLUG}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Scoutly' })).toBeVisible();
  await expect(page.getByText(nl.tool.quarantineNotice)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('every page the static export crawls from it works: pricing, alternatives, the share image, the outbound link', async ({ page, request }) => {
  await page.goto(`/nl/tools/${SLUG}`);
  const og = await page.locator('meta[property="og:image"]').first().getAttribute('content');
  const paths = [`/nl/tools/${SLUG}/pricing`, `/nl/tools/${SLUG}/alternatives`, new URL(og!).pathname + new URL(og!).search];
  for (const path of paths) {
    const res = await request.get(path);
    expect(res.status(), path).toBeLessThan(400);
  }
  for (const path of paths.slice(0, 2)) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute('content', /noindex/);
  }
  const go = await request.get(`/go/${SLUG}`, { maxRedirects: 0 });
  expect(go.status()).toBeGreaterThanOrEqual(300);
  expect(go.status()).toBeLessThan(400);
});

test('Pulse shows "Just in" too', async ({ page }) => {
  await page.goto('/nl/pulse');
  await expect(page.getByTestId('new-tools').getByRole('link', { name: 'Scoutly' })).toBeVisible();
});
