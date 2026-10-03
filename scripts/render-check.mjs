/**
 * Do the key pages paint in a given WebKit? A plain script (no test runner),
 * so it can drive an older Playwright and with it an older WebKit: the engine
 * of every browser on an iPhone, as it was in an earlier iOS. Used by the
 * Browser check workflow; the site must be served at BASE.
 *
 *   PW_DIR=/tmp/pw node scripts/render-check.mjs http://127.0.0.1:3400
 *
 * PW_DIR is a folder with that Playwright installed (npm i playwright@x.y.z).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:3400';
const require = createRequire(path.resolve(process.env.PW_DIR ?? '.') + '/');
const { webkit, devices } = require('playwright');
// One page of every kind, the same as the render tests (tests/e2e-static/render.spec.ts).
const PAGES = JSON.parse(readFileSync(new URL('../tests/e2e-static/render-pages.json', import.meta.url), 'utf8'));

const browser = await webkit.launch();
console.log(`WebKit ${browser.version()}`);
let failed = 0;
/** Resolves with the page's answer, or null when its main thread does not answer in time. */
const ask = (page, fn, ms = 3000) => Promise.race([page.evaluate(fn).catch((e) => `error: ${e.message}`), new Promise((r) => setTimeout(() => r(null), ms))]);
/** React's recoverable hydration errors: the browser rendered other text than the server. The page still paints. */
const HYDRATION = /Minified React error #(418|423|425)\b|Hydration failed|hydrat/i;

/**
 * The formats of src/i18n/formatters.ts. Client components format in the
 * browser what the server formatted in Node; where the two differ, React
 * finds other text than the server sent (a hydration error).
 */
function intlSamples() {
  const d = new Date('2026-09-29T10:00:00Z');
  const timeZone = 'Europe/Amsterdam';
  const out = {};
  for (const l of ['nl-NL', 'en-GB']) {
    out[`${l} date`] = new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(d);
    out[`${l} long date`] = new Intl.DateTimeFormat(l, { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(d);
    out[`${l} day-month`] = new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short', timeZone }).format(d);
    out[`${l} date-time`] = new Intl.DateTimeFormat(l, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(d);
    out[`${l} EUR`] = new Intl.NumberFormat(l, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.5);
    out[`${l} USD`] = new Intl.NumberFormat(l, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(20);
    out[`${l} number`] = new Intl.NumberFormat(l, { maximumFractionDigits: 1 }).format(1234.56);
    out[`${l} percent`] = new Intl.NumberFormat(l, { style: 'percent', maximumFractionDigits: 0 }).format(0.256);
    out[`${l} relative`] = new Intl.RelativeTimeFormat(l, { numeric: 'auto' }).format(-3, 'day');
  }
  return out;
}
const shown = (v) => JSON.stringify(v).replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
{
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.goto(base + PAGES[0], { timeout: 20_000 }).catch(() => undefined);
  const inBrowser = await page.evaluate(intlSamples).catch(() => ({}));
  const inNode = intlSamples();
  const differ = Object.keys(inNode).filter((k) => inNode[k] !== inBrowser[k]);
  console.log(differ.length ? `Intl differs from Node (the server):\n${differ.map((k) => `  ${k}: Node ${shown(inNode[k])}, browser ${shown(inBrowser[k])}`).join('\n')}` : 'Intl formats as Node (the server) does');
  await context.close();
}
let warned = 0;

for (const p of PAGES) {
  // A fresh iPhone for every page: one page that hangs must not take the others down.
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  const errors = [];
  // Requests, not URLs: the same file can be asked for twice.
  const pending = new Set();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => pending.add(r));
  page.on('requestfinished', (r) => pending.delete(r));
  page.on('requestfailed', (r) => pending.delete(r));
  const t0 = Date.now();
  let verdict;
  try {
    await page.goto(base + p, { timeout: 20_000 });
    const h1 = page.locator('h1').first();
    await h1.waitFor({ state: 'visible', timeout: 10_000 });
    // Painted, not only parsed: the heading takes room (measured a few times, as hydration may still be busy).
    let box = null;
    for (let k = 0; k < 20 && !(box && box.height > 0); k++) {
      if (k) await new Promise((r) => setTimeout(r, 100));
      box = await h1.boundingBox().catch(() => null);
    }
    const real = errors.filter((e) => !HYDRATION.test(e));
    if (box && box.height > 0) verdict = real.length ? `errors: ${real.join(' | ').slice(0, 200)}` : 'ok';
    else {
      const how = await ask(page, () => {
        const h = document.querySelector('h1');
        if (!h) return 'no h1';
        const s = getComputedStyle(h);
        const r = h.getBoundingClientRect();
        return `"${h.textContent.trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}, display ${s.display}, visibility ${s.visibility}, font-size ${s.fontSize}, line-height ${s.lineHeight}, ${document.readyState}`;
      });
      verdict = `heading without size: ${how ?? 'no answer'}`;
    }
  } catch (e) {
    // Why: still loading files or fonts, or a main thread that no longer answers (a hang)?
    const state = await ask(page, () => {
      const fonts = [...document.fonts].filter((f) => f.status !== 'unloaded').map((f) => `${f.family} ${f.weight} ${f.status}`);
      return `${document.readyState}, h1: ${Boolean(document.querySelector('h1'))}, body: ${document.body ? document.body.innerText.length : 0} chars, fonts ${document.fonts.status} (${fonts.join(', ')})`;
    });
    const waiting = [...pending].map((r) => r.url().replace(base, '')).slice(0, 6);
    verdict = `FAIL: ${String(e.message ?? e).split('\n')[0].slice(0, 120)} | page: ${state ?? 'no answer (main thread busy)'} | waiting for: ${waiting.join(', ') || 'nothing'}${errors.length ? ` | errors: ${errors.join(' | ').slice(0, 200)}` : ''}`;
  }
  if (verdict !== 'ok') failed++;
  // Reported, not failed: React renders that part again in the browser, and the page works.
  const hydration = errors.filter((e) => HYDRATION.test(e));
  if (hydration.length) warned++;
  console.log(`${verdict === 'ok' ? 'ok  ' : 'FAIL'} ${p} (${Date.now() - t0} ms)${verdict === 'ok' ? '' : ` ${verdict}`}${hydration.length ? ` · hydration: ${hydration[0].slice(0, 90)}` : ''}`);
  await context.close().catch(() => undefined);
}
await browser.close().catch(() => undefined);
console.log(failed ? `${failed} of ${PAGES.length} pages did not paint` : `all ${PAGES.length} pages painted`);
if (warned) console.log(`${warned} with a hydration error: the browser rendered other text than the server (see Intl above)`);
process.exitCode = failed ? 1 : 0;
