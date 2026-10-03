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
    if (box && box.height > 0) verdict = errors.length ? `errors: ${errors.join(' | ').slice(0, 200)}` : 'ok';
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
  console.log(`${verdict === 'ok' ? 'ok  ' : 'FAIL'} ${p} (${Date.now() - t0} ms)${verdict === 'ok' ? '' : ` ${verdict}`}`);
  await context.close().catch(() => undefined);
}
await browser.close().catch(() => undefined);
console.log(failed ? `${failed} of ${PAGES.length} pages did not paint` : `all ${PAGES.length} pages painted`);
process.exitCode = failed ? 1 : 0;
