import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
const failed = new Set();
page.on('response', (r) => { if (r.status() >= 400) failed.add(`${r.status()} ${new URL(r.url()).pathname}`); });
await page.goto('http://localhost:3100' + process.argv[2], { waitUntil: 'load' });
await page.waitForTimeout(3000);
console.log([...failed].slice(0, 30).join('\n'));
await browser.close();
