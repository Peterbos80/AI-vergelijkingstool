import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../setup/pglite';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { loadCatalog } from '@/lib/catalog/load';
import type { Catalog } from '@/lib/catalog/types';
import { detectIntent } from '@/lib/engine/intent';
import { nextClarification } from '@/lib/engine/clarify';
import { composeStack, composeVariants } from '@/lib/engine/compose';
import { GOLDEN } from '@/lib/engine/golden';
import { buildMatrix, fairFightGate, verdicts } from '@/lib/engine/compare';
import { diagnose } from '@/lib/engine/doctor';
import { searchTools } from '@/lib/engine/search';
import { rankForCapability } from '@/lib/engine/rank';

let catalog: Catalog;
let close: () => Promise<void>;

beforeAll(async () => {
  const t = await createTestDb();
  close = t.close;
  await applySeed(t.db, loadSeedData(), new Date('2026-09-30T08:00:00Z'));
  catalog = await loadCatalog(t.db, 1, new Date('2026-09-30T08:00:00Z'));
});
afterAll(async () => close());

describe('golden set: intent + composer', () => {
  for (const c of GOLDEN) {
    it(`${c.id}: ${c.query}`, () => {
      const intent = detectIntent(c.query, catalog, c.locale);
      if (c.expect?.noMatch) {
        expect(intent.taskId).toBeNull();
        expect(intent.capabilityIds).toEqual([]);
        return;
      }
      expect(c.tasks).toContain(intent.taskId);
      if (c.expect?.level) expect(intent.constraints.level).toBe(c.expect.level);
      if (c.expect?.freeOnly) expect(intent.constraints.freeOnly).toBe(true);
      if (c.expect?.budgetCents) expect(intent.constraints.budgetMonthlyCents).toBe(c.expect.budgetCents);
      if (c.expect?.dutch) expect(intent.constraints.dutch).toBe(true);
      if (c.expect?.local) expect(intent.constraints.local).toBe(true);
      if (c.expect?.clarifyApproach) {
        const q = nextClarification(intent, catalog, { answered: 0, budgetAnswered: false, skipAll: false });
        expect(q?.kind).toBe('approach');
      }
      const task = catalog.tasksById.get(intent.taskId!)!;
      const variants = composeVariants(catalog, task, intent.constraints);
      for (const [name, r] of Object.entries(variants)) {
        // Every required step gets a tool, and never a discontinued one.
        for (const s of r.steps.filter((x) => x.required)) {
          expect(s.toolId, `${name}.${s.key}`).not.toBeNull();
        }
        for (const l of r.lines) {
          const tool = catalog.toolsById.get(l.toolId)!;
          expect(['shutdown', 'deprecated', 'waitlist']).not.toContain(tool.status);
        }
        if (c.expect?.freeOnly) {
          for (const l of r.lines.filter((x) => !x.optional)) expect(l.paidCents, `${name} ${tool(l.toolId)}`).toBe(0);
        }
      }
      // The budget variant is never more expensive than the recommended one (same currencies).
      const rec = variants.recommended.totals.core.paid;
      const cheap = variants.budget.totals.core.paid;
      for (const m of cheap) {
        const r = rec.find((x) => x.currency === m.currency);
        if (r) expect(m.cents).toBeLessThanOrEqual(r.cents);
      }
    });
  }
  function tool(id: string) {
    return catalog.toolsById.get(id)?.slug;
  }
});

describe('composer behaviour', () => {
  it('uses one tool for several steps and marks the later steps as shared', () => {
    const task = catalog.tasksById.get('create-social-media-videos')!;
    const r = composeStack(catalog, task, { approach: { visuals: 'video-editing' } }, 'fewest');
    const shared = r.steps.filter((s) => s.sharedFromStep);
    expect(shared.length).toBeGreaterThan(0);
    expect(r.lines.length).toBeLessThan(task.steps.length);
  });
  it('respects a budget by swapping to cheaper tools or free plans', () => {
    const task = catalog.tasksById.get('produce-podcast')!;
    const r = composeStack(catalog, task, { budgetMonthlyCents: 3000, budgetCurrency: 'USD' }, 'recommended');
    expect(r.budget?.paidWithin).toBe(true);
  });
  it('records relaxed constraints instead of silently ignoring them', () => {
    const task = catalog.tasksById.get('automatic-meeting-notes')!;
    const r = composeStack(catalog, task, { eu: true, dutch: true }, 'recommended');
    expect(r.steps[0]!.toolId).not.toBeNull();
    expect(r.relaxed.length).toBeGreaterThan(0);
  });
});

describe('compare, doctor, search, ranking', () => {
  it('builds a matrix with verdicts and gates Fair Fights', () => {
    const a = catalog.toolsBySlug.get('chatgpt')!;
    const b = catalog.toolsBySlug.get('claude')!;
    const rows = buildMatrix([a, b]);
    expect(rows.find((r) => r.key === 'entry_price')).toBeDefined();
    const v = verdicts([a, b], rows);
    expect(v).toHaveLength(2);
    expect(fairFightGate(a, b).differences).toBeGreaterThanOrEqual(0);
  });
  it('diagnoses overlap and suggests a recipe', () => {
    const ids = ['chatgpt', 'claude', 'gemini'].map((s) => catalog.toolsBySlug.get(s)!.id);
    const d = diagnose(catalog, ids, ['cost', 'overlap'], null);
    expect(d.overlaps.length).toBeGreaterThan(0);
    expect(d.recipe.some((r) => r.action === 'remove')).toBe(true);
    expect(d.roasts).toContain('identity');
  });
  it('finds tools by name with typos and by capability words', () => {
    expect(searchTools(catalog, { q: 'elevenlabs' }, 'en')[0]?.tool.slug).toBe('elevenlabs');
    expect(searchTools(catalog, { q: 'elevnlabs' }, 'en')[0]?.tool.slug).toBe('elevenlabs');
    expect(searchTools(catalog, { q: 'voice-over' }, 'nl').length).toBeGreaterThan(2);
  });
  it('ranks core-capability tools before secondary ones', () => {
    const list = rankForCapability(catalog, 'text-to-speech');
    const firstSecondary = list.findIndex((x) => x.capabilities.find((c) => c.id === 'text-to-speech')?.strength === 'secondary');
    const lastPrimary = list.map((x) => x.capabilities.find((c) => c.id === 'text-to-speech')?.strength).lastIndexOf('primary');
    if (firstSecondary >= 0) expect(lastPrimary).toBeLessThan(firstSecondary);
  });
});

describe('ranking independence (money never changes the order)', () => {
  it('no engine module imports monetisation code', () => {
    const dir = path.resolve(process.cwd(), 'src/lib/engine');
    const files = readdirSync(dir).filter((f) => statSync(path.join(dir, f)).isFile());
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/@\/lib\/monetization|\b(affiliateLinks|affiliatePrograms|placements|revenueEntries|conversions|outboundClicks)\b/);
    }
  });
});
