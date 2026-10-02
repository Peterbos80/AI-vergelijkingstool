/**
 * Quarantine publication (docs/strategy/12 §4.4): put a verified candidate
 * live in quarantine, promote it after 7 green days, or take it offline when
 * a gate fails. Every step is one action in the ledger with what was there,
 * what it became and why, and every step can be reverted (agents/actions.ts).
 *
 * What a new tool gets: its name and official URL; the site's meta
 * description as a literal quote (≤ 160 characters, the URL as source);
 * functions; pricing facts only with a source on its own site; the discovery
 * signals with their links and dates; quarantine until now + 7 days. Every
 * fact is UNVERIFIED (never VERIFIED); functions stay secondary until promotion.
 */
import { and, eq, sql } from 'drizzle-orm';
import { formatDate } from '@/i18n/formatters';
import { getT } from '@/i18n/server';
import type { Locale } from '@/i18n/config';
import type { Database } from '@/lib/db/client';
import { changeEvents, facts, sources, toolCandidates, toolCapabilities, tools, type SourceType, type StoredDiscovery } from '@/lib/db/schema';
import { slugify, uniqueSlug } from '@/lib/admin/candidates';
import { computeConfidence, type Anchor } from '@/lib/provenance/confidence';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import { isGithubRepo } from '@/lib/validate';
import { eventText } from '../event-text';
import type { AgentContext } from '../../types';
import { SCOUT_LIMITS } from './config';
import type { PopularitySignal } from './gates';
import type { CandidateSignals } from './sources';
import type { ScoutDossier } from './verify';

const DAY = 86_400_000;
type ToolRow = typeof tools.$inferSelect;
type CandidateRow = typeof toolCandidates.$inferSelect;

async function ensureSource(db: Database, url: string, sourceType: SourceType, toolId: string, role: 'website' | 'pricing' | 'reference', hours: number): Promise<string> {
  const [row] = await db
    .insert(sources)
    .values({ url, domain: new URL(url).hostname.replace(/^www\./, ''), sourceType, toolId, role, checkIntervalHours: hours })
    .onConflictDoNothing({ target: sources.url })
    .returning({ id: sources.id });
  if (row) return row.id;
  const [existing] = await db.select().from(sources).where(eq(sources.url, url));
  if (existing && existing.toolId === null) await db.update(sources).set({ toolId, role, sourceType }).where(eq(sources.id, existing.id));
  return existing!.id;
}

/** "Show HN (231 points), GitHub (4,200 stars)" in the reader's language. */
export function signalsText(signals: readonly PopularitySignal[], locale: Locale): string {
  const t = getT(locale);
  const nf = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : `${locale}-${locale.toUpperCase()}`);
  return signals
    .map((s) =>
      s.kind === 'announcement'
        ? s.label
          ? t('agentEvent.scoutSignal.announcement', { maker: s.label })
          : t('agentEvent.scoutSignal.announcementOwn')
        : t(`agentEvent.scoutSignal.${s.kind}`, { value: nf.format(s.value ?? 0) }),
    )
    .join(', ');
}

/** The strongest source link for the Pulse event: a launch post, then HN, Product Hunt, GitHub. */
function leadSignal(signals: readonly PopularitySignal[]): { url: string; type: SourceType } {
  const order: PopularitySignal['kind'][] = ['announcement', 'hackernews', 'producthunt', 'github'];
  const s = order.map((k) => signals.find((x) => x.kind === k)).find(Boolean)!;
  return { url: s.url, type: s.kind === 'announcement' ? 'official_blog' : s.kind === 'github' ? 'github' : 'community' };
}

