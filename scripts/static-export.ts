/**
 * Build the static edition (GitHub Pages) by crawling a running production
 * server that was started with SITE_MODE=static:
 *
 *   SITE_MODE=static SITE_URL=https://www.example.nl npm run build
 *   SITE_MODE=static SITE_URL=https://www.example.nl npm start &
 *   BASE=http://127.0.0.1:3000 OUT=out npx tsx scripts/static-export.ts
 *
 * Output (OUT):
 *  - every page reachable by links from each live locale's home page and the
 *    sitemap, as <path>.html (plus <path>/index.html when the path also has
 *    child pages, so both URL styles resolve on a static host);
 *  - /go/<slug> redirects as small redirect pages (no click counting);
 *  - Open Graph images as .png files, with the meta tags rewritten;
 *  - /data/<locale>.json for the pages computed in the browser;
 *  - the public API as static JSON (/api/v1/<locale>/…json);
 *  - robots.txt, sitemap.xml, llms.txt, 404.html, and an index.html that
 *    picks the visitor's language;
 *  - /_next/static copied from the build.
 * The export fails when a page cannot be fetched, so a broken build is never
 * published.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assetLinks, fileFor, goLinks, languagePage, pageLinks, redirectPage, RSC_SHIM } from '../src/lib/static/export';

const BASE = (process.env.BASE ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT = path.resolve(process.env.OUT ?? 'out');
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, '');
const LOCALES = (process.env.ENABLED_LOCALES ?? 'nl,en')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const CONCURRENCY = 8;
const HEADERS = { 'x-aitw-synthetic': '1', 'user-agent': 'AIToolsWijzer static export' };

function write(rel: string, body: string | Buffer) {
  const file = path.join(OUT, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
}

async function get(p: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${p}`, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) } });
}

async function pool<T>(items: T[], fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let x = queue.shift(); x !== undefined; x = queue.shift()) await fn(x);
    }),
  );
}

async function main() {
  if (!SITE_URL) throw new Error('SITE_URL is required (the public address of the static site)');
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // 1. Pages: breadth-first from each locale home page plus the sitemap.
  const sitemap = await (await get('/sitemap.xml')).text();
  const seeds = [...LOCALES.map((l) => `/${l}`), ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname)];
  const seen = new Set<string>();
  const pages = new Map<string, string>();
  const go = new Set<string>();
  const assets = new Set<string>();
  let frontier = [...new Set(seeds)];
  while (frontier.length) {
    const next: string[] = [];
    await pool(frontier, async (p) => {
      if (seen.has(p)) return;
      seen.add(p);
      const res = await get(p, { redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (loc) next.push(new URL(loc, BASE).pathname);
        return;
      }
      if (res.status === 404) throw new Error(`Broken internal link: ${p} (404)`);
      if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return;
      const html = await res.text();
      pages.set(p, html);
      for (const l of pageLinks(html)) if (!seen.has(l)) next.push(l);
      for (const g of goLinks(html)) go.add(g);
      for (const a of assetLinks(html)) assets.add(a);
    });
    frontier = [...new Set(next)].filter((p) => !seen.has(p));
  }
  if (!pages.size) throw new Error('No pages crawled');

  // 2. Open Graph images → .png, and page fixups.
  const ogImages = new Map<string, string>();
  const ogRe = /(<meta (?:property|name)="(?:og:image|twitter:image)" content=")([^"]+)(")/g;
  for (const html of pages.values()) {
    for (const m of html.matchAll(ogRe)) {
      const u = new URL(m[2]!.replace(/&amp;/g, '&'));
      if (u.origin === new URL(SITE_URL).origin && !u.pathname.endsWith('.png')) ogImages.set(m[2]!, `${u.pathname}.png`);
    }
  }
  await pool([...ogImages.entries()], async ([abs, png]) => {
    const u = new URL(abs.replace(/&amp;/g, '&'));
    const res = await get(u.pathname + u.search);
    if (!res.ok) throw new Error(`OG image ${u.pathname}: HTTP ${res.status}`);
    write(png.slice(1), Buffer.from(await res.arrayBuffer()));
  });
  const withChildren = new Set<string>();
  for (const p of pages.keys()) {
    const parts = p.split('/');
    for (let i = 2; i < parts.length; i++) withChildren.add(parts.slice(0, i).join('/'));
  }
  for (const [p, html] of pages) {
    // Every occurrence: the URL is also in the React payload, which re-renders the meta tags.
    let fixed = html;
    for (const [url, png] of ogImages) fixed = fixed.split(url).join(`${SITE_URL}${png}`);
    fixed = fixed.replace(/<head>/, `<head>${RSC_SHIM}`);
    write(fileFor(p), fixed);
    if (withChildren.has(p)) write(path.join(decodeURIComponent(p).slice(1), 'index.html'), fixed);
  }

  // 3. Outbound redirects.
  await pool([...go], async (slug) => {
    const res = await get(`/go/${slug}?src=static`, { redirect: 'manual' });
    const target = res.headers.get('location');
    if (!target || !/^https?:\/\//.test(target)) throw new Error(`/go/${slug}: no redirect target`);
    write(`go/${slug}.html`, redirectPage(target));
  });

  // 4. Browser data, public API, root files, assets.
  for (const l of LOCALES) {
    const res = await get(`/data/${l}.json`);
    if (!res.ok) throw new Error(`/data/${l}.json: HTTP ${res.status} (is the server running with SITE_MODE=static?)`);
    write(`data/${l}.json`, await res.text());
    for (const ep of ['tools', 'tasks', 'changes']) {
      const r = await get(`/api/v1/${ep}?locale=${l}`);
      if (!r.ok) throw new Error(`/api/v1/${ep}: HTTP ${r.status}`);
      const text = await r.text();
      write(`api/v1/${l}/${ep}.json`, text);
      if (ep === 'tools') {
        const slugs = ((JSON.parse(text) as { tools?: { slug: string }[] }).tools ?? []).map((x) => x.slug);
        await pool(slugs, async (slug) => {
          const one = await get(`/api/v1/tools/${slug}?locale=${l}`);
          if (!one.ok) throw new Error(`/api/v1/tools/${slug}: HTTP ${one.status}`);
          write(`api/v1/${l}/tools/${slug}.json`, await one.text());
        });
      }
    }
  }
  for (const f of ['/robots.txt', '/sitemap.xml', '/llms.txt', ...assets]) {
    const res = await get(f);
    if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
    write(f.slice(1), Buffer.from(await res.arrayBuffer()));
  }
  const notFound = await get(`/${LOCALES[0]}/__static-export-404__`);
  if (notFound.status !== 404) throw new Error(`404 page: expected 404, got ${notFound.status}`);
  write('404.html', (await notFound.text()).replace(/<head>/, `<head>${RSC_SHIM}`));
  write('index.html', languagePage('', LOCALES, `${SITE_URL}/${LOCALES[0]}`));
  write('bot.html', languagePage('/bot', LOCALES, `${SITE_URL}/${LOCALES[0]}/bot`));
  write('.nojekyll', '');
  const staticDir = path.resolve('.next/static');
  if (!existsSync(staticDir)) throw new Error('.next/static missing: run the build first');
  cpSync(staticDir, path.join(OUT, '_next/static'), { recursive: true });

  console.log(`[static-export] ${pages.size} pages, ${go.size} redirects, ${ogImages.size} images → ${OUT}`);
}

main().catch((err) => {
  console.error('[static-export] failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
