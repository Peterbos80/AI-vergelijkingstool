import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests for the static edition (GitHub Pages): serve the exported files
 * (OUT, default "out") the way GitHub Pages resolves paths, then check the
 * pages that run in the browser.
 */
const PORT = Number(process.env.STATIC_PORT ?? 3400);

export default defineConfig({
  testDir: 'tests/e2e-static',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, locale: 'en-GB', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx scripts/serve-static.ts',
    url: `http://localhost:${PORT}/nl`,
    env: { PORT: String(PORT), OUT: process.env.OUT ?? 'out' },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
