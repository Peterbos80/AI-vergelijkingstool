/**
 * Pure helpers for the static edition export (scripts/static-export.ts):
 * URL → file mapping, link extraction and the small pages the export writes.
 */

/**
 * Next.js's client router fetches page data (RSC) from the server; a static
 * host has none. Navigations become normal page loads and prefetches are
 * skipped, without extra network requests or console errors.
 */
export const RSC_SHIM = `<script>(function(){var f=window.fetch;if(!f)return;window.fetch=function(i,o){try{var u=typeof i==="string"?i:(i&&(i.href||i.url))||"";if(/[?&]_rsc=/.test(u)){var h=(o&&o.headers)||{},p=false;for(var k in h){if(/^next-router-(segment-)?prefetch$/i.test(k))p=true}if(p)return Promise.reject(new DOMException("static site","AbortError"));var t=new URL(u,location.href);t.searchParams.delete("_rsc");location.assign(t.href);return new Promise(function(){})}}catch(e){}return f.apply(this,arguments)}})();</script>`;

/** Site path → file path inside OUT ("/" → index.html, "/nl/tools" → nl/tools.html). */
export function fileFor(pagePath: string): string {
  const clean = decodeURIComponent(pagePath).replace(/\/+$/, '');
  return clean === '' ? 'index.html' : `${clean.slice(1)}.html`;
}

/** Internal page links worth crawling: same-site paths without a file extension. */
export function pageLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\shref="(\/[^"]*)"/g)) {
    const raw = m[1]!.replace(/&amp;/g, '&');
    if (raw.startsWith('//')) continue;
    const p = raw.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/';
    if (/^\/(_next|api|admin|data|go)(\/|$)/.test(p)) continue;
    if (/\.[a-z0-9]{2,5}$/i.test(p)) continue;
    out.add(p);
  }
  return [...out];
}

/** Outbound /go/<slug> links. */
export function goLinks(html: string): string[] {
  return [...new Set([...html.matchAll(/\shref="\/go\/([a-z0-9-]+)[^"]*"/g)].map((m) => m[1]!))];
}

/** Static assets referenced from the page (icons, images) outside /_next/static. */
export function assetLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\s(?:href|src)="(\/[^"?#]+\.(?:svg|png|ico|jpg|jpeg|webp|webmanifest|txt|xml))(?:\?[^"]*)?"/gi)) {
    if (!m[1]!.startsWith('/_next/')) out.add(m[1]!);
  }
  return [...out];
}

export function redirectPage(target: string): string {
  const attr = target.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta http-equiv="refresh" content="0; url=${attr}"><link rel="canonical" href="${attr}"><title>→</title><script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')})</script></head><body><a href="${attr}" rel="nofollow">${attr}</a></body></html>\n`;
}

/** Root index.html / bot.html: pick the visitor's language, /<fallback> without JavaScript. */
export function languagePage(suffix: string, locales: string[], canonical: string): string {
  const fallback = locales[0]!;
  const links = locales.map((l) => `<a href="/${l}${suffix}" hreflang="${l}">${l.toUpperCase()}</a>`).join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AIToolsWijzer</title><link rel="canonical" href="${canonical}"><meta http-equiv="refresh" content="0; url=/${fallback}${suffix}"><script>(function(){var live=${JSON.stringify(locales)};var want=(navigator.languages||[navigator.language||""]).map(function(x){return String(x).slice(0,2).toLowerCase()});var l=want.filter(function(x){return live.indexOf(x)>=0})[0]||live[0];location.replace("/"+l+${JSON.stringify(suffix)}+location.search+location.hash)})();</script></head><body>${links}</body></html>\n`;
}
