/**
 * Opportunity agent (docs/strategy/12 §9): turns measured demand into ranked
 * owner opportunities. It never changes rankings, recommendation order or
 * which tools are shown: commercial value only decides what the owner is
 * told about, never what visitors see.
 *
 *  1. Programme coverage: outbound clicks to tools without an affiliate link,
 *     valued as EV = clicks(30 d) × c × r (measured once enough conversions exist,
 *     otherwise the base-scenario assumptions, labelled as such).
 *  2. Unmet demand: Match queries without a task or capability.
 *  3. Blocked comparisons: compared pairs that fail the Fair Fight data gate.
 *  4. Readiness: thresholds for newsletter sponsorship, sponsor slots, vendor insights.
 *  5. LLM gating: moves the Match LLM threshold within the owner's bounds
 *     when measured click-through shows the LLM does (not) add value.
 */
import { eq, sql } from 'drizzle-orm';
import { queryRows } from '@/lib/db/sql';
import { loadCatalog } from '@/lib/catalog/load';
import { fairFightGate } from '@/lib/engine/compare';
import { NEWSLETTER_MIN_SUBSCRIBERS, SCENARIOS, SPONSOR_MIN_VISITORS } from '@/lib/revenue/scenarios';
import { readDataVersion, saveSetting } from '@/lib/settings';
import { tools } from '@/lib/db/schema';
import type { AgentContext, AgentDefinition } from '../types';

/** Minimum measured conversions before measured c and r replace the assumptions. */
export const MIN_CONVERSIONS_FOR_MEASURED_EV = 30;
export const UNMET_MIN_COUNT = 5;
export const COMPARE_MIN_VIEWS = 20;
export const INSIGHTS_MIN_MATCHES = 10_000;
const GATING_STEP = 0.05;
const GATING_MIN_SAMPLE = 200;

interface EvBasis {
  c: number;
  rCents: number;
  measured: boolean;
}

async function evBasis(ctx: AgentContext): Promise<EvBasis> {
  const [m] = await queryRows<{ conv: string; clicks: string; cents: string }>(
    ctx.db,
    sql`SELECT (SELECT count(*) FROM conversions WHERE status IN ('approved', 'paid') AND currency = 'EUR' AND occurred_at > now() - interval '180 days')::text AS conv,
               (SELECT count(*) FROM outbound_clicks WHERE link_kind = 'affiliate' AND ts > now() - interval '180 days')::text AS clicks,
               (SELECT COALESCE(sum(amount_cents), 0) FROM conversions WHERE status IN ('approved', 'paid') AND currency = 'EUR' AND occurred_at > now() - interval '180 days')::text AS cents`,
  );
  const conv = Number(m?.conv ?? 0);
  const clicks = Number(m?.clicks ?? 0);
  if (conv >= MIN_CONVERSIONS_FOR_MEASURED_EV && clicks > 0) return { c: conv / clicks, rCents: Math.round(Number(m?.cents ?? 0) / conv), measured: true };
  const base = SCENARIOS.base;
  return { c: base.c, rCents: Math.round(base.r * 100), measured: false };
}

async function programmeCoverage(ctx: AgentContext, basis: EvBasis): Promise<number> {
  const rows = await queryRows<{ tool_id: string; name: string; slug: string; clicks: string; programme: string | null }>(
    ctx.db,
    sql`SELECT o.tool_id::text AS tool_id, t.name, t.slug, count(*)::text AS clicks,
               (SELECT p.status FROM affiliate_programs p WHERE p.tool_id = o.tool_id ORDER BY p.created_at DESC LIMIT 1) AS programme
        FROM outbound_clicks o JOIN tools t ON t.id = o.tool_id
        WHERE o.ts > ${ctx.now().toISOString()}::timestamptz - interval '30 days'
          AND NOT EXISTS (SELECT 1 FROM affiliate_links l WHERE l.tool_id = o.tool_id AND l.active)
        GROUP BY o.tool_id, t.name, t.slug ORDER BY count(*) DESC LIMIT 25`,
  );
  let n = 0;
  for (const r of rows) {
    const clicks = Number(r.clicks);
    const ev = Math.round(clicks * basis.c * basis.rCents);
    ctx.stat('coverage_candidates');
    // Rejected or closed programmes are the owner's decision; don't re-ask.
    if (ev < ctx.settings.autonomy.opportunityMinEvCents || r.programme === 'rejected' || r.programme === 'closed') continue;
    const month = ctx.now().toISOString().slice(0, 7);
    await ctx.inbox.escalate({
      kind: 'opportunity',
      severity: 'p2',
      category: 'commercial',
      toolId: r.tool_id,
      title: `Affiliate programme for ${r.name}: ~€${(ev / 100).toFixed(0)}/month (estimate)`,
      reasonCode: 'affiliate_coverage',
      payload: { tool: r.slug, clicks30d: clicks, c: basis.c, rCents: basis.rCents, measured: basis.measured, programmeStatus: r.programme },
      impact: {
        evCentsPerMonth: ev,
        evBasis: `${clicks} clicks (30 d) × ${(basis.c * 100).toFixed(1)}% × €${(basis.rCents / 100).toFixed(2)} (${basis.measured ? 'measured' : 'base-scenario assumption'})`,
      },
      priority: Math.min(89, 50 + Math.round(ev / 500)),
      defaultAction: 'keep_open',
      dedupeKey: `opportunity:affiliate:${r.tool_id}:${month}`,
      createdBy: 'agent:opportunity',
    });
    n++;
  }
  return n;
}

