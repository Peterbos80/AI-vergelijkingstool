/**
 * New-tools agent: the tool scout's daily publication (docs/strategy/12 §4.4).
 * Once a day around 07:00 (Europe/Amsterdam), in quarantine mode:
 *  1. promotes tools whose 7 days in quarantine passed with every check green
 *     (out of quarantine; their main function becomes primary);
 *  2. ranks the verified candidates by popularity (≥ 2 independent signals),
 *     checks the best ones again, fresh, against every hard gate, and
 *     publishes at most `newToolsPerDay` (default 10) in quarantine: noindex,
 *     labelled "new, being checked", outside rankings, recommendations and
 *     Match. Fewer pass → fewer are published; the gates are never lowered.
 *  3. anomaly guard: more than 25 publications in 24 hours, or an implausible
 *     number of candidates passing at once → nothing is published, the owner
 *     gets one escalation.
 * Every publication, promotion and depublication is logged and reversible.
 */
import { and, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { toolCandidates, tools } from '@/lib/db/schema';
import { loadCatalog } from '@/lib/catalog/load';
import { readDataVersion } from '@/lib/settings';
import { localDate, tzParts, zoned } from '../schedule';
import { newToolPolicy, SCOUT_LIMITS } from '../lib/scout/config';
import { popularity, type GateReason } from '../lib/scout/gates';
import { promote, publishedSince, publishInQuarantine } from '../lib/scout/publish';
import { verifyCandidate } from '../lib/scout/verify';
import { loadIcons, logoForDomain } from '../lib/scout/logo';
import { knownTools } from './verification';
import type { AgentContext, AgentDefinition } from '../types';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** Publication happens in this local window only (one fixed moment a day, with room for a late job). */
const WINDOW = { from: 7, to: 11 };

async function promoteDue(ctx: AgentContext): Promise<{ promoted: number; deferred: number }> {
  const { db } = ctx;
  const now = ctx.now();
  const due = await db
    .select()
    .from(tools)
    .where(and(eq(tools.published, true), isNotNull(tools.quarantineUntil), lte(tools.quarantineUntil, now), isNotNull(tools.discovery)));
  let promoted = 0;
  let deferred = 0;
  for (const t of due) {
    const c = t.discovery!.checks;
    const lastAt = c.lastAt ? new Date(c.lastAt).getTime() : 0;
    const quiet = !c.lastFailureAt || now.getTime() - new Date(c.lastFailureAt).getTime() >= SCOUT_LIMITS.quarantineDays * DAY;
    if (c.lastOk === true && c.failures === 0 && now.getTime() - lastAt <= 26 * HOUR && c.green >= 5 && quiet) {
      await promote(ctx, t);
      promoted++;
    } else {
      // Not every check green yet (or the last one is old): one more day of checks.
      await db.update(tools).set({ quarantineUntil: new Date(now.getTime() + DAY) }).where(eq(tools.id, t.id));
      deferred++;
    }
  }
  return { promoted, deferred };
}

export const newToolsAgent: AgentDefinition = {
  name: 'new-tools',
  description:
    'Daily around 07:00: publishes the most popular verified candidates that pass every hard gate again (at most newToolsPerDay, default 10) in quarantine — noindex, "new, being checked", outside rankings and Match — and promotes tools after 7 green days. Anomaly guard: more than 25 in 24 hours → nothing published, one escalation.',
  schedule: 'daily:07:00',
  autonomy: 'auto',
  maxItems: 30,
  timeoutMs: 12 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const policy = newToolPolicy(ctx.settings);
    const { promoted, deferred } = await promoteDue(ctx);
    if (promoted) ctx.stat('promoted', promoted);
    if (deferred) ctx.stat('promotion_deferred', deferred);
    // Verified candidates nobody published within 30 days expire (re-assessed when they show up again).
    const expired = await db
      .update(toolCandidates)
      .set({ status: 'rejected', notes: 'expired_unpublished' })
      .where(and(eq(toolCandidates.status, 'verified'), lte(toolCandidates.firstSeenAt, new Date(now.getTime() - 30 * DAY))))
      .returning({ id: toolCandidates.id });
    if (expired.length) ctx.stat('expired', expired.length);
    const inQuarantine = async () =>
      Number((await db.execute(sql`SELECT count(*)::int AS n FROM tools WHERE published AND quarantine_until IS NOT NULL`) as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0);
    const done = async (published: number, rejected: Map<string, number>, note: string | null) => {
      const m = await inQuarantine();
      ctx.stat('in_quarantine', m);
      const k = [...rejected.values()].reduce((a, b) => a + b, 0);
      const reasons = [...rejected.entries()].map(([r, n]) => `${r} ${n}`).join(', ');
      return {
        status: 'success' as const,
        summary: [`${published} new tools added, ${m} in quarantine, ${k} rejected${reasons ? ` (${reasons})` : ''}`, promoted ? `${promoted} promoted` : null, note].filter(Boolean).join(' · '),
        dataChanged: published > 0 || promoted > 0,
      };
    };

    if (policy.mode !== 'quarantine') return done(0, new Map(), 'queue mode: new tools are owner decisions');
    const hour = tzParts(now).h;
    if (hour < WINDOW.from || hour >= WINDOW.to) return done(0, new Map(), `outside the publication window (${WINDOW.from}:00–${WINDOW.to}:00)`);
    const p = tzParts(now);
    const midnight = zoned(p.y, p.mo, p.day, 0, 0);
    const today = await publishedSince(db, midnight);
    const remaining = Math.max(0, policy.perDay - today);
    if (!remaining) return done(0, new Map(), `today's ${policy.perDay} already published`);

    // Rank by popularity: at least two independent signals.
    const verified = await db.select().from(toolCandidates).where(eq(toolCandidates.status, 'verified')).limit(1000);
    const ranked = verified
      .map((c) => ({ c, pop: popularity(c.signals, c.lastSeenAt) }))
      .filter((x) => x.pop.ok)
      .sort((a, b) => b.pop.score - a.pop.score || a.c.firstSeenAt.getTime() - b.c.firstSeenAt.getTime());
    ctx.stat('waiting_for_signals', verified.length - ranked.length);
    const last24h = await publishedSince(db, new Date(now.getTime() - DAY));
    const freeze = async (reasonCode: 'new_tools_too_many_passing' | 'new_tools_over_daily_limit', detail: Record<string, unknown>) => {
      await ctx.inbox.escalate({
        kind: 'anomaly_freeze',
        severity: 'p2',
        category: 'data',
        title: reasonCode === 'new_tools_too_many_passing' ? `New tools frozen: ${ranked.length} candidates pass at once` : `New tools frozen: more than ${SCOUT_LIMITS.anomalyPerDay} publications in 24 hours`,
        reasonCode,
        payload: { runId: ctx.runId, last24h, ...detail },
        defaultAction: 'discard_after_7d',
        dueInHours: 7 * 24,
        dedupeKey: `anomaly:new-tools:${localDate(now)}`,
        createdBy: 'agent:new-tools',
      });
      ctx.stat('frozen');
      return done(0, new Map(), 'anomaly: nothing published, the owner was asked');
    };
    if (ranked.length > SCOUT_LIMITS.anomalyPassing) return freeze('new_tools_too_many_passing', { passing: ranked.length });

    // Check the best ones again, fresh, against every gate.
    const known = await knownTools(db);
    const catalog = await loadCatalog(db, await readDataVersion(db), now);
    const planned: { c: (typeof ranked)[number]['c']; out: Extract<Awaited<ReturnType<typeof verifyCandidate>>, { kind: 'pass' }> }[] = [];
    const rejected = new Map<GateReason, number>();
    let attempts = 0;
    for (const { c } of ranked) {
      if (planned.length >= remaining || attempts >= ctx.limits.maxItems || ctx.signal.aborted) break;
      attempts++;
      const out = await verifyCandidate(ctx, c, known, catalog);
      if (out.kind === 'pass') {
        planned.push({ c, out });
        continue;
      }
      if (!out.hard) {
        ctx.stat('retry_later');
        continue;
      }
      const duplicate = out.reason === 'duplicate_domain' || out.reason === 'duplicate_name';
      await db
        .update(toolCandidates)
        .set({ status: duplicate ? 'duplicate' : 'rejected', duplicateOfToolId: out.duplicateOf ?? null, notes: out.reason })
        .where(eq(toolCandidates.id, c.id));
      rejected.set(out.reason, (rejected.get(out.reason) ?? 0) + 1);
      ctx.stat(`rejected_${out.reason}`);
    }
    if (last24h + planned.length > SCOUT_LIMITS.anomalyPerDay) return freeze('new_tools_over_daily_limit', { planned: planned.map((x) => x.out.dossier.name) });

    let published = 0;
    const icons = planned.length ? (loadIcons() ?? []) : [];
    for (const { c, out } of planned) {
      const pop = popularity(out.signals as Record<string, unknown>, c.lastSeenAt);
      if (!pop.ok) continue;
      const logo = logoForDomain(c.domain, icons);
      if (logo) ctx.stat('logos');
      await publishInQuarantine(ctx, c, out.dossier, out.signals, pop, logo);
      published++;
    }
    if (published) ctx.stat('published', published);
    return done(published, rejected, null);
  },
};
