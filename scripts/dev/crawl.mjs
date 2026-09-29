// Crawl internal links from the start pages and report non-2xx/3xx responses.
// Usage: node scripts/dev/crawl.mjs [baseUrl] [maxPages]
const base = process.argv[2] ?? 'http://localhost:3100';
const max = Number(process.argv[3] ?? 800);
const queue = ['/nl', '/en'];
const seen = new Set(queue);
const bad = [];
let count = 0;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 crawl-check';
while (queue.length && count < max) {
  const batch = queue.splice(0, 8);
  await Promise.all(
    batch.map(async (path) => {
      count++;
      let res;
      try {
        res = await fetch(base + path, { redirect: 'manual', headers: { 'User-Agent': UA, 'x-aitw-synthetic': '1' } });
      } catch (e) {
        bad.push(`ERR ${path} ${e}`);
        return;
      }
      if (res.status >= 400) bad.push(`${res.status} ${path}`);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (loc && loc.startsWith('/') && !seen.has(loc)) { seen.add(loc); queue.push(loc); }
        return;
      }
      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('text/html')) return;
      const html = await res.text();
      for (const m of html.matchAll(/href="(\/[^"#]*)"/g)) {
        let href = m[1].replaceAll('&amp;', '&');
        if (href.startsWith('/_next') || href.startsWith('/go/') || href.startsWith('/api/')) continue;
        if (!seen.has(href)) { seen.add(href); queue.push(href); }
      }
    }),
  );
}
console.log(`crawled ${count} pages, ${seen.size} discovered, ${bad.length} problems`);
for (const b of bad.slice(0, 50)) console.log('  ' + b);
