/**
 * Pricing agent: checks official pricing pages and keeps prices honest.
 *  - known price found next to the plan name → plan becomes VERIFIED (anchored);
 *  - a single different price → observation; published only after N identical
 *    observations ≥ confirmHours apart (confirmation by repetition);
 *  - confirmed changes pass the anomaly guard and the policy (hard rules);
 *  - ambiguity or a missing plan never changes data ("re-anchoring needed").
 * Coverage: every published tool with a pricing URL has a pricing source, and
 * a few tools per run whose plans have no official page yet get theirs from
 * the link on their own home page (robots.txt respected), so the hourly runs
 * keep every tool's prices current, each page at most once a day.
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { pendingChanges, pricingPlans, sources, tools } from '@/lib/db/schema';
import { queryRows } from '@/lib/db/sql';
import { computeConfidence, sourceDomain } from '@/lib/provenance/confidence';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import { anomalyVerdict, type ProposedChange } from '../anomaly';
import { decide, priceHardRule, sanityCheckPrice } from '../policy';
import { htmlToText } from '../fetcher/text';
import { checkPlan } from '../lib/anchor';
import { priority, toolImpact } from '../lib/planner';
import { publishPriceChange, type PriceChange } from '../lib/publish-price';
import { ensurePricingSources, pricingLinkOf, recordFetch } from '../lib/tool-sources';
import type { AgentContext, AgentDefinition } from '../types';

const hashValue = (cents: number, currency: string) => createHash('sha1').update(`${cents}:${currency}`).digest('hex').slice(0, 16);

/** Tools whose official pricing page is looked up per run (one home page fetch each). */
const PRICING_SEARCH_PER_RUN = 3;

/**
 * Published tools with plans but no official pricing page: read the link on
 * their own home page and make it their pricing source (logged, reversible).
 * A home page without such a link is read again after 30 days, one that
 * could not be fetched after a day.
 */
async function findPricingPages(ctx: AgentContext): Promise<Set<string>> {
  const { db } = ctx;
  const now = ctx.now();
  const due = await queryRows<{ id: string; website_url: string }>(
    db,
    sql`SELECT t.id::text AS id, t.website_url FROM tools t
         WHERE t.published AND t.pricing_url IS NULL
           AND EXISTS (SELECT 1 FROM pricing_plans p WHERE p.tool_id = t.id AND p.valid_to IS NULL)
           AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.tool_id = t.id AND s.role = 'pricing')
           AND NOT EXISTS (SELECT 1 FROM agent_actions a WHERE a.tool_id = t.id AND a.action IN ('pricing_page_search', 'pricing_url_found')
                             AND a.created_at > ${now.toISOString()}::timestamptz
                                 - CASE WHEN a.reason LIKE 'home page:%' THEN interval '1 day' ELSE interval '30 days' END)
         ORDER BY t.created_at, t.slug
         LIMIT ${PRICING_SEARCH_PER_RUN}`,
  );
  const found = new Set<string>();
  for (const t of due) {
    if (ctx.signal.aborted) break;
    const res = await ctx.fetcher.get(t.website_url, { accept: 'html' });
    const sameSite = res.ok && sourceDomain(res.finalUrl) === sourceDomain(t.website_url);
    const link = sameSite ? pricingLinkOf(htmlToText(res.body, res.finalUrl), res.finalUrl) : null;
    if (!link) {
      await ctx.log.action({
        action: 'pricing_page_search',
        toolId: t.id,
        sourceUrl: t.website_url,
        decision: 'info',
        reason: !res.ok ? `home page: ${res.errorKind ?? 'error'}` : !sameSite ? 'home page redirects to another site' : 'no pricing link on the home page',
      });
      ctx.stat('pricing_page_not_found');
      continue;
    }
    const [src] = await db
      .insert(sources)
      .values({ url: link, domain: new URL(link).hostname.replace(/^www\./, ''), sourceType: 'official', toolId: t.id, role: 'pricing', checkIntervalHours: 24 })
      .onConflictDoUpdate({ target: sources.url, set: { role: 'pricing', toolId: t.id, sourceType: 'official' }, setWhere: sql`${sources.toolId} IS NULL OR ${sources.toolId} = ${t.id}::uuid` })
      .returning({ id: sources.id });
    if (!src) {
      ctx.stat('pricing_page_taken');
      continue;
    }
    await db.update(tools).set({ pricingUrl: link, updatedAt: now }).where(and(eq(tools.id, t.id), isNull(tools.pricingUrl)));
    await ctx.log.action({
      action: 'pricing_url_found',
      entityType: 'source',
      entityId: src.id,
      toolId: t.id,
      field: 'pricing_url',
      oldValue: { pricingUrl: null },
      newValue: { pricingUrl: link, sourceId: src.id },
      sourceUrl: t.website_url,
      decision: 'auto_published',
      reason: 'linked from the official home page',
    });
    found.add(src.id);
  }
  if (found.size) ctx.stat('pricing_pages_found', found.size);
  return found;
}