export async function publishInQuarantine(
  ctx: AgentContext,
  candidate: CandidateRow,
  dossier: ScoutDossier,
  signals: CandidateSignals,
  pop: { signals: PopularitySignal[]; score: number },
): Promise<{ toolId: string; slug: string }> {
  const { db } = ctx;
  const now = ctx.now();
  const until = new Date(now.getTime() + SCOUT_LIMITS.quarantineDays * DAY);
  const slug = await uniqueSlug(db, slugify(dossier.name));
  const repo = isGithubRepo(signals.githubRepo) ? signals.githubRepo : null;
  const discovery: StoredDiscovery = {
    candidateId: candidate.id,
    addedAt: now.toISOString(),
    popularity: pop.score,
    signals: pop.signals,
    primaryCapability: dossier.functions.primary,
    checks: { green: 1, lastAt: now.toISOString(), lastOk: true, failures: 0, lastFailureAt: null, lastReason: null },
    promotedAt: null,
  };
  const [row] = await db
    .insert(tools)
    .values({
      slug,
      name: dossier.name,
      websiteUrl: dossier.url,
      pricingUrl: dossier.pricing.url,
      githubRepo: repo,
      status: 'active',
      published: true,
      quarantineUntil: until,
      skillLevel: dossier.skillLevel,
      discovery,
      websiteStatus: 'up',
      websiteCheckedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: tools.id });
  const toolId = row!.id;

  const siteId = await ensureSource(db, dossier.url, 'official', toolId, 'website', 6);
  const pricingId = dossier.pricing.url ? await ensureSource(db, dossier.pricing.url, 'official', toolId, 'pricing', 24) : null;
  const repoId = repo ? await ensureSource(db, `https://github.com/${repo}`, 'github', toolId, 'reference', 24) : null;
  const fact = async (key: string, value: unknown, evidence: string, sourceId: string | null, sourceType: SourceType, anchor: Anchor) =>
    db.insert(facts).values({
      toolId,
      key,
      value,
      // Found by an agent, not checked by a person: never more than UNVERIFIED here.
      status: 'unverified',
      confidence: computeConfidence({ sourceTypes: [sourceType], anchor, observedAt: now, now, method: 'agent' }),
      sourceId,
      evidence: evidence.slice(0, 160),
      method: 'agent',
      observedAt: now,
      validFrom: now,
      createdBy: 'agent:new-tools',
      note: 'Found by the tool scout on the official site; not checked by a person yet.',
    });
  if (dossier.quote) await fact('site_description', dossier.quote.text, dossier.quote.text, siteId, 'official', 'verbatim');
  const caps = dossier.functions.capabilityIds.slice(0, 3);
  await fact('functions', caps, dossier.functions.phrases.join('; ') || dossier.title || dossier.name, siteId, 'official', 'fuzzy');
  for (const f of dossier.facts) {
    const sourceId = f.sourceType === 'github' ? repoId : f.url === dossier.pricing.url ? pricingId : siteId;
    await fact(f.key, f.value, f.evidence, sourceId, f.sourceType, f.key === 'open_source' ? 'verbatim' : 'fuzzy');
  }
  for (const capabilityId of caps) {
    await db
      .insert(toolCapabilities)
      .values({ toolId, capabilityId, strength: 'secondary', note: 'unverified: matched on the tool’s own site by the tool scout; the main function becomes primary after the quarantine' })
      .onConflictDoNothing();
  }

  const lead = leadSignal(pop.signals);
  const [event] = await db
    .insert(changeEvents)
    .values({
      toolId,
      kind: 'new_tool',
      title: eventText('newToolScout'),
      summary: eventText('newToolScoutSummary', (l) => ({ signals: signalsText(pop.signals, l), date: formatDate(until, l) })),
      sourceUrl: lead.url,
      sourceType: lead.type,
      occurredAt: now,
      detectedAt: now,
      detectedBy: 'agent:new-tools',
      confidence: 80,
      significance: 50,
      dedupeKey: `new_tool:${toolId}`,
    })
    .onConflictDoNothing({ target: changeEvents.dedupeKey })
    .returning({ id: changeEvents.id });
  await db.update(toolCandidates).set({ status: 'promoted', notes: `published in quarantine as ${slug}` }).where(eq(toolCandidates.id, candidate.id));
  await recomputeToolSnapshot(db, toolId, ctx.settings.freshness, now);
  await ctx.log.action({
    action: 'tool_quarantined',
    entityType: 'tool',
    entityId: toolId,
    toolId,
    field: 'published',
    oldValue: null,
    newValue: { slug, published: true, quarantineUntil: until.toISOString(), candidateId: candidate.id, eventId: event?.id ?? null, signals: pop.signals.map((s) => `${s.kind}:${s.value ?? ''}`) },
    sourceUrl: dossier.url,
    confidence: Math.round(Math.min(100, 50 + pop.score * 10)),
    decision: 'auto_published_flagged',
    reason: `all gates passed · ${pop.signals.map((s) => s.kind).join(' + ')}`,
  });
  return { toolId, slug };
}

