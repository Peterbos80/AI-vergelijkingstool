/**
 * Which CSS makes a page hang in a given WebKit? Loads one page of the static
 * edition (served at BASE) in an older WebKit: as published, without
 * JavaScript and without CSS, to see which of the two is involved. If CSS is,
 * it narrows the stylesheets down to the smallest set of rules that still
 * hangs the page (delta debugging: drop halves, then quarters, and so on,
 * keeping what still hangs), then to the declarations within those rules. It
 * repeats that until the page loads without what it found, so it reports
 * every cause, not only the first. Used by the Browser check workflow (input
 * `bisect`).
 *
 *   PW_DIR=/tmp/pw node scripts/render-bisect.mjs http://127.0.0.1:3400 /nl/compare/x-vs-y
 *
 * PW_DIR is a folder with that Playwright installed (npm i playwright@x.y.z).
 */
import { createRequire } from 'node:module';
import path from 'node:path';

const [base = 'http://127.0.0.1:3400', target = '/nl'] = process.argv.slice(2);
const require = createRequire(path.resolve(process.env.PW_DIR ?? '.') + '/');
const { webkit, devices } = require('playwright');
const LOAD_MS = 8_000;
const ANSWER_MS = 2_000;
const MAX_TRIES = 260;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Skip a string or a comment that starts at i; returns the index after it (or i when there is none). */
function skip(css, i) {
  const c = css[i];
  if (c === '"' || c === "'") {
    for (i++; i < css.length && css[i] !== c; i++) if (css[i] === '\\') i++;
    return i + 1;
  }
  if (c === '/' && css[i + 1] === '*') {
    const end = css.indexOf('*/', i + 2);
    return end < 0 ? css.length : end + 2;
  }
  return i;
}

/** Parse CSS into a tree: style rules and at-rules, with the blocks of grouping at-rules as children. */
function parse(css) {
  let i = 0;
  function block() {
    const nodes = [];
    let start = i;
    while (i < css.length) {
      const next = skip(css, i);
      if (next !== i) {
        // A comment before a rule is dropped with it; one on its own is harmless.
        i = next;
        continue;
      }
      const c = css[i];
      if (c === ';') {
        const text = css.slice(start, i + 1).trim();
        if (text) nodes.push({ kind: 'stmt', text });
        start = ++i;
      } else if (c === '{') {
        const prelude = css.slice(start, i).trim();
        i++;
        if (/^@(media|supports|layer|container|document|scope|starting-style)\b/.test(prelude)) {
          nodes.push({ kind: 'group', prelude, children: block() });
        } else {
          // A leaf: a style rule (nested rules and all), or @font-face, @keyframes, @property and the like.
          let depth = 1;
          const bodyStart = i;
          while (i < css.length && depth > 0) {
            const after = skip(css, i);
            if (after !== i) {
              i = after;
              continue;
            }
            if (css[i] === '{') depth++;
            else if (css[i] === '}') depth--;
            i++;
          }
          nodes.push({ kind: 'leaf', prelude, body: css.slice(bodyStart, i - 1) });
        }
        start = i;
      } else if (c === '}') {
        i++;
        return nodes;
      } else i++;
    }
    return nodes;
  }
  return block();
}

/** A rule's declarations, when its body is a plain list of them (no nested rules); else null. */
function declarations(body) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; ) {
    const next = skip(body, i);
    if (next !== i) {
      i = next;
      continue;
    }
    const c = body[i];
    if (c === '{') return null;
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth === 0) {
      if (body.slice(start, i).trim()) out.push(body.slice(start, i).trim());
      start = i + 1;
    }
    i++;
  }
  if (body.slice(start).trim()) out.push(body.slice(start).trim());
  return out;
}

/** Number the leaves of every sheet (statements such as `@layer a, b;` are always kept). */
function number(nodes, sheet, out) {
  for (const n of nodes) {
    if (n.kind === 'leaf') {
      n.id = out.length;
      n.sheet = sheet;
      out.push(n);
    } else if (n.kind === 'group') number(n.children, sheet, out);
  }
  return out;
}

/** A sheet with only the leaves in `keep`; `decls` (leaf id → kept declarations) trims a leaf's body. */
function serialize(nodes, keep, decls) {
  let s = '';
  for (const n of nodes) {
    if (n.kind === 'stmt') s += n.text;
    else if (n.kind === 'leaf') {
      if (keep.has(n.id)) s += `${n.prelude}{${decls?.has(n.id) ? decls.get(n.id).join(';') : n.body}}`;
    } else {
      const inner = serialize(n.children, keep, decls);
      if (inner) s += `${n.prelude}{${inner}}`;
    }
  }
  return s;
}

const html = await (await fetch(base + target)).text();
const hrefs = [...html.matchAll(/<link\b[^>]*>/g)]
  .map((m) => m[0])
  .filter((tag) => /\brel="stylesheet"/.test(tag))
  .map((tag) => tag.match(/\bhref="([^"]+)"/)?.[1])
  .filter(Boolean);