async function unmetDemand(ctx: AgentContext): Promise<number> {
  const rows = await queryRows<{ q: string; n: string; locales: string[] }>(
    ctx.db,
    sql`SELECT lower(btrim(query_scrubbed)) AS q, count(*)::text AS n, array_agg(DISTINCT locale) AS locales
        FROM match_queries
        WHERE ts > ${ctx.now().toISOString()}::timestamptz - interval '30 days' AND task_id IS NULL
          AND cardinality(capability_ids) = 0 AND query_scrubbed IS NOT NULL AND length(btrim(query_scrubbed)) >= 4
        GROUP BY 1 HAVING count(*) >= ${UNMET_MIN_COUNT} ORDER BY count(*) DESC LIMIT 10`,
  );
  const week = ctx.now().toISOString().slice(0, 10);
  for (const r of rows) {
    await ctx.inbox.escalate({
      kind: 'opportunity',
      severity: 'p3',
      category: 'content',
      title: `Unmet demand: "${r.q.slice(0, 80)}" (${r.n}× in 30 days)`,
      reasonCode: 'unmet_demand',
      payload: { query: r.q.slice(0, 200), count: Number(r.n), locales: r.locales },
      defaultAction: 'expire_p3',
      groupKey: `unmet:${week}`,
      dedupeKey: `unmet:${r.q.slice(0, 100)}:${week.slice(0, 7)}`,
      createdBy: 'agent:opportunity',
    });
  }
  return rows.length;
}

async function blockedComparisons(ctx: AgentContext): Promise<number> {
  const rows = await queryRows<{ tools: string[] | null; n: string }>(
    ctx.db,
    sql`SELECT ARRAY(SELECT jsonb_array_elements_text(props->'tools') ORDER BY 1) AS tools, count(*)::text AS n
        FROM events WHERE type = 'pageview' AND page_type = 'compare' AND jsonb_typeof(props->'tools') = 'array'
          AND jsonb_array_length(props->'tools') = 2 AND ts > ${ctx.now().toISOString()}::timestamptz - interval '30 days'
        GROUP BY 1 HAVING count(*) >= ${COMPARE_MIN_VIEWS} ORDER BY count(*) DESC LIMIT 20`,
  );
  if (!rows.length) return 0;
  const catalog = await loadCatalog(ctx.db, await readDataVersion(ctx.db), ctx.now());
  let n = 0;
  for (const r of rows) {
    const [a, b] = (r.tools ?? []).map((s) => catalog.toolsBySlug.get(s));
    if (!a || !b) continue;
    const gate = fairFightGate(a, b);
    if (gate.ok) continue;
    await ctx.inbox.escalate({
      kind: 'opportunity',
      severity: 'p3',
      category: 'content',
      title: `Popular comparison without a Fair Fight page: ${a.name} vs ${b.name} (${r.n} views)`,
      reasonCode: 'compare_gap',
      payload: { pair: [a.slug, b.slug], views30d: Number(r.n), gate: gate.reasons, differences: gate.differences },
      defaultAction: 'expire_p3',
      groupKey: `compare-gap:${ctx.now().toISOString().slice(0, 7)}`,
      dedupeKey: `compare-gap:${[a.slug, b.slug].join('|')}:${ctx.now().toISOString().slice(0, 7)}`,
      createdBy: 'agent:opportunity',
    });
    n++;
  }
  return n;
}

