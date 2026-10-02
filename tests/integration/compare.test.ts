/**
 * Unique comparisons on the real seed (PGlite): usage meters, team costs, the
 * free check, EU alternatives, the /costs sitemap entry, and money-neutral
 * ranking for src/lib/compare and src/lib/pricing.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../setup/pglite';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { loadCatalog } from '@/lib/catalog/load';
import type { Catalog } from '@/lib/catalog/types';
import { buildMeter, computeMeter, meterById, meterCoverage, METERS, metersForTask } from '@/lib/compare/usage';
import { buildTeam, computeTeam } from '@/lib/compare/team';
import { freeCheck, taskTools } from '@/lib/compare/free';
import { euAlternatives } from '@/lib/compare/eu';
import { isEuropeanCountry } from '@/lib/compare/labels';
import { sitemapEntries } from '@/lib/sitemap';

let catalog: Catalog;
let close: () => Promise<void>;

beforeAll(async () => {
  const t = await createTestDb();
  close = t.close;
  await applySeed(t.db, loadSeedData(), new Date('2026-09-30T08:00:00Z'));
  catalog = await loadCatalog(t.db, 1, new Date('2026-09-30T08:00:00Z'));
});
afterAll(async () => close());

/** The seed carries no ECB rates (the fx agent loads them daily); a fixed test rate for the conversion paths. */
const withRates = (c: Catalog): Catalog => ({ ...c, fx: { day: '2026-09-30', rates: new Map([['USD', 1.17]]) } });

