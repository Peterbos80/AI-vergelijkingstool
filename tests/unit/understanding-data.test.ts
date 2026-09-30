import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalize } from '@/lib/engine/text';
import { UNDERSTANDING, UNDERSTANDING_FRESH } from '@/lib/engine/understanding-eval';

interface Taxonomy {
  capabilities: { id: string }[];
  tasks: { id: string; i18n: Record<string, { title: string; intentPhrases: string[] }>; steps: { capabilities: string[] }[] }[];
}
const taxonomy = JSON.parse(readFileSync('data/taxonomy.json', 'utf8')) as Taxonomy;

describe('understanding sets', () => {
  const taskIds = new Set(taxonomy.tasks.map((t) => t.id));
  const cases = [...UNDERSTANDING, ...UNDERSTANDING_FRESH];

  it('only expect tasks that exist', () => {
    for (const c of cases) for (const id of c.tasks) expect(taskIds.has(id), `${c.q} → ${id}`).toBe(true);
  });

  it('stay held out: no query is also an intent phrase or title', () => {
    const phrases = new Set(taxonomy.tasks.flatMap((t) => Object.values(t.i18n).flatMap((x) => [x.title, ...x.intentPhrases])).map(normalize));
    expect(cases.filter((c) => phrases.has(normalize(c.q))).map((c) => c.q)).toEqual([]);
  });

  it('have no duplicate queries', () => {
    const seen = cases.map((c) => normalize(c.q));
    expect(new Set(seen).size).toBe(seen.length);
  });
});
