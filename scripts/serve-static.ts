/**
 * Serve the static edition locally the way GitHub Pages resolves paths:
 * exact file → <path>.html → <path>/index.html → 404.html (status 404).
 * Used by the static smoke tests (playwright.static.config.ts).
 *
 *   OUT=out PORT=3400 npx tsx scripts/serve-static.ts
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(process.env.OUT ?? 'out');
const PORT = Number(process.env.PORT ?? 3400);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function isFile(p: string) {
  return existsSync(p) && statSync(p).isFile();
}

export function resolveStatic(root: string, urlPath: string): { file: string; status: number } {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const base = path.join(root, clean);
  if (!base.startsWith(root)) return { file: path.join(root, '404.html'), status: 404 };
  for (const candidate of [base, `${base.replace(/[/\\]$/, '')}.html`, path.join(base, 'index.html')]) {
    if (isFile(candidate)) return { file: candidate, status: 200 };
  }
  return { file: path.join(root, '404.html'), status: 404 };
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const { file, status } = resolveStatic(ROOT, pathname);
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`[serve-static] ${ROOT} on http://localhost:${PORT}`));
