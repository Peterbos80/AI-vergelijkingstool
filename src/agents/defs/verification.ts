/**
 * Verification agent (the tool scout's checks; docs/strategy/08 §3, 12 §4.4).
 * Every hour, a small batch:
 *  1. re-checks the tools in quarantine: duplicates and the owner's blocklist
 *     every run, the official site about every 20 hours (hourly after a
 *     failure). A gate that fails takes the tool offline at once; an
 *     unreachable site after two failures in a row. Logged and reversible.
 *  2. verifies new candidates, the most popular first, against the hard gates
 *     (own HTTPS site, robots.txt, no duplicate, not blocked or parked, about
 *     AI, the name on the site, a certain function, an anchored fact) and
 *     writes a dossier. Popularity is checked at publication (new-tools).
 * In queue mode (newToolMode 'queue') a candidate whose site checks pass goes
 * to the owner with its dossier, as before; nothing is published here.
 */
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { toolCandidates, tools } from '@/lib/db/schema';
import { loadCatalog } from '@/lib/catalog/load';
import { sourceDomain } from '@/lib/provenance/confidence';
import { readDataVersion } from '@/lib/settings';
import { htmlToText, type PageText } from '../fetcher/text';
import { newToolPolicy, SCOUT_LIMITS } from '../lib/scout/config';
import { AI_TERMS, BLOCKLIST, blockedDomainGate, contentGate, duplicateGate, PARKED, siteGate, type GateReason, type KnownTool } from '../lib/scout/gates';
import { depublish } from '../lib/scout/publish';
import { candidateKey } from '../lib/scout/sources';
import { verifyCandidate, type ScoutDossier } from '../lib/scout/verify';
import type { AgentContext, AgentDefinition } from '../types';

/** @deprecated kept for callers of the first version; the gates live in lib/scout/gates. */
export type Dossier = ScoutDossier;

/** Blocklist, parked domain or not about AI (the first content gates). */
export function gate(page: PageText): 'blocklist' | 'parked' | 'not_ai' | null {
  const head = `${page.title ?? ''} ${page.description ?? ''} ${page.text.slice(0, 5000)}`;
  if (BLOCKLIST.test(head)) return 'blocklist';
  if (PARKED.test(head)) return 'parked';
  if (!AI_TERMS.test(head)) return 'not_ai';
  return null;
}

/** The dossier score the owner sees in queue mode (reachability, evidence, traction). */
export function score(input: { https: boolean; description: boolean; pricingPage: boolean; legal: number; signals: Record<string, unknown> }): { score: number; breakdown: Record<string, number> } {
  const hn = Number(input.signals.hnPoints ?? 0);
  const stars = Number(input.signals.githubStars ?? 0);
  const breakdown: Record<string, number> = {
    reachable: 20,
    ai: 20,
    https: input.https ? 10 : 0,
    description: input.description ? 10 : 0,
    pricing: input.pricingPage ? 15 : 0,
    legal: Math.min(10, input.legal * 5),
    traction: hn >= 50 || stars >= 1000 ? 15 : hn >= 20 || stars >= 300 ? 10 : 0,
  };
  return { score: Object.values(breakdown).reduce((a, b) => a + b, 0), breakdown };
}

/** Every tool (published or not) for duplicate checks. */
export async function knownTools(db: Database): Promise<(KnownTool & { published: boolean })[]> {
  return db.select({ id: tools.id, name: tools.name, aliases: tools.aliases, websiteUrl: tools.websiteUrl, published: tools.published }).from(tools);
}

const HOUR = 3600_000;
/** Strict gates the owner may still overrule in queue mode (the site itself is fine). */
const OWNER_CAN_JUDGE = new Set<GateReason>(['name_not_on_site', 'function_uncertain', 'no_anchored_fact']);

/** Signal strength in SQL (most popular candidates are verified first). */
const POPULARITY_SQL = sql`(
  CASE WHEN jsonb_typeof(${toolCandidates.signals}->'hnPoints') = 'number' THEN (${toolCandidates.signals}->>'hnPoints')::numeric / 50 ELSE 0 END
  + CASE WHEN jsonb_typeof(${toolCandidates.signals}->'githubStars') = 'number' THEN (${toolCandidates.signals}->>'githubStars')::numeric / 300 ELSE 0 END
  + CASE WHEN jsonb_typeof(${toolCandidates.signals}->'phVotes') = 'number' THEN (${toolCandidates.signals}->>'phVotes')::numeric / 200 ELSE 0 END
  + CASE WHEN ${toolCandidates.signals} ? 'announcementUrl' THEN 1 ELSE 0 END)`;

