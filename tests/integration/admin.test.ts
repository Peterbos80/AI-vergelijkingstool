/**
 * Owner-side operations: decisions from the inbox, candidate promotion,
 * tool publication gate and the conversion import.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../setup/pglite';
import type { Database } from '@/lib/db/client';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { affiliatePrograms, changeEvents, conversions, pendingChanges, pricingPlans, reviewItems, sources, toolCandidates, toolCapabilities, tools } from '@/lib/db/schema';
import { applyDecision } from '@/lib/admin/decisions';
import { promoteCandidate, slugify, uniqueSlug } from '@/lib/admin/candidates';
import { publishGate, publishTool, saveText, setCapabilities, unpublishTool, validateBasics } from '@/lib/admin/tools';
import { importConversions, parseConversions, parseCsv } from '@/lib/admin/commerce';
import type { AdminUser } from '@/lib/auth/session';

const OWNER: AdminUser = { id: '00000000-0000-0000-0000-000000000001', email: 'owner@example.test', name: null, role: 'owner' };
let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  await applySeed(db, loadSeedData(), new Date('2026-09-30T08:00:00Z'));
});
afterAll(async () => close());

async function tool(slug: string) {
  const [t] = await db.select().from(tools).where(eq(tools.slug, slug));
  return t!;
}
async function plan(toolId: string, planKey: string) {
  const [p] = await db.select().from(pricingPlans).where(and(eq(pricingPlans.toolId, toolId), eq(pricingPlans.planKey, planKey), isNull(pricingPlans.validTo)));
  return p!;
}
async function item(values: Partial<typeof reviewItems.$inferInsert> & Pick<typeof reviewItems.$inferInsert, 'kind' | 'payload'>) {
  const [row] = await db.insert(reviewItems).values({ severity: 'p2', category: 'data', title: 'test', createdBy: 'test', ...values }).returning();
  return row!;
}

describe('inbox decisions', () => {
  it('approving an escalated price change publishes it; rejecting keeps the old price', async () => {
    const t = await tool('elevenlabs');
    const [pending] = await db
      .insert(pendingChanges)
      .values({ toolId: t.id, key: 'plan:creator', proposedValue: { cents: 4500 }, valueHash: 'x1', confidence: 95, agent: 'pricing' })
      .returning();
    const change = { toolId: t.id, toolName: t.name, planKey: 'creator', newCents: 4500, currency: 'USD', evidence: 'Creator $45/month', sourceId: null, sourceUrl: 'https://elevenlabs.io/pricing', confidence: 97, status: 'verified', oldCents: 2200, pendingId: pending!.id };
    const approved = await item({ kind: 'price_change', reasonCode: 'price_increase_over_limit', payload: change, toolId: t.id });
    expect((await applyDecision(db, approved, 'approve', OWNER, null)).ok).toBe(true);
    expect((await plan(t.id, 'creator')).priceCents).toBe(4500);
    expect((await db.select().from(reviewItems).where(eq(reviewItems.id, approved.id)))[0]?.status).toBe('approved');

    const [p2] = await db.insert(pendingChanges).values({ toolId: t.id, key: 'plan:starter', proposedValue: { cents: 900 }, valueHash: 'x2', confidence: 95, agent: 'pricing' }).returning();
    const rejected = await item({ kind: 'price_change', reasonCode: 'price_increase_over_limit', payload: { ...change, planKey: 'starter', newCents: 900, oldCents: 600, pendingId: p2!.id }, toolId: t.id });
    await applyDecision(db, rejected, 'reject', OWNER, 'vendor page glitch');
    expect((await plan(t.id, 'starter')).priceCents).toBe(600);
    expect((await db.select().from(pendingChanges).where(eq(pendingChanges.id, p2!.id)))[0]?.status).toBe('superseded');
    // A decided item cannot be decided twice.
    expect((await applyDecision(db, { ...rejected, status: 'rejected' }, 'approve', OWNER, null)).ok).toBe(false);
  });

  it('rejecting a flagged, already-published change reverts it', async () => {
    const t = await tool('elevenlabs');
    const flagged = await item({ kind: 'price_change', severity: 'p3', reasonCode: 'flagged_for_post_check', payload: { items: [{ toolId: t.id, planKey: 'creator' }] }, toolId: t.id });
    await applyDecision(db, flagged, 'reject', OWNER, null);
    expect((await plan(t.id, 'creator')).priceCents).toBe(2200);
  });

  it('records the owner’s affiliate choice so the question is not repeated', async () => {
    const t = await tool('descript');
    const opp = await item({ kind: 'opportunity', category: 'commercial', reasonCode: 'affiliate_coverage', payload: {}, toolId: t.id });
    await applyDecision(db, opp, 'reject', OWNER, 'not interested');
    const [p] = await db.select().from(affiliatePrograms).where(eq(affiliatePrograms.toolId, t.id));
    expect(p?.status).toBe('rejected');
  });

  it('approving a new tool creates an unpublished draft with official sources and suggested capabilities', async () => {
    const [c] = await db
      .insert(toolCandidates)
      .values({
        name: 'VoxNova',
        url: 'https://voxnova.example/',
        domain: 'voxnova.example',
        source: 'hackernews',
        status: 'verified',
        signals: { dossier: { url: 'https://voxnova.example/', capabilityIds: ['text-to-speech', 'not-a-capability'], pricing: { url: 'https://voxnova.example/pricing' } } },
      })
      .returning();
    const nt = await item({ kind: 'new_tool', severity: 'p3', payload: { candidateId: c!.id } });
    const r = await applyDecision(db, nt, 'approve', OWNER, null);
    expect(r.ok && r.redirectTo).toMatch(/^\/admin\/tools\/[0-9a-f-]{36}\?flash=draftCreated$/);
    const draft = await tool('voxnova');
    expect(draft.published).toBe(false);
    expect((await db.select().from(sources).where(eq(sources.toolId, draft.id))).map((s) => s.role).sort()).toEqual(['pricing', 'website']);
    expect((await db.select().from(toolCapabilities).where(eq(toolCapabilities.toolId, draft.id))).map((x) => x.capabilityId)).toEqual(['text-to-speech']);
    expect((await db.select().from(toolCandidates).where(eq(toolCandidates.id, c!.id)))[0]?.status).toBe('promoted');
    expect(await promoteCandidate(db, c!.id)).toBeNull();
  });
});

describe('tool publication gate', () => {
  it('blocks publication until reviewed texts in nl and en and a capability exist', async () => {
    const draft = await tool('voxnova');
    await db.delete(toolCapabilities).where(eq(toolCapabilities.toolId, draft.id));
    expect((await publishGate(db, draft.id)).sort()).toEqual(['no_capability', 'no_text_en', 'no_text_nl']);
    expect(await publishTool(db, draft.id, 'test')).not.toEqual([]);
    const text = { tagline: 'Tekst naar spraak', description: 'Zet tekst om in spraak.', bestFor: [], notFor: [], limitations: [] };
    await saveText(db, draft.id, 'nl', text, 'test');
    await saveText(db, draft.id, 'en', { ...text, tagline: 'Text to speech', description: 'Turns text into speech.' }, 'test');
    expect(await setCapabilities(db, draft.id, ['text-to-speech'], [], 'test')).toEqual([]);
    expect(await setCapabilities(db, draft.id, ['nope'], [], 'test')).toEqual(['nope']);
    expect(await publishTool(db, draft.id, 'test')).toEqual([]);
    expect((await tool('voxnova')).published).toBe(true);
    const [ev] = await db.select().from(changeEvents).where(and(eq(changeEvents.toolId, draft.id), eq(changeEvents.kind, 'new_tool')));
    expect(ev?.title.nl).toBe('Nieuw in de catalogus');
    await unpublishTool(db, draft.id, 'test');
    expect((await tool('voxnova')).published).toBe(false);
  });

  it('validates basics and generates unique slugs', async () => {
    const ok = { name: 'X', status: 'active' as const, websiteUrl: 'https://x.example', pricingUrl: null, changelogUrl: null, rssUrl: null, githubRepo: 'a/b', youtubeChannelId: null };
    expect(validateBasics(ok)).toBeNull();
    expect(validateBasics({ ...ok, websiteUrl: 'http://x.example' })).toBe('websiteUrl');
    expect(validateBasics({ ...ok, websiteUrl: 'javascript:alert(1)' })).toBe('websiteUrl');
    expect(validateBasics({ ...ok, githubRepo: '../etc' })).toBe('githubRepo');
    expect(slugify('Éléphant AI Studio!')).toBe('elephant-ai-studio');
    expect(await uniqueSlug(db, 'elevenlabs')).toBe('elevenlabs-2');
  });
});

describe('conversion import', () => {
  it('parses quoted CSV with comma or semicolon separators', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('validates rows, maps statuses and never guesses', () => {
    const csv = [
      'external_id,occurred_at,amount,currency,status,click_id',
      'c1,2026-09-10,12.50,EUR,approved,01K6ABCDEFGHJKMNPQRSTVWXYZ',
      'c2,2026-09-11,"1.234,56",EUR,Confirmed,',
      'c3,not a date,5,EUR,approved,',
      'c4,2026-09-12,5,euro,approved,',
      'c5,2026-09-12,5,USD,weird,',
    ].join('\n');
    const r = parseConversions(csv);
    expect(r.rows.map((x) => [x.externalId, x.amountCents, x.status, x.clickId])).toEqual([
      ['c1', 1250, 'approved', '01K6ABCDEFGHJKMNPQRSTVWXYZ'],
      ['c2', 123456, 'approved', null],
    ]);
    expect(r.skipped).toBe(3);
    expect(parseConversions('foo,bar\n1,2').error).toBe('no_header');
  });

  it('imports idempotently per programme and external id', async () => {
    const t = await tool('canva');
    const [p] = await db.insert(affiliatePrograms).values({ toolId: t.id, network: 'test', status: 'approved' }).returning();
    const { rows } = parseConversions('external_id,occurred_at,amount,currency,status\nx1,2026-09-01,10,EUR,pending\nx2,2026-09-02,20,EUR,approved');
    expect(await importConversions(db, p!.id, rows)).toEqual({ imported: 2, updated: 0 });
    const again = parseConversions('external_id,occurred_at,amount,currency,status\nx1,2026-09-01,10,EUR,approved');
    expect(await importConversions(db, p!.id, again.rows)).toEqual({ imported: 0, updated: 1 });
    const all = await db.select().from(conversions).where(eq(conversions.programId, p!.id));
    expect(all.map((c) => c.status).sort()).toEqual(['approved', 'approved']);
    expect(all.every((c) => c.toolId === t.id)).toBe(true);
  });
});