const sheets = await Promise.all(
  hrefs.map(async (href) => {
    const url = new URL(href.replaceAll('&amp;', '&'), base);
    return { path: url.pathname, tree: parse(await (await fetch(url)).text()) };
  }),
);
const all = [];
for (const s of sheets) number(s.tree, s.path, all);
console.log(`${target}: ${sheets.length} stylesheets, ${all.length} rules`);

/** The stylesheets (path → text) with only these rules, and, per rule, only these declarations. */
function variant(keep, decls) {
  return new Map(sheets.map((s) => [s.path, serialize(s.tree, keep, decls)]));
}

let tries = 0;
let version = '';
/** Load the page with the given stylesheets (null: as published), JavaScript on or off: 'ok', 'hangs' or what went wrong. */
async function load({ css = null, js = true } = {}) {
  tries++;
  // A fresh browser every time: a web process that hangs must not slow the next try down.
  const browser = await webkit.launch();
  version ||= browser.version();
  try {
    const context = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js });
    const page = await context.newPage();
    if (css) await page.route((url) => css.has(url.pathname), (route) => route.fulfill({ status: 200, contentType: 'text/css', body: css.get(new URL(route.request().url()).pathname) }));
    try {
      await page.goto(base + target, { timeout: LOAD_MS });
    } catch (e) {
      return /timeout/i.test(String(e.message)) ? 'hangs' : `fails: ${String(e.message).split('\n')[0].slice(0, 120)}`;
    }
    // Loaded, but does its main thread still answer (a hang can start after the load, with hydration)?
    const answer = await Promise.race([page.evaluate(() => document.readyState).catch(() => null), sleep(ANSWER_MS).then(() => null)]);
    return answer === null ? 'hangs' : 'ok';
  } finally {
    await Promise.race([browser.close().catch(() => undefined), sleep(5_000)]);
  }
}

const published = await load();
const noJs = await load({ js: false });
const noCss = await load({ css: variant(new Set()) });
console.log(`WebKit ${version} · as published: ${published} · without JavaScript: ${noJs} · without CSS: ${noCss}`);

/** Delta debugging (ddmin): a smallest subset of `items` for which `fails` still holds. */
async function ddmin(items, fails) {
  let set = items;
  let n = 2;
  while (set.length >= 2 && tries < MAX_TRIES) {
    const size = Math.ceil(set.length / n);
    const chunks = [];
    for (let k = 0; k < set.length; k += size) chunks.push(set.slice(k, k + size));
    let reduced = false;
    for (const c of chunks) {
      if (await fails(c)) {
        set = c;
        n = 2;
        reduced = true;
        break;
      }
    }
    if (!reduced && chunks.length > 2) {
      for (const c of chunks) {
        const rest = set.filter((x) => !c.includes(x));
        if (await fails(rest)) {
          set = rest;
          n = Math.max(n - 1, 2);
          reduced = true;
          break;
        }
      }
    }
    console.log(`  try ${tries}: ${set.length} still hang it`);
    if (!reduced) {
      if (n >= set.length) break;
      n = Math.min(n * 2, set.length);
    }
  }
  return set;
}

if (published === 'ok') {
  console.log('The page loads here; nothing to narrow down.');
} else if (noCss !== 'ok') {
  console.log('It does not load without CSS either: the cause is not in the stylesheets.');
} else {
  // With JavaScript only when the hang needs it: without, every try is quicker and the cause purer.
  const js = noJs === 'ok';
  const hangs = async (keep, decls) => (await load({ css: variant(new Set(keep), decls), js })) !== 'ok';
  let rest = all.map((l) => l.id);
  let more = await hangs(rest);
  if (!more) console.log('The stylesheets as parsed here do not hang it: the parser loses something.');
  for (let round = 1; more && round <= 4 && tries < MAX_TRIES; round++) {
    console.log(`\nRound ${round}: looking for the rules (JavaScript ${js ? 'on' : 'off'})`);
    const found = await ddmin(rest, (ids) => hangs(ids));
    // Then the declarations within those rules.
    const units = found.flatMap((id) => (declarations(all[id].body) ?? [null]).map((d, k) => ({ id, k, d })));
    const kept = await ddmin(units, (us) => {
      const decls = new Map(found.map((id) => [id, []]));
      for (const u of us) if (u.d !== null) decls.get(u.id).push(u.d);
      const whole = new Set(us.filter((u) => u.d === null).map((u) => u.id));
      for (const id of whole) decls.delete(id);
      return hangs(found.filter((id) => whole.has(id) || decls.get(id)?.length), decls);
    });
    console.log(`\nThese ${found.length} rules hang the page together (${tries} tries so far):`);
    for (const id of found) console.log(`  [${all[id].sheet}] ${all[id].prelude}{${all[id].body.slice(0, 600)}}`);
    console.log('Within them, these declarations are enough:');
    for (const u of kept) console.log(`  ${all[u.id].prelude.slice(0, 160)} → ${u.d ?? '(the whole rule)'}`);
    rest = rest.filter((id) => !found.includes(id));
    more = await hangs(rest);
    console.log(more ? '\nWithout these rules it still hangs: there is more.' : '\nWithout these rules the page loads.');
  }
  if (tries >= MAX_TRIES) console.log(`\nStopped after ${tries} tries.`);
}
