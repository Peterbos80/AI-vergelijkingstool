import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, isNull, and } from 'drizzle-orm';
import { createTestDb } from '../setup/pglite';
import { loadSeedData, parseAffiliates, seedAsOf } from '@/lib/seed/load';
import { AFFILIATES_FILE, applySeed } from '@/lib/seed/apply';
import { affiliateLinks, affiliatePrograms, agentActions, facts, pricingPlans, tools } from '@/lib/db/schema';
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

  it('dates the dataset after its newest observation (deterministic test seeding)', () => {
    const bundle = loadSeedData();
    const asOf = seedAsOf(bundle).toISOString().slice(0, 10);
    const observed = bundle.tools.flatMap((t) => [...t.plans.map((p) => p.observed), ...Object.values(t.facts).map((f) => f!.observed)]);
    expect(observed.length).toBeGreaterThan(0);
    expect(observed.every((d) => d < asOf)).toBe(true);
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

describe('affiliate links from data/affiliates.json (free edition)', () => {
  const slugs = new Set(['descript', 'elevenlabs']);
  const file = (links: unknown[]) => ({ links });

  it('rejects entries that would send visitors to a broken or unsafe page', () => {
    expect(parseAffiliates(file([{ tool: 'descript', network: 'partnerstack', url: 'https://get.descript.com/x?sub={click_id}' }]), slugs)).toMatchObject([{ tool: 'descript', active: true }]);
    expect(() => parseAffiliates(file([{ tool: 'nope', network: 'impact', url: 'https://partner.example.com/x' }]), slugs)).toThrow(/unknown tool "nope"/);
    expect(() => parseAffiliates(file([{ tool: 'descript', network: 'impact', url: 'http://partner.example.com/x' }]), slugs)).toThrow(/not_https/);
    expect(() => parseAffiliates(file([{ tool: 'descript', network: 'impact', url: 'https://user:pw@partner.example.com/x' }]), slugs)).toThrow(/credentials_in_url/);
    const twice = { tool: 'descript', network: 'impact', url: 'https://partner.example.com/x' };
    expect(() => parseAffiliates(file([twice, twice]), slugs)).toThrow(/more than one link/);
    expect(() => parseAffiliates({ links: [{ tool: 'descript' }] }, slugs)).toThrow(/affiliates\.json/);
  });

  it('the file in the repository is valid', () => {
    expect(() => loadSeedData()).not.toThrow();
  });

  it('adds, updates and removes links; a link the agent switched off as broken stays off until its URL changes', async () => {
    const bundle = loadSeedData();
    const [descript] = await db.select().from(tools).where(eq(tools.slug, 'descript'));
    const link = async () => (await db.select().from(affiliateLinks).where(and(eq(affiliateLinks.toolId, descript!.id), eq(affiliateLinks.createdBy, AFFILIATES_FILE))))[0];
    const withLinks = (links: typeof bundle.affiliates) => ({ ...bundle, affiliates: links });
    const entry = { tool: 'descript', network: 'partnerstack', url: 'https://get.descript.com/a?sub={click_id}', active: true };

    const r1 = await applySeed(db, withLinks([entry]), now);
    expect(r1.affiliateLinks).toBe(1);
    expect(await link()).toMatchObject({ urlTemplate: entry.url, active: true });
    const [program] = await db.select().from(affiliatePrograms).where(eq(affiliatePrograms.toolId, descript!.id));
    expect(program).toMatchObject({ network: 'partnerstack', status: 'approved' });

    // The monetization agent found it broken and switched it off: a later push does not undo that.
    const off = await link();
    await db.update(affiliateLinks).set({ active: false, lastCheckedAt: now, lastStatus: 404 }).where(eq(affiliateLinks.id, off!.id));
    await db.insert(agentActions).values({ agent: 'monetization', action: 'affiliate_link_deactivated', entityType: 'affiliate_link', entityId: off!.id, oldValue: { active: true, urlTemplate: entry.url }, decision: 'auto_published_flagged', reason: 'http' });
    expect((await applySeed(db, withLinks([entry]), now)).affiliateLinks).toBe(0);
    expect((await link())?.active).toBe(false);

    // A new URL from the owner starts fresh.
    const fixed = { ...entry, url: 'https://get.descript.com/b?sub={click_id}' };
    expect((await applySeed(db, withLinks([fixed]), now)).affiliateLinks).toBe(1);
    expect(await link()).toMatchObject({ urlTemplate: fixed.url, active: true, lastCheckedAt: null, lastStatus: null });

    // Switched off in the file, then removed from it: off, and kept for attribution.
    await applySeed(db, withLinks([{ ...fixed, active: false }]), now);
    expect((await link())?.active).toBe(false);
    await applySeed(db, withLinks([fixed]), now);
    expect((await link())?.active).toBe(true);
    await applySeed(db, withLinks([]), now);
    expect((await link())?.active).toBe(false);
    expect(await db.select().from(affiliateLinks).where(eq(affiliateLinks.createdBy, AFFILIATES_FILE))).toHaveLength(1);
  });
});