export const pricingAgent: AgentDefinition = {
  name: 'pricing',
  description: 'Verifies prices on official pricing pages; detects and publishes confirmed changes.',
  schedule: 'every:1h',
  autonomy: 'auto',
  maxItems: 20,
  timeoutMs: 8 * 60_000,
  async run(ctx) {
    const { db, settings } = ctx;
    const now = ctx.now();
    const added = await ensurePricingSources(db);
    if (added) ctx.stat('pricing_sources_added', added);
    // A page found in this run is checked in this run, ahead of the queue.
    const fresh = await findPricingPages(ctx);
    const all = await db.select().from(tools).where(eq(tools.published, true));
    const pricingSources = await db
      .select()
      .from(sources)
      .where(and(eq(sources.role, 'pricing'), inArray(sources.toolId, all.map((t) => t.id).concat(['00000000-0000-0000-0000-000000000000']))));
    const impact = await toolImpact(db);
    const queue = pricingSources
      .map((s) => {
        const ageH = s.lastFetchedAt ? (now.getTime() - s.lastFetchedAt.getTime()) / 3600_000 : 1e6;
        return { s, p: priority(impact.get(s.toolId!) ?? 0, ageH, s.checkIntervalHours) };
      })
      .filter((x) => x.p >= 0)
      .sort((a, b) => Number(fresh.has(b.s.id)) - Number(fresh.has(a.s.id)) || b.p - a.p)
      .slice(0, ctx.limits.maxItems);

    const confirmed: (PriceChange & { oldCents: number | null; pendingId: string })[] = [];
    const touched = new Set<string>();
    // Pending observations are shown publicly as "may have changed", so they refresh caches too.
    let pendingChanged = false;
    for (const { s } of queue) {
      if (ctx.signal.aborted) break;
      const tool = all.find((t) => t.id === s.toolId)!;
      const res = await ctx.fetcher.get(s.url, { accept: 'html' });
      if (!res.ok) {
        await recordFetch(db, s.id, res, undefined, now);
        ctx.stat(`fetch_${res.errorKind ?? 'error'}`);
        continue;
      }
      const page = htmlToText(res.body, res.finalUrl);
      await recordFetch(db, s.id, res, page.text, now);
      ctx.stat('pages_checked');
      const plans = await db
        .select()
        .from(pricingPlans)
        .where(and(eq(pricingPlans.toolId, tool.id), isNull(pricingPlans.validTo), eq(pricingPlans.reviewStatus, 'published')));
      const names = plans.map((p) => p.name);
      for (const plan of plans) {
        if (plan.isCustom) continue;
        const check = checkPlan(page.text, { name: plan.name, priceCents: plan.priceCents, annualMonthlyCents: plan.annualMonthlyCents, currency: plan.currency, isFree: plan.isFree }, names);
        if (check.kind === 'confirmed') {
          const confidence = computeConfidence({ sourceTypes: ['official'], anchor: 'verbatim', observedAt: now, now, method: 'agent' });
          if (plan.status !== 'verified' || !plan.verifiedAt || now.getTime() - plan.verifiedAt.getTime() > 12 * 3600_000) {
            await db
              .update(pricingPlans)
              .set({ status: 'verified', confidence, evidence: check.snippet.slice(0, 600), verifiedAt: now, observedAt: now, sourceId: s.id })
              .where(eq(pricingPlans.id, plan.id));
            await ctx.log.action({
              action: 'plan_verified',
              entityType: 'pricing_plan',
              entityId: plan.id,
              toolId: tool.id,
              field: `plan:${plan.planKey}`,
              oldValue: { status: plan.status, confidence: plan.confidence, verifiedAt: plan.verifiedAt?.toISOString() ?? null, evidence: plan.evidence },
              newValue: { status: 'verified', confidence, evidence: check.snippet.slice(0, 200) },
              sourceUrl: s.url,
              confidence,
              decision: 'auto_published',
              reason: 'anchored_on_official_page',
            });
            touched.add(tool.id);
          }
          ctx.stat('plans_confirmed');
          // A confirmed current price supersedes any pending different observation.
          const cleared = await db
            .update(pendingChanges)
            .set({ status: 'superseded' })
            .where(and(eq(pendingChanges.toolId, tool.id), eq(pendingChanges.key, `plan:${plan.planKey}`), eq(pendingChanges.status, 'pending')))
            .returning({ id: pendingChanges.id });
          if (cleared.length) pendingChanged = true;
          continue;
        }
        if (check.kind === 'changed') {
          if (!sanityCheckPrice(check.cents) || (plan.currency && check.currency !== plan.currency)) {
            ctx.stat('sanity_rejected');
            continue;
          }
          const vh = hashValue(check.cents, check.currency);
          const open = await db
            .select()
            .from(pendingChanges)
            .where(and(eq(pendingChanges.toolId, tool.id), eq(pendingChanges.key, `plan:${plan.planKey}`), eq(pendingChanges.status, 'pending')));
          for (const o of open.filter((o) => o.valueHash !== vh)) {
            await db.update(pendingChanges).set({ status: 'superseded' }).where(eq(pendingChanges.id, o.id));
            pendingChanged = true;
          }
          let pending = open.find((o) => o.valueHash === vh);
          if (!pending) {
            [pending] = await db
              .insert(pendingChanges)
              .values({
                toolId: tool.id,
                key: `plan:${plan.planKey}`,
                proposedValue: { cents: check.cents, currency: check.currency },
                valueHash: vh,
                sourceId: s.id,
                evidence: check.snippet,
                confidence: 95,
                agent: 'pricing',
                firstObservedAt: now,
                lastObservedAt: now,
              })
              .returning();
            ctx.stat('changes_observed');
            pendingChanged = true;
            continue;
          }
          const gapH = (now.getTime() - pending.lastObservedAt.getTime()) / 3600_000;
          if (gapH < settings.price.confirmHours) {
            ctx.stat('changes_waiting');
            continue;
          }
          const observations = pending.observations + 1;
          await db.update(pendingChanges).set({ observations, lastObservedAt: now, evidence: check.snippet }).where(eq(pendingChanges.id, pending.id));
          if (observations < settings.price.confirmations) continue;
          confirmed.push({
            toolId: tool.id,
            toolName: tool.name,
            planKey: plan.planKey,
            newCents: check.cents,
            currency: check.currency,
            evidence: check.snippet,
            sourceId: s.id,
            sourceUrl: s.url,
            confidence: computeConfidence({ sourceTypes: ['official'], anchor: 'verbatim', observedAt: now, now, method: 'agent' }),
            status: 'verified',
            oldCents: plan.priceCents,
            pendingId: pending.id,
          });
          continue;
        }
        ctx.stat(check.kind === 'ambiguous' ? 'plans_ambiguous' : 'plans_not_found');
        await ctx.log.action({ action: 'reanchor_needed', toolId: tool.id, field: `plan:${plan.planKey}`, sourceUrl: s.url, decision: 'info', reason: check.kind });
      }
    }

    // Anomaly guard over the confirmed changes of this run.
    const proposals: ProposedChange[] = confirmed.map((c) => ({ toolId: c.toolId, kind: 'price' }));
    const verdict = anomalyVerdict(proposals, all.length, settings.anomaly);
    let published = 0;
    if (verdict.freeze && confirmed.length) {
      await ctx.inbox.escalate({
        kind: 'anomaly_freeze',
        severity: verdict.severity ?? 'p2',
        category: 'data',
        title: `Pricing run frozen: ${confirmed.length} price changes at once`,
        reasonCode: verdict.reason ?? 'anomaly',
        payload: { runId: ctx.runId, changes: confirmed.map(({ pendingId, ...c }) => ({ ...c, pendingId })) },
        defaultAction: 'discard_after_7d',
        dueInHours: 7 * 24,
        dedupeKey: `anomaly:pricing:${ctx.runId}`,
        createdBy: 'agent:pricing',
      });
      ctx.stat('frozen', confirmed.length);
    } else {
      for (const c of confirmed) {
        const hard = priceHardRule(c.oldCents, c.newCents, settings.policy);
        const d = decide({ confidence: c.confidence, risk: 'R1', autonomy: ctx.autonomy, hardRule: hard }, settings.policy);
        if (d.decision === 'auto_published' || d.decision === 'auto_published_flagged') {
          const r = await publishPriceChange(db, c, ctx.log, d.decision, 'agent:pricing', now);
          await db.update(pendingChanges).set({ status: 'confirmed' }).where(eq(pendingChanges.id, c.pendingId));
          if (r.published) {
            published++;
            touched.add(c.toolId);
            if (d.decision === 'auto_published_flagged') {
              await ctx.inbox.escalate({
                kind: 'price_change',
                severity: 'p3',
                category: 'data',
                toolId: c.toolId,
                title: `Published (flagged): ${c.toolName} ${c.planKey}`,
                reasonCode: 'flagged_for_post_check',
                payload: { ...c, oldCents: c.oldCents },
                defaultAction: 'keep_published',
                dueInHours: settings.autonomy.slaDays * 24,
                groupKey: `flagged-prices:${now.toISOString().slice(0, 10)}`,
                createdBy: 'agent:pricing',
              });
            }
          }
        } else {
          // Human decision with a safe default (docs/strategy/12 §5.5).
          const anchoredTwice = c.status === 'verified';
          await ctx.inbox.escalate({
            kind: 'price_change',
            severity: hard ? 'p2' : 'p3',
            category: 'data',
            toolId: c.toolId,
            title: `${c.toolName} ${c.planKey}: ${c.oldCents ?? '?'} → ${c.newCents} ${c.currency}`,
            reasonCode: hard ?? d.reason,
            payload: { ...c, oldCents: c.oldCents },
            confidence: c.confidence,
            defaultAction: anchoredTwice && hard?.startsWith('price_') ? 'publish_with_label' : 'keep_old_price_flag',
            dueInHours: anchoredTwice && hard ? settings.autonomy.largePriceDefaultHours : settings.autonomy.slaDays * 24,
            dedupeKey: `price:${c.toolId}:${c.planKey}:${c.newCents}`,
            createdBy: 'agent:pricing',
          });
          ctx.stat('escalated');
        }
      }
    }
    // Freshness only moves when a price was actually confirmed (snapshot recompute),
    // never merely because a fetch was attempted.
    for (const id of touched) await recomputeToolSnapshot(db, id, settings.freshness, now);
    const summary = `${queue.length} pricing pages · ${published} changes published${verdict.freeze ? ' · run frozen (anomaly)' : ''}`;
    return { status: 'success', summary, dataChanged: touched.size > 0 || published > 0 || pendingChanged };
  },
};