describe('usage meters on the real seed', () => {
  it('Amberscript at 10 hours a month is Pro (600 minutes), the cheapest plan that covers 10 hours', () => {
    const data = buildMeter(catalog, meterById('transcribe')!);
    const r = computeMeter(data, 10 * 60);
    const amber = [...r.ranked, ...r.unconverted].find((x) => x.tool.slug === 'amberscript')!;
    expect(amber.best).toMatchObject({ plan: { key: 'pro', minutes: 600 }, cents: 2900, eurCents: 2900 });
    // At 4 hours Starter (300 minutes) covers it; at 30 hours only pay as you go does (€10 per audio hour).
    expect([...computeMeter(data, 240).ranked].find((x) => x.tool.slug === 'amberscript')!.best!.plan.key).toBe('starter');
    expect(computeMeter(data, 1800).ranked.find((x) => x.tool.slug === 'amberscript')!.best).toMatchObject({ plan: { key: 'pay-as-you-go' }, cents: 30000 });
  });

  it('computes exactly these plans per meter; every other plan has a reason', () => {
    const coverage = Object.fromEntries(METERS.map((m) => [m.id, meterCoverage(buildMeter(catalog, m))]));
    expect(Object.fromEntries(Object.entries(coverage).map(([id, c]) => [id, c.computable]))).toEqual({
      transcribe: [
        'amberscript/pay-as-you-go',
        'amberscript/starter',
        'amberscript/pro',
        'amberscript/power',
        'happy-scribe/basic',
        'happy-scribe/pro',
        'happy-scribe/business',
        'otter/basic',
        'turboscribe/unlimited',
        'descript/hobbyist',
      ],
      voiceover: ['murf/creator', 'murf/business'],
      avatar: ['synthesia/free', 'synthesia/starter', 'synthesia/creator'],
      'audio-cleanup': ['auphonic/free', 'auphonic/s', 'auphonic/m', 'auphonic/l', 'auphonic/xl'],
      dubbing: ['rask-ai/creator', 'rask-ai/creator-pro', 'rask-ai/business'],
    });
    expect(coverage.transcribe!.skipped).toEqual([
      { plan: 'otter/pro', reason: 'no_limit' },
      { plan: 'otter/business', reason: 'no_limit' },
      { plan: 'turboscribe/free', reason: 'daily_only' },
      { plan: 'descript/free', reason: 'no_limit' },
      { plan: 'descript/creator', reason: 'not_time' },
      { plan: 'descript/business', reason: 'no_limit' },
    ]);
    expect(coverage.voiceover!.skipped).toEqual([
      { plan: 'murf/free', reason: 'one_off' },
      { plan: 'elevenlabs/free', reason: 'no_limit' },
      { plan: 'elevenlabs/starter', reason: 'credits' },
      { plan: 'elevenlabs/creator', reason: 'credits' },
    ]);
    expect(coverage.avatar!.skipped).toEqual([
      { plan: 'heygen/free', reason: 'not_time' },
      { plan: 'heygen/creator', reason: 'credits' },
      { plan: 'colossyan/starter', reason: 'no_limit' },
      { plan: 'colossyan/business', reason: 'not_time' },
    ]);
    expect(coverage['audio-cleanup']!.skipped).toEqual([
      { plan: 'adobe-podcast/free', reason: 'daily_only' },
      { plan: 'adobe-podcast/premium', reason: 'daily_only' },
      { plan: 'descript/free', reason: 'no_limit' },
      { plan: 'descript/hobbyist', reason: 'other_feature' },
      { plan: 'descript/creator', reason: 'not_time' },
      { plan: 'descript/business', reason: 'no_limit' },
    ]);
    expect(coverage.dubbing!.skipped).toEqual([
      { plan: 'heygen/free', reason: 'not_time' },
      { plan: 'heygen/creator', reason: 'credits' },
      { plan: 'elevenlabs/free', reason: 'no_limit' },
      { plan: 'elevenlabs/starter', reason: 'credits' },
      { plan: 'elevenlabs/creator', reason: 'credits' },
    ]);
  });

  it('ranks by the euro price only, with the ECB rate, and the order follows the usage', () => {
    const data = buildMeter(withRates(catalog), meterById('transcribe')!);
    const order = (h: number) => computeMeter(data, h * 60).ranked.map((x) => `${x.tool.slug}/${x.best!.plan.key}`);
    expect(order(1)).toEqual(['otter/basic', 'amberscript/pay-as-you-go', 'happy-scribe/basic', 'turboscribe/unlimited', 'descript/hobbyist']);
    expect(order(10)).toEqual(['turboscribe/unlimited', 'descript/hobbyist', 'happy-scribe/pro', 'amberscript/pro']);
    const at10 = computeMeter(data, 600);
    expect(at10.ranked[0]!.best).toMatchObject({ cents: 2000, eurCents: Math.round(2000 / 1.17) });
    for (let i = 1; i < at10.ranked.length; i++) expect(at10.ranked[i]!.best!.eurCents!).toBeGreaterThanOrEqual(at10.ranked[i - 1]!.best!.eurCents!);
    expect(at10.notCovered.map((x) => x.tool.slug)).toEqual(['otter']);
  });

  it('voice-over: Murf counts its yearly hours as 120 and 480 minutes a month; Business uses the annual price', () => {
    const r = computeMeter(buildMeter(withRates(catalog), meterById('voiceover')!), 300);
    expect(r.ranked.map((x) => [x.tool.slug, x.best!.plan.key, x.best!.plan.billing, x.best!.cents])).toEqual([['murf', 'business', 'annual', 6600]]);
    expect(r.notComputable.map((t) => t.slug)).toEqual(['elevenlabs']);
  });

  it('places the calculator on the matching task pages', () => {
    for (const m of METERS) for (const task of m.tasks) expect(catalog.tasksById.has(task), task).toBe(true);
    expect(metersForTask('transcribe-audio').map((m) => m.id)).toEqual(['transcribe']);
    expect(metersForTask('automatic-meeting-notes').map((m) => m.id)).toEqual(['transcribe']);
    expect(metersForTask('create-ai-voiceovers').map((m) => m.id)).toEqual(['voiceover']);
    expect(metersForTask('training-videos-ai-presenter').map((m) => m.id)).toEqual(['avatar']);
    expect(metersForTask('translate-and-dub-videos').map((m) => m.id)).toEqual(['dubbing']);
    expect(metersForTask('clean-up-audio').map((m) => m.id)).toEqual(['audio-cleanup']);
    expect(metersForTask('create-social-media-videos')).toEqual([]);
  });
});

