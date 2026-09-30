// Dev helper: log in to /admin and screenshot every admin page (local server on :3100).
import { chromium } from '@playwright/test';
const [, , out = '.', email = 'owner@example.test', password = 'correct-horse-battery-staple'] = process.argv;
const base = process.env.BASE ?? 'http://localhost:3100';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: Number(process.env.W ?? 1280), height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`${page.url()}: ${e}`));
await page.goto(`${base}/admin/login`);
await page.fill('#email', email);
await page.fill('#password', password);
await Promise.all([page.waitForURL(`${base}/admin`), page.click('button[type=submit]')]);
const paths = (process.env.PATHS ?? '/admin,/admin/inbox,/admin/inbox?tab=queue,/admin/reports,/admin/operations,/admin/automation,/admin/tools,/admin/candidates,/admin/commerce,/admin/errors').split(',');
let i = 0;
for (const p of paths) {
  const res = await page.goto(`${base}${p}`, { waitUntil: 'load' });
  const file = `${out}/${String(i++).padStart(2, '0')}-${p.replace(/[^a-z0-9]+/gi, '_').slice(0, 50)}.png`;
  await page.screenshot({ path: file, fullPage: process.env.FULL === '1' });
  console.log(res?.status(), p, file);
}
// Follow the first link to an inbox item and a report, if any.
for (const [list, sel] of [['/admin/inbox', 'a[href^="/admin/inbox/"]'], ['/admin/reports', 'a[href^="/admin/reports/"]'], ['/admin/tools', 'a[href^="/admin/tools/"]'], ['/admin/operations', 'a[href^="/admin/operations/runs/"]']]) {
  await page.goto(`${base}${list}`);
  const href = await page.locator(sel).first().getAttribute('href').catch(() => null);
  if (!href) continue;
  const res = await page.goto(`${base}${href}`, { waitUntil: 'load' });
  const file = `${out}/${String(i++).padStart(2, '0')}-${href.replace(/[^a-z0-9]+/gi, '_').slice(0, 50)}.png`;
  await page.screenshot({ path: file, fullPage: process.env.FULL === '1' });
  console.log(res?.status(), href, file);
}
if (errors.length) console.log('CONSOLE ERRORS:', errors.slice(0, 20));
await browser.close();
