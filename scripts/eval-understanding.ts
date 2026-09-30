/**
 * How well does Match understand what people type? Scores the engine on the
 * held-out understanding set (src/lib/engine/understanding-eval.ts) with the
 * dataset in data/, in an in-memory database:
 *
 *   npm run eval:understanding            summary and every miss
 *   npm run eval:understanding -- --quiet summary only
 *
 * top-1: the task Match picks is right. top-3: the right task is among the
 * first three candidates. resolved: right task, or no task but a "did you
 * mean" question that offers the right one (what the visitor experiences).
 */
import './_env';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/lib/db/schema';
import type { Database } from '../src/lib/db/client';
import { loadSeedData } from '../src/lib/seed/load';
import { applySeed } from '../src/lib/seed/apply';
import { loadCatalog } from '../src/lib/catalog/load';
import { measureUnderstanding } from '../src/lib/engine/understanding-measure';
import { UNDERSTANDING, UNDERSTANDING_FRESH, type UnderstandingCase } from '../src/lib/engine/understanding-eval';

async function main() {
  const quiet = process.argv.includes('--quiet');
  const client = new PGlite();
  const dir = path.resolve('drizzle');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) await client.exec(stmt);
  }
  const db = drizzle(client, { schema }) as unknown as Database;
  const now = new Date();
  await applySeed(db, loadSeedData(), now);
  const catalog = await loadCatalog(db, 1, now);

  const report = (label: string, cases: UnderstandingCase[]) => {
    const t0 = performance.now();
    const m = measureUnderstanding(cases, catalog);
    const ms = (performance.now() - t0) / Math.max(1, m.n);
    const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
    if (!quiet) {
      console.log(`\n── ${label} ──`);
      for (const x of m.misses)
        console.log(
          `${x.resolved ? '~' : '✗'} [${x.c.locale}] ${x.c.q}\n    want ${x.c.tasks.join(' | ')}; got ${x.got ?? '—'} (${x.score.toFixed(2)}); candidates ${x.candidates.map((c) => `${c.id}:${c.score}`).join(', ') || '—'}`,
        );
    }
    console.log(`${label}: ${m.n} queries · top-1 ${pct(m.top1)} · top-3 ${pct(m.top3)} · resolved ${pct(m.resolved)} · confidently wrong ${pct(m.wrong)} · ${ms.toFixed(2)} ms/query`);
  };
  report('tuning set', UNDERSTANDING);
  report('fresh set', UNDERSTANDING_FRESH);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