describe('team costs on the real seed', () => {
  it('applies the stated seat rules to AI assistants and compares monthly with annual billing', () => {
    const data = buildTeam(withRates(catalog));
    expect(data.groups.map((g) => g.id)).toEqual(['assistants', 'meetings', 'coding', 'presentations', 'video']);
    const assistants = data.groups.find((g) => g.id === 'assistants')!;
    const r = computeTeam(assistants, data.fx, 1, 'monthly');
    const chatgpt = r.ranked.find((x) => x.plan.tool === 'chatgpt')!;
    expect(chatgpt).toMatchObject({ seats: 2, monthlyPerYear: 2500 * 2 * 12, annualPerYear: 2000 * 2 * 12, savingPerYear: 500 * 2 * 12 });
    expect(r.ranked.find((x) => x.plan.tool === 'claude')).toMatchObject({ seats: 2, plan: { minSeats: 2, maxSeats: 150 } });
    for (let i = 1; i < r.ranked.length; i++) expect(r.ranked[i]!.eurPerYear!).toBeGreaterThanOrEqual(r.ranked[i - 1]!.eurPerYear!);
    expect(computeTeam(assistants, data.fx, 200, 'monthly').tooMany.map((p) => p.tool)).toContain('claude');
    const meetings = data.groups.find((g) => g.id === 'meetings')!;
    const ff = meetings.plans.find((p) => p.tool === 'fireflies' && p.key === 'enterprise')!;
    expect(ff).toMatchObject({ annualOnly: true, monthlyCents: null, annualMonthlyCents: 3900 });
  });
});

describe('free check on the real seed', () => {
  it('lists the task tools with their free plan; unknown facts stay unknown', () => {
    const task = catalog.tasksById.get('create-social-media-videos')!;
    const rows = freeCheck(catalog, task);
    expect(rows.map((r) => r.tool.id)).toEqual(taskTools(catalog, task).map((t) => t.id));
    expect(rows.length).toBeGreaterThan(3);
    for (const r of rows) {
      if (r.free !== 'yes') expect(r.watermark).toBeNull();
      expect(r.creditCard).toBeNull(); // not recorded for any tool yet
    }
    const veed = rows.find((r) => r.tool.slug === 'veed');
    if (veed) expect(veed).toMatchObject({ free: 'yes', watermark: true, commercialUse: null });
    // "Truly usable for free" needs both facts; no tool in the seed has both yet.
    expect(catalog.tasks.flatMap((t) => freeCheck(catalog, t)).filter((r) => r.trulyFree)).toEqual([]);
  });
});

describe('EU alternatives on the real seed', () => {
  it('suggests European companies with the same primary capabilities', () => {
    const descript = catalog.toolsBySlug.get('descript')!;
    const alts = euAlternatives(catalog, descript)!;
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) {
      expect(isEuropeanCountry(a.tool.companyCountry), a.tool.slug).toBe(true);
      expect(a.shared.length).toBeGreaterThan(0);
    }
    expect(alts.map((a) => a.tool.slug)).toEqual(expect.arrayContaining(['amberscript', 'happy-scribe', 'veed']));
    const chatgpt = euAlternatives(catalog, catalog.toolsBySlug.get('chatgpt')!)!;
    expect(chatgpt.find((a) => a.tool.slug === 'le-chat')).toMatchObject({ overlap: 1 });
    expect(chatgpt.every((a, i) => i === 0 || a.overlap <= chatgpt[i - 1]!.overlap)).toBe(true);
  });
  it('shows no section for European companies or an unknown country', () => {
    expect(euAlternatives(catalog, catalog.toolsBySlug.get('amberscript')!)).toBeNull();
    expect(euAlternatives(catalog, catalog.toolsBySlug.get('elevenlabs')!)).toBeNull();
  });
});

describe('the costs hub', () => {
  it('is in the sitemap in every live locale', () => {
    const paths = sitemapEntries(catalog, ['nl', 'en'], { newsletter: false }).map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['/nl/costs', '/en/costs']));
  });
});

describe('money never changes the order of comparisons', () => {
  it('no compare or pricing module reaches monetisation code, directly or indirectly', () => {
    const root = path.resolve(process.cwd(), 'src');
    const queue = ['lib/compare', 'lib/pricing'].flatMap((d) =>
      readdirSync(path.join(root, d))
        .map((f) => path.join(root, d, f))
        .filter((f) => statSync(f).isFile()),
    );
    expect(queue.length).toBeGreaterThanOrEqual(7);
    // The modules themselves never touch the monetisation tables (comments aside: "conversions to EUR").
    for (const file of queue) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/@\/lib\/monetization|\b(affiliateLinks|affiliatePrograms|placements|revenueEntries|conversions|outboundClicks)\b/);
    }
    const seen = new Set<string>();
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
        const spec = m[1]!;
        const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
        const resolved = base && [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((c) => existsSync(c));
        if (resolved) queue.push(resolved);
      }
    }
    expect([...seen].map((f) => path.relative(root, f)).filter((f) => /lib\/monetization|admin\/commerce|agents\/defs\/(monetization|opportunity)/.test(f))).toEqual([]);
  });
});