/** Re-check the tools in quarantine; a failing gate takes the tool offline. */
async function recheckQuarantine(ctx: AgentContext, known: (KnownTool & { published: boolean })[]): Promise<{ checked: number; depublished: number }> {
  const { db } = ctx;
  const now = ctx.now();
  const rows = await db
    .select()
    .from(tools)
    .where(and(eq(tools.published, true), isNotNull(tools.quarantineUntil), isNotNull(tools.discovery)));
  let checked = 0;
  let depublished = 0;
  const live = rows.filter((t) => t.discovery);
  const offline = new Set<string>();
  // Every run: duplicates of another live tool, and the owner's blocklist (no fetch needed).
  for (const t of live) {
    const domain = candidateKey(t.websiteUrl)?.domain ?? sourceDomain(t.websiteUrl);
    const others = known.filter((k) => k.id !== t.id && k.published && !offline.has(k.id));
    const r = [blockedDomainGate(domain), duplicateGate(domain, [t.name, ...t.aliases], others)].find((g) => !g.ok);
    if (r && !r.ok) {
      await depublish(ctx, t, r.reason);
      offline.add(t.id);
      depublished++;
      ctx.stat(`depublished_${r.reason}`);
    }
  }
  // The official site, about every 20 hours (hourly after a failure), oldest check first.
  const due = live
    .filter((t) => !offline.has(t.id))
    .filter((t) => {
      const c = t.discovery!.checks;
      const age = c.lastAt ? now.getTime() - new Date(c.lastAt).getTime() : Infinity;
      return age >= (c.failures > 0 ? HOUR : 20 * HOUR);
    })
    .sort((a, b) => (a.discovery!.checks.lastAt ?? '').localeCompare(b.discovery!.checks.lastAt ?? ''))
    .slice(0, 10);
  for (const t of due) {
    if (ctx.signal.aborted) break;
    const d = t.discovery!;
    const domain = candidateKey(t.websiteUrl)?.domain ?? sourceDomain(t.websiteUrl);
    const res = await ctx.fetcher.get(t.websiteUrl, { accept: 'html' });
    let r = siteGate(domain, res);
    if (r.ok) r = contentGate(htmlToText(res.body, res.finalUrl));
    checked++;
    if (r.ok) {
      await db
        .update(tools)
        .set({ discovery: { ...d, checks: { ...d.checks, green: d.checks.green + 1, lastAt: now.toISOString(), lastOk: true, failures: 0, lastReason: null } }, websiteCheckedAt: now })
        .where(eq(tools.id, t.id));
      ctx.stat('quarantine_green');
      continue;
    }
    const failures = d.checks.failures + 1;
    if (r.hard || failures >= 2) {
      await depublish(ctx, t, r.hard ? r.reason : `site_down (${failures} checks in a row)`);
      depublished++;
      ctx.stat(`depublished_${r.hard ? r.reason : 'site_down'}`);
      continue;
    }
    // A first failure: check again in an hour; the 7 green days start again.
    const until = new Date(Math.max(t.quarantineUntil!.getTime(), now.getTime() + SCOUT_LIMITS.quarantineDays * 86_400_000));
    await db
      .update(tools)
      .set({ quarantineUntil: until, discovery: { ...d, checks: { ...d.checks, lastAt: now.toISOString(), lastOk: false, failures, lastFailureAt: now.toISOString(), lastReason: r.reason } } })
      .where(eq(tools.id, t.id));
    ctx.stat('quarantine_failed_once');
  }
  return { checked, depublished };
}

