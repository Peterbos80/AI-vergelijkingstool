import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the production build with an isolated, seeded
 * database (scripts/e2e-serve.ts). Set E2E_BASE_URL to test a running
 * deployment instead (read-only specs only).
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide' } },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'nl-NL',
    timezoneId: 'Europe/Amsterdam',
    // Synthetic traffic is excluded from analytics and click counts.
    extraHTTPHeaders: { 'x-aitw-synthetic': '1' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(journey|pages|a11y)\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx tsx scripts/e2e-serve.ts',
        url: `${baseURL}/nl`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'pipe',
      },
});
