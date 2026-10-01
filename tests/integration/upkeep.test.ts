/**
 * Keeping existing tools current with the hourly agents: every tool with a
 * pricing URL has a pricing source; tools whose plans have no official page
 * get theirs from their own home page; schedules changed in code reach an
 * existing install.
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../setup/pglite';
import type { Database } from '@/lib/db/client';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { agentActions, agentConfigs, sources, tools } from '@/lib/db/schema';
import { fixtureFetcher } from '@/agents/fetcher/http';
import { runAgent } from '@/agents/runner';
import { revertAction } from '@/agents/actions';
import { getAgent } from '@/agents/registry';

const T0 = new Date('2026-10-01T09:00:00Z');
let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  await applySeed(db, loadSeedData(), new Date('2026-09-30T08:00:00Z'));
});
afterAll(async () => close());

async function toolBySlug(slug: string) {
  const [t] = await db.select().from(tools).where(eq(tools.slug, slug));
  return t!;
}

describe('hourly upkeep of existing tools', () => {
  it('runs pricing, broken links, discovery and verification every hour, with small batches', () => {
    for (const name of ['pricing', 'broken-link', 'discovery'] as const) expect(getAgent(name).schedule, name).toBe('every:1h');
    expect(getAgent('pricing').maxItems).toBeLessThanOrEqual(20);
    expect(getAgent('broken-link').maxItems).toBeLessThanOrEqual(15);
  });

  it('takes over a schedule changed in code on an existing install', async () => {
    await runAgent('quality', { db, now: () => T0, trigger: 'test', force: true }); // creates the config rows
    await db.update(agentConfigs).set({ schedule: 'daily:02:40', nextRunAt: new Date('2026-10-02T00:40:00Z') }).where(eq(agentConfigs.agent, 'discovery'));
    await runAgent('quality', { db, now: () => T0, trigger: 'test', force: true });
    const [cfg] = await db.select().from(agentConfigs).where(eq(agentConfigs.agent, 'discovery'));
    expect(cfg).toMatchObject({ schedule: 'every:1h', nextRunAt: null });
  });

  it('gives every tool with a pricing URL a pricing source', async () => {
    const tool = (await db.select().from(tools).where(sql`${tools.pricingUrl} IS NOT NULL`).limit(1))[0]!;
    await db.update(sources).set({ role: 'reference' }).where(and(eq(sources.toolId, tool.id), eq(sources.role, 'pricing')));
    const r = await runAgent('pricing', { db, fetcher: fixtureFetcher({}), now: () => T0, trigger: 'test', force: true });
    expect(r.stats.pricing_sources_added).toBe(1);
    const [src] = await db.select().from(sources).where(and(eq(sources.toolId, tool.id), eq(sources.role, 'pricing')));
    expect(src?.url).toBe(tool.pricingUrl);
  });

  it("finds the official pricing page of a tool whose plans had none, checks it in the same run, and can undo it", async () => {
    // A seed tool with plans but no official pricing page (most seed tools are like this).
    const [pick] = await db.execute(sql`SELECT t.slug FROM tools t WHERE t.published AND t.pricing_url IS NULL
      AND EXISTS (SELECT 1 FROM pricing_plans p WHERE p.tool_id = t.id AND p.valid_to IS NULL)
      AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.tool_id = t.id AND s.role = 'pricing') ORDER BY t.slug LIMIT 1`).then((r) => (r as unknown as { rows: { slug: string }[] }).rows);
    const tool = await toolBySlug(pick!.slug);
    const site = new URL(tool.websiteUrl);
    const pricing = `${site.origin}/pricing`;
    // Only this tool is due for a search in this test (an earlier run may have tried it already).
    await db.delete(agentActions).where(and(eq(agentActions.action, 'pricing_page_search'), eq(agentActions.toolId, tool.id)));
    const others = await db.select({ id: tools.id }).from(tools).where(ne(tools.id, tool.id));
    await db.insert(agentActions).values(others.map((o) => ({ agent: 'pricing', action: 'pricing_page_search', toolId: o.id, decision: 'info' as const, reason: 'no pricing link on the home page', createdAt: T0 })));
    const home = `<html><head><title>${tool.name}</title></head><body><a href="/features">Features</a><a href="${pricing}?utm_source=nav">Pricing</a><a href="https://other.example/pricing">Reseller</a></body></html>`;
    const fetcher = fixtureFetcher({
      [tool.websiteUrl]: { body: home },
      [pricing]: { body: '<html><body><h3>Free</h3><p>$0 per month</p></body></html>' },
    });
    const at = new Date(T0.getTime() + 3600_000);
    const r = await runAgent('pricing', { db, fetcher, now: () => at, trigger: 'test', force: true });
    expect(r.stats.pricing_pages_found).toBe(1);
    const after = await toolBySlug(tool.slug);
    expect(after.pricingUrl).toBe(pricing);
    const [src] = await db.select().from(sources).where(and(eq(sources.toolId, tool.id), eq(sources.role, 'pricing')));
    expect(src?.sourceType).toBe('official');
    expect(src?.lastFetchedAt?.toISOString()).toBe(at.toISOString()); // checked in the same run
    const [action] = await db.select().from(agentActions).where(and(eq(agentActions.action, 'pricing_url_found'), eq(agentActions.toolId, tool.id)));
    expect(action?.newValue).toMatchObject({ pricingUrl: pricing });
    // Reversible: the tool has no pricing page again and the source is no longer checked.
    expect(await revertAction(db, action!.id, 'test')).toBe('reverted');
    expect((await toolBySlug(tool.slug)).pricingUrl).toBeNull();
    expect((await db.select().from(sources).where(eq(sources.id, src!.id)))[0]?.role).toBe('other');
  });

  it('reads a home page that failed again after a day, one without a pricing link after 30 days', async () => {
    const someIds = (await db.select({ id: tools.id }).from(tools).limit(3)).map((t) => t.id);
    await db.delete(agentActions).where(and(eq(agentActions.action, 'pricing_page_search'), inArray(agentActions.toolId, someIds)));
    await db.update(tools).set({ pricingUrl: null }).where(inArray(tools.id, someIds));
    await db.update(sources).set({ role: 'reference' }).where(and(inArray(sources.toolId, someIds), eq(sources.role, 'pricing')));
    const at = new Date(T0.getTime() + 2 * 3600_000);
    const first = await runAgent('pricing', { db, fetcher: fixtureFetcher({}), now: () => at, trigger: 'test', force: true });
    expect(first.stats.pricing_page_not_found ?? 0).toBeGreaterThan(0);
    const searched = await db.select().from(agentActions).where(and(eq(agentActions.action, 'pricing_page_search'), sql`${agentActions.createdAt} = ${at.toISOString()}::timestamptz`));
    expect(searched.every((a) => a.reason?.startsWith('home page:'))).toBe(true);
    const sameDay = await runAgent('pricing', { db, fetcher: fixtureFetcher({}), now: () => new Date(at.getTime() + 3600_000), trigger: 'test', force: true });
    expect(sameDay.stats.pricing_page_not_found ?? 0).toBe(0);
    const nextDay = await runAgent('pricing', { db, fetcher: fixtureFetcher({}), now: () => new Date(at.getTime() + 25 * 3600_000), trigger: 'test', force: true });
    expect(nextDay.stats.pricing_page_not_found ?? 0).toBeGreaterThan(0);
  });
});
