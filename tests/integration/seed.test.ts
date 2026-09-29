import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, isNull, and } from 'drizzle-orm';
import { createTestDb } from '../setup/pglite';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { facts, pricingPlans, tools } from '@/lib/db/schema';
import { loadCatalog } from '@/lib/catalog/load';
import type { Database } from '@/lib/db/client';

let db: Database;
let close: () => Promise<void>;
const now = new Date('2026-09-30T08:00:00Z');

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

describe('seed → catalog', () => {
  it('applies the real seed data with provenance and is idempotent', async () => {
    const bundle = loadSeedData();
    const first = await applySeed(db, bundle, now);
    expect(first.toolsInserted).toBe(bundle.tools.length);
    expect(first.plans).toBeGreaterThan(300);
    const second = await applySeed(db, bundle, now);
    expect(second.toolsInserted).toBe(0);
    expect(second.events).toBe(0);
    expect(second.dataVersion).toBe(first.dataVersion + 1);
  });

  it('never stores seed evidence as VERIFIED (not anchored by our fetcher)', async () => {
    const verified = await db.select().from(facts).where(eq(facts.status, 'verified'));
    const verifiedPlans = await db.select().from(pricingPlans).where(eq(pricingPlans.status, 'verified'));
    expect(verified.length + verifiedPlans.length).toBe(0);
  });

  it('keeps price history (valid_to) next to the current price', async () => {
    const [gemini] = await db.select().from(tools).where(eq(tools.slug, 'gemini'));
    const rows = await db.select().from(pricingPlans).where(eq(pricingPlans.toolId, gemini!.id));
    const aiPlus = rows.filter((r) => r.planKey === 'ai-plus');
    expect(aiPlus.length).toBe(2);
    expect(aiPlus.filter((r) => r.validTo === null)).toHaveLength(1);
    const current = await db
      .select()
      .from(pricingPlans)
      .where(and(eq(pricingPlans.toolId, gemini!.id), isNull(pricingPlans.validTo)));
    expect(current.length).toBeGreaterThan(0);
  });

  it('builds the read model with real counts', async () => {
    const catalog = await loadCatalog(db, 1, now);
    expect(catalog.tools.length).toBeGreaterThan(90);
    expect(catalog.tasks.find((t) => t.id === 'create-social-media-videos')?.steps.length).toBe(5);
    expect(catalog.events.length).toBeGreaterThan(0);
    const sora = catalog.tools.find((t) => t.slug === 'sora');
    if (sora) expect(sora.status).toBe('shutdown');
    expect(catalog.stats.supportedShare).toBeGreaterThan(0.5);
  });
});
