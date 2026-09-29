import { chromium } from '@playwright/test';
const [,, out, ...paths] = process.argv;
const browser = await chromium.launch();
const width = Number(process.env.W ?? 1280);
const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: process.env.DARK ? 'dark' : 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
let i = 0;
for (const p of paths) {
  await page.goto(`http://localhost:3100${p}`, { waitUntil: 'load', timeout: 20000 });
  const file = `${out}/${String(i++).padStart(2, '0')}-${p.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`;
  await page.screenshot({ path: file, fullPage: process.env.FULL === '1' });
  console.log('shot', file);
}
if (errors.length) console.log('CONSOLE ERRORS:', errors.slice(0, 10));
await browser.close();
