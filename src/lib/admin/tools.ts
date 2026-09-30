/**
 * Owner edits to tools: basics, texts, capabilities, plans and publication.
 * Publication has a gate (docs/strategy/05 §5): reviewed texts in nl and en
 * and at least one capability. Every change refreshes the snapshot and the
 * caches; publication is logged as a reversible action.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { capabilities, changeEvents, pricingPlans, sources, toolCapabilities, toolI18n, tools, type BillingPeriod } from '@/lib/db/schema';
import { actionLogger } from '@/agents/actions';
import { eventText } from '@/agents/lib/event-text';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import { sourceDomain } from '@/lib/provenance/confidence';
import { monthlyEquivalentCents } from '@/lib/pricing/money';
import { bumpDataVersion, loadSettings } from '@/lib/settings';
import { isGithubRepo, isYoutubeChannel } from '@/lib/validate';

export type GateReason = 'no_text_nl' | 'no_text_en' | 'draft_text' | 'no_capability';

export async function publishGate(db: Database, toolId: string): Promise<GateReason[]> {
  const texts = await db.select().from(toolI18n).where(eq(toolI18n.toolId, toolId));
  const caps = await db.select().from(toolCapabilities).where(eq(toolCapabilities.toolId, toolId));
  const out: GateReason[] = [];
  const nl = texts.find((x) => x.locale === 'nl');
  const en = texts.find((x) => x.locale === 'en');
  if (!nl?.tagline || !nl.description) out.push('no_text_nl');
  if (!en?.tagline || !en.description) out.push('no_text_en');
  if ([nl, en].some((x) => x && (x.contentStatus === 'ai_draft' || x.contentStatus === 'machine_translated'))) out.push('draft_text');
  if (!caps.length) out.push('no_capability');
  return out;
}

async function refresh(db: Database, toolId: string, by: string) {
  await recomputeToolSnapshot(db, toolId, (await loadSettings(db)).freshness, new Date());
  await bumpDataVersion(db, by);
}

export async function publishTool(db: Database, toolId: string, by: string): Promise<GateReason[]> {
  const reasons = await publishGate(db, toolId);
  if (reasons.length) return reasons;
  const [tool] = await db.select().from(tools).where(eq(tools.id, toolId));
  if (!tool || tool.published) return [];
  await db.update(tools).set({ published: true, quarantineUntil: null, updatedAt: new Date() }).where(eq(tools.id, toolId));
  await db
    .insert(changeEvents)
    .values({
      toolId,
      kind: 'new_tool',
      title: eventText('newTool'),
      sourceUrl: tool.websiteUrl,
      sourceType: 'official',
      detectedAt: new Date(),
      occurredAt: new Date(),
      detectedBy: by,
      confidence: 90,
      significance: 60,
      dedupeKey: `new_tool:${toolId}`,
    })
    .onConflictDoNothing({ target: changeEvents.dedupeKey });
  await actionLogger(db, null, 'owner').action({ action: 'tool_published', entityType: 'tool', entityId: toolId, toolId, decision: 'auto_published', reason: by });
  await refresh(db, toolId, by);
  return [];
}

export async function unpublishTool(db: Database, toolId: string, by: string): Promise<void> {
  await db.update(tools).set({ published: false, updatedAt: new Date() }).where(eq(tools.id, toolId));
  await refresh(db, toolId, by);
}

const HTTPS = /^https:\/\/[^\s/$.?#].[^\s]*$/i;

export interface Basics {
  name: string;
  status: 'active' | 'beta' | 'waitlist' | 'deprecated' | 'shutdown' | 'unknown';
  websiteUrl: string;
  pricingUrl: string | null;
  changelogUrl: string | null;
  rssUrl: string | null;
  githubRepo: string | null;
  youtubeChannelId: string | null;
}

export function validateBasics(b: Basics): string | null {
  if (!b.name || b.name.length > 80) return 'name';
  if (!HTTPS.test(b.websiteUrl)) return 'websiteUrl';
  for (const k of ['pricingUrl', 'changelogUrl', 'rssUrl'] as const) if (b[k] && !HTTPS.test(b[k]!)) return k;
  if (b.githubRepo && !isGithubRepo(b.githubRepo)) return 'githubRepo';
  if (b.youtubeChannelId && !isYoutubeChannel(b.youtubeChannelId)) return 'youtubeChannelId';
  return null;
}

export async function saveBasics(db: Database, toolId: string, b: Basics, by: string): Promise<void> {
  await db.update(tools).set({ ...b, updatedAt: new Date() }).where(eq(tools.id, toolId));
  const roles: [string | null, 'website' | 'pricing' | 'changelog' | 'rss'][] = [
    [b.websiteUrl, 'website'],
    [b.pricingUrl, 'pricing'],
    [b.changelogUrl, 'changelog'],
    [b.rssUrl, 'rss'],
  ];
  for (const [url, role] of roles) {
    if (!url) continue;
    const [existing] = await db.select().from(sources).where(and(eq(sources.toolId, toolId), eq(sources.role, role)));
    if (existing?.url === url) continue;
    if (existing) await db.update(sources).set({ url, domain: sourceDomain(url), lastFetchedAt: null, failureCount: 0, failingSince: null }).where(eq(sources.id, existing.id));
    else
      await db
        .insert(sources)
        .values({ url, domain: sourceDomain(url), sourceType: role === 'changelog' ? 'changelog' : 'official', toolId, role, checkIntervalHours: role === 'website' ? 6 : 24 })
        .onConflictDoNothing({ target: sources.url });
  }
  await refresh(db, toolId, by);
}

export interface TextInput {
  tagline: string;
  description: string;
  bestFor: string[];
  notFor: string[];
  limitations: string[];
}

export async function saveText(db: Database, toolId: string, locale: string, x: TextInput, by: string): Promise<void> {
  const values = { ...x, contentStatus: 'reviewed' as const, updatedAt: new Date() };
  await db
    .insert(toolI18n)
    .values({ toolId, locale, ...values })
    .onConflictDoUpdate({ target: [toolI18n.toolId, toolI18n.locale], set: values });
  await refresh(db, toolId, by);
}

export async function approveTexts(db: Database, toolId: string, by: string): Promise<void> {
  await db
    .update(toolI18n)
    .set({ contentStatus: 'reviewed', updatedAt: new Date() })
    .where(and(eq(toolI18n.toolId, toolId), inArray(toolI18n.contentStatus, ['ai_draft', 'machine_translated'])));
  await refresh(db, toolId, by);
}

export async function setCapabilities(db: Database, toolId: string, primary: string[], secondary: string[], by: string): Promise<string[]> {
  const known = new Set((await db.select({ id: capabilities.id }).from(capabilities)).map((c) => c.id));
  const unknown = [...primary, ...secondary].filter((id) => !known.has(id));
  if (unknown.length) return unknown;
  await db.delete(toolCapabilities).where(eq(toolCapabilities.toolId, toolId));
  const rows = [
    ...[...new Set(primary)].map((capabilityId) => ({ toolId, capabilityId, strength: 'primary' as const })),
    ...[...new Set(secondary)].filter((id) => !primary.includes(id)).map((capabilityId) => ({ toolId, capabilityId, strength: 'secondary' as const })),
  ];
  if (rows.length) await db.insert(toolCapabilities).values(rows);
  await refresh(db, toolId, by);
  return [];
}

export interface PlanInput {
  planKey: string;
  name: string;
  priceCents: number | null;
  annualMonthlyCents: number | null;
  currency: string;
  billingPeriod: BillingPeriod;
  isFree: boolean;
}

/** A plan entered by the owner starts UNVERIFIED; the pricing agent anchors it on the official page. */
export async function addPlan(db: Database, toolId: string, p: PlanInput, by: string): Promise<void> {
  const [pricing] = await db.select().from(sources).where(and(eq(sources.toolId, toolId), eq(sources.role, 'pricing')));
  await db
    .update(pricingPlans)
    .set({ validTo: new Date() })
    .where(and(eq(pricingPlans.toolId, toolId), eq(pricingPlans.planKey, p.planKey), isNull(pricingPlans.validTo)));
  const existing = await db.select({ id: pricingPlans.id }).from(pricingPlans).where(and(eq(pricingPlans.toolId, toolId), isNull(pricingPlans.validTo)));
  await db.insert(pricingPlans).values({
    toolId,
    planKey: p.planKey,
    name: p.name,
    position: existing.length,
    priceCents: p.isFree ? 0 : p.priceCents,
    currency: p.currency,
    billingPeriod: p.billingPeriod,
    monthlyEquivalentCents: monthlyEquivalentCents(p.isFree ? 0 : p.priceCents, p.billingPeriod),
    annualMonthlyCents: p.annualMonthlyCents,
    isFree: p.isFree,
    status: 'unverified',
    confidence: 30,
    sourceId: pricing?.id ?? null,
    method: 'editorial',
    observedAt: new Date(),
    createdBy: by,
  });
  if (pricing) await db.update(sources).set({ lastFetchedAt: null }).where(eq(sources.id, pricing.id)); // check soon
  await refresh(db, toolId, by);
}