async function readiness(ctx: AgentContext): Promise<number> {
  const [m] = await queryRows<{ subs: string; visits: string; matches: string }>(
    ctx.db,
    sql`SELECT (SELECT count(*) FROM subscribers WHERE status = 'confirmed' AND newsletter)::text AS subs,
               (SELECT count(DISTINCT visitor_hash) FROM events WHERE type = 'pageview' AND ts > now() - interval '30 days')::text AS visits,
               (SELECT count(*) FROM match_queries WHERE ts > now() - interval '30 days')::text AS matches`,
  );
  const checks: [string, number, number][] = [
    ['newsletter_sponsorship', Number(m?.subs ?? 0), NEWSLETTER_MIN_SUBSCRIBERS],
    ['sponsor_slot', Number(m?.visits ?? 0), SPONSOR_MIN_VISITORS],
    ['vendor_insights', Number(m?.matches ?? 0), INSIGHTS_MIN_MATCHES],
  ];
  let n = 0;
  for (const [key, value, threshold] of checks) {
    if (value < threshold) continue;
    const r = await ctx.inbox.escalate({
      kind: 'opportunity',
      severity: 'p2',
      category: 'commercial',
      title: `Ready for ${key.replace('_', ' ')}: ${value} ≥ ${threshold}`,
      reasonCode: `readiness_${key}`,
      payload: { key, value, threshold },
      defaultAction: 'keep_open',
      dedupeKey: `readiness:${key}`,
      createdBy: 'agent:opportunity',
    });
    if (r.created) n++;
  }
  return n;
}

/** Two-proportion z statistic. */
function zScore(x1: number, n1: number, x2: number, n2: number): number {
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  return se === 0 ? 0 : (x1 / n1 - x2 / n2) / se;
}

/**
 * Compare click-through of LLM-answered Matches with the randomized holdout
 * (same population: low lexical confidence). Moves the gating threshold one
 * step within the owner's bounds; never touches rankings.
 */
async function tuneGating(ctx: AgentContext): Promise<string | null> {
  const llm = ctx.settings.llm;
  const rows = await queryRows<{ arm: string; n: string; clicked: string }>(
    ctx.db,
    sql`SELECT CASE WHEN q.llm_holdout THEN 'holdout' ELSE 'llm' END AS arm, count(*)::text AS n,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM outbound_clicks o WHERE o.match_query_id = q.id))::text AS clicked
        FROM match_queries q
        WHERE q.ts > ${ctx.now().toISOString()}::timestamptz - interval '30 days' AND q.llm_eligible AND (q.llm_holdout OR q.engine = 'llm')
        GROUP BY 1`,
  );
  const L = rows.find((r) => r.arm === 'llm');
  const H = rows.find((r) => r.arm === 'holdout');
  if (!L || !H || Number(H.n) < GATING_MIN_SAMPLE || Number(L.n) < GATING_MIN_SAMPLE) return null;
  const z = zScore(Number(L.clicked), Number(L.n), Number(H.clicked), Number(H.n));
  let next = llm.gatingThreshold;
  if (z > 1.96) next = Math.min(llm.gatingMax, llm.gatingThreshold + GATING_STEP);
  else if (z <= 0) next = Math.max(llm.gatingMin, llm.gatingThreshold - GATING_STEP);
  next = Math.round(next * 100) / 100;
  if (next === llm.gatingThreshold) return null;
  await saveSetting(ctx.db, 'llm', { ...llm, gatingThreshold: next }, 'agent:opportunity');
  await ctx.log.action({
    action: 'llm_gating_adjusted',
    entityType: 'setting',
    entityId: 'llm',
    field: 'gatingThreshold',
    oldValue: { gatingThreshold: llm.gatingThreshold },
    newValue: { gatingThreshold: next },
    decision: 'auto_published',
    reason: `CTR llm ${L.clicked}/${L.n} vs holdout ${H.clicked}/${H.n} (z=${z.toFixed(2)}), bounds ${llm.gatingMin}–${llm.gatingMax}`,
  });
  return `gating ${llm.gatingThreshold} → ${next}`;
}

export const opportunityAgent: AgentDefinition = {
  name: 'opportunity',
  description: 'Ranks affiliate coverage, unmet demand, blocked comparisons and readiness thresholds by expected value; tunes LLM gating within owner bounds.',
  schedule: 'daily:05:10',
  autonomy: 'auto',
  maxItems: 50,
  timeoutMs: 5 * 60_000,
  async run(ctx) {
    const basis = await evBasis(ctx);
    const coverage = await programmeCoverage(ctx, basis);
    const unmet = await unmetDemand(ctx);
    const compare = await blockedComparisons(ctx);
    const ready = await readiness(ctx);
    const gating = await tuneGating(ctx);
    ctx.stat('affiliate_opportunities', coverage);
    ctx.stat('unmet_queries', unmet);
    ctx.stat('compare_gaps', compare);
    ctx.stat('readiness', ready);
    // Tool count only for context in the summary.
    const [{ n } = { n: 0 }] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(tools).where(eq(tools.published, true));
    return {
      status: 'success',
      summary: `${coverage} affiliate · ${unmet} unmet queries · ${compare} comparison gaps · ${ready} readiness${gating ? ` · ${gating}` : ''} (${n} tools, EV basis ${basis.measured ? 'measured' : 'assumed'})`,
    };
  },
};
