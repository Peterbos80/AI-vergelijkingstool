import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests for the static edition (GitHub Pages): serve the exported files
 * (OUT, default "out") the way GitHub Pages resolves paths, then check the
 * pages that run in the browser, in Chromium and (render.spec.ts) in WebKit.
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
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // WebKit, the engine of every browser on an iPhone: the key pages must paint there too.
    // CI installs it; elsewhere set STATIC_WEBKIT=1 once WebKit is installed.
    ...(process.env.CI || process.env.STATIC_WEBKIT ? [{ name: 'iphone', use: { ...devices['iPhone 13'] }, testMatch: /render\.spec\.ts/ }] : []),
  ],
  webServer: {
    command: 'npx tsx scripts/serve-static.ts',
    url: `http://localhost:${PORT}/nl`,
    env: { PORT: String(PORT), OUT: process.env.OUT ?? 'out' },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