/** Take a tool in quarantine offline: a gate failed. Reversible (tool_depublished). */
export async function depublish(ctx: AgentContext, tool: ToolRow, reason: string): Promise<void> {
  const { db } = ctx;
  const now = ctx.now();
  await db.update(tools).set({ published: false, updatedAt: now }).where(eq(tools.id, tool.id));
  await db.update(changeEvents).set({ status: 'rejected' }).where(and(eq(changeEvents.toolId, tool.id), eq(changeEvents.kind, 'new_tool')));
  if (tool.discovery?.candidateId) {
    await db.update(toolCandidates).set({ status: 'rejected', notes: `depublished: ${reason}` }).where(eq(toolCandidates.id, tool.discovery.candidateId));
  }
  await recomputeToolSnapshot(db, tool.id, ctx.settings.freshness, now);
  await ctx.log.action({
    action: 'tool_depublished',
    entityType: 'tool',
    entityId: tool.id,
    toolId: tool.id,
    field: 'published',
    oldValue: { published: true, quarantineUntil: tool.quarantineUntil?.toISOString() ?? null },
    newValue: { published: false },
    sourceUrl: tool.websiteUrl,
    decision: 'auto_published',
    reason,
  });
}

/** Seven green days: out of quarantine, the main function becomes primary. Reversible (tool_promoted). */
export async function promote(ctx: AgentContext, tool: ToolRow): Promise<void> {
  const { db } = ctx;
  const now = ctx.now();
  const d = tool.discovery!;
  await db
    .update(tools)
    .set({ quarantineUntil: null, discovery: { ...d, promotedAt: now.toISOString() }, updatedAt: now })
    .where(eq(tools.id, tool.id));
  if (d.primaryCapability) {
    await db
      .update(toolCapabilities)
      .set({ strength: 'primary' })
      .where(and(eq(toolCapabilities.toolId, tool.id), eq(toolCapabilities.capabilityId, d.primaryCapability)));
  }
  await recomputeToolSnapshot(db, tool.id, ctx.settings.freshness, now);
  await ctx.log.action({
    action: 'tool_promoted',
    entityType: 'tool',
    entityId: tool.id,
    toolId: tool.id,
    field: 'quarantine_until',
    oldValue: { quarantineUntil: tool.quarantineUntil?.toISOString() ?? null, primaryCapability: d.primaryCapability },
    newValue: { quarantineUntil: null },
    sourceUrl: tool.websiteUrl,
    decision: 'auto_published',
    reason: `${d.checks.green} green checks, none failed in ${SCOUT_LIMITS.quarantineDays} days`,
  });
}

/** Tools the scout published in the last 24 hours (not reverted), for the anomaly guard. */
export async function publishedSince(db: Database, since: Date): Promise<number> {
  const rows = await db.execute(
    sql`SELECT count(*)::int AS n FROM agent_actions WHERE action = 'tool_quarantined' AND reverted_at IS NULL AND created_at > ${since.toISOString()}::timestamptz`,
  );
  return Number((rows as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0);
}
