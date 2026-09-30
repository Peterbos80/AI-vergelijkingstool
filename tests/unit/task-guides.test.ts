import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TASK_GUIDES, taskGuide } from '@/content/task-guides';

const taxonomy = JSON.parse(readFileSync('data/taxonomy.json', 'utf8')) as { tasks: { id: string }[] };

describe('task guides for beginners', () => {
  it('cover every task in Dutch and English, with three steps and at least one warning', () => {
    for (const { id } of taxonomy.tasks) {
      for (const locale of ['nl', 'en'] as const) {
        const g = TASK_GUIDES[id]?.[locale];
        expect(g, `${id}.${locale}`).toBeDefined();
        expect(g!.what.length, `${id}.${locale}.what`).toBeGreaterThan(40);
        expect(g!.steps).toHaveLength(3);
        expect(g!.watch.length).toBeGreaterThanOrEqual(1);
        expect(g!.tip.length).toBeGreaterThan(10);
      }
    }
  });
  it('only describe tasks that exist', () => {
    const ids = new Set(taxonomy.tasks.map((t) => t.id));
    expect(Object.keys(TASK_GUIDES).filter((id) => !ids.has(id))).toEqual([]);
  });
  it('fall back to English for other languages', () => {
    expect(taskGuide('make-presentations', 'de')).toBe(TASK_GUIDES['make-presentations']!.en);
    expect(taskGuide('does-not-exist', 'nl')).toBeNull();
  });
});