export const verificationAgent: AgentDefinition = {
  name: 'verification',
  description:
    'Every hour, a small batch: re-checks the tools in quarantine (a failing gate takes one offline at once) and checks new candidates against the hard gates (own HTTPS site, robots.txt, no duplicate, not blocked or parked, about AI, name on the site, a certain function, an anchored fact) with a dossier. In queue mode a candidate whose site checks pass goes to the owner.',
  schedule: 'every:1h',
  autonomy: 'auto',
  maxItems: 8,
  timeoutMs: 8 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const policy = newToolPolicy(ctx.settings);
    // A run that stopped half-way leaves no candidate stuck in "verifying".
    await db.update(toolCandidates).set({ status: 'new' }).where(eq(toolCandidates.status, 'verifying'));
    const known = await knownTools(db);
    const recheck = await recheckQuarantine(ctx, known);
    const list = await db
      .select()
      .from(toolCandidates)
      .where(eq(toolCandidates.status, 'new'))
      .orderBy(desc(POPULARITY_SQL), asc(toolCandidates.firstSeenAt))
      .limit(ctx.limits.maxItems);
    const head = `quarantine: ${recheck.checked} checked, ${recheck.depublished} taken offline`;
    if (!list.length) return { status: recheck.checked || recheck.depublished ? 'success' : 'skipped', summary: `${head} · no new candidates`, dataChanged: recheck.depublished > 0 };
    const catalog = await loadCatalog(db, await readDataVersion(db), now);
    let verified = 0;
    let rejected = 0;
    for (const c of list) {
      if (ctx.signal.aborted) break;
      await db.update(toolCandidates).set({ status: 'verifying' }).where(eq(toolCandidates.id, c.id));
      const out = await verifyCandidate(ctx, c, known, catalog);
      const base = { ...c.signals };
      delete base.dossier;
      if (out.kind === 'fail' && (out.reason === 'duplicate_domain' || out.reason === 'duplicate_name')) {
        await db.update(toolCandidates).set({ status: 'duplicate', duplicateOfToolId: out.duplicateOf ?? null, notes: out.reason }).where(eq(toolCandidates.id, c.id));
        ctx.stat('duplicate');
        continue;
      }
      if (out.kind === 'fail' && !out.hard) {
        // Maybe temporary: try again next hour; after two failures it is rejected.
        const failures = Number(c.signals.verifyFailures ?? 0) + 1;
        await db
          .update(toolCandidates)
          .set({ status: failures >= 2 ? 'rejected' : 'new', signals: { ...base, verifyFailures: failures }, notes: out.reason })
          .where(eq(toolCandidates.id, c.id));
        ctx.stat(failures >= 2 ? `rejected_${out.reason}` : 'retry_later');
        if (failures >= 2) rejected++;
        continue;
      }
      const dossier = out.dossier;
      const legacy = dossier
        ? score({ https: dossier.url.startsWith('https://'), description: Boolean(dossier.description), pricingPage: Boolean(dossier.pricing.url), legal: Number(dossier.legal.privacy) + Number(dossier.legal.terms), signals: base })
        : { score: 0, breakdown: {} };
      const forOwner = policy.mode === 'queue' && dossier && (out.kind === 'pass' || OWNER_CAN_JUDGE.has(out.reason)) && legacy.score >= 60;
      if (out.kind === 'fail' && !forOwner) {
        await db
          .update(toolCandidates)
          .set({ status: 'rejected', confidence: 0, notes: out.reason, signals: dossier ? { ...base, dossier } : base })
          .where(eq(toolCandidates.id, c.id));
        ctx.stat(`rejected_${out.reason}`);
        rejected++;
        continue;
      }
      const signals = out.kind === 'pass' ? out.signals : base;
      await db
        .update(toolCandidates)
        .set({ status: 'verified', confidence: legacy.score, notes: out.kind === 'pass' ? null : `owner decides: ${out.reason}`, signals: { ...signals, dossier: { ...dossier!, score: legacy.score, breakdown: legacy.breakdown } } })
        .where(eq(toolCandidates.id, c.id));
      verified++;
      ctx.stat('verified');
      if (policy.mode === 'queue') {
        await ctx.inbox.escalate({
          kind: 'new_tool',
          severity: 'p3',
          category: 'data',
          title: `New tool candidate: ${dossier!.name} (score ${legacy.score})`,
          reasonCode: 'new_tool_needs_review',
          payload: { candidateId: c.id, dossier: { ...dossier!, signals, score: legacy.score, breakdown: legacy.breakdown } },
          confidence: legacy.score,
          defaultAction: 'reject_after_30d',
          dueInHours: 30 * 24,
          dedupeKey: `new_tool:${c.domain}`,
          createdBy: 'agent:verification',
        });
      }
    }
    return {
      status: 'success',
      summary: `${head} · ${list.length} candidates checked · ${verified} verified${policy.mode === 'queue' ? ' for review' : ' for the daily publication'} · ${rejected} rejected`,
      dataChanged: recheck.depublished > 0,
    };
  },
};
