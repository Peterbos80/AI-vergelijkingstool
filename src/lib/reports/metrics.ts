/**
 * Owner metrics (docs/strategy/12 §6–7): the fixed queries behind the owner
 * dashboard and the weekly report. Rules:
 *  - every number comes from our own tables; there is no demo or filler data;
 *  - unknown ≠ 0: when a source is missing or stale the metric says so;
 *  - every revenue figure carries its source and "data through" date;
 *  - changes in counts are only called meaningful past the noise rule (§7.3).
 */
import { sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';
import { channelOf } from '@/lib/analytics/visitor';
import { toEurCents } from '@/lib/pricing/money';

export interface Period {
  start: Date;
  end: Date;
}

export type Trend = 'up' | 'down' | 'normal' | 'insufficient';

/**
 * Noise rule (§7.3): a change in a count is meaningful only when
 * |Δ| > 2·√previous (Poisson, ±95%) and the previous value is ≥ 30.
 */
export function trend(current: number, previous: number | null): Trend {
  if (previous === null || previous < 30) return 'insufficient';
  const delta = current - previous;
  if (Math.abs(delta) > 2 * Math.sqrt(previous)) return delta > 0 ? 'up' : 'down';
  return 'normal';
}

export interface Counted {
  value: number;
  previous: number | null;
  trend: Trend;
}

export const counted = (value: number, previous: number | null): Counted => ({ value, previous, trend: trend(value, previous) });

export interface Money {
  cents: number;
  currency: string;
}

const iso = (d: Date) => d.toISOString();
const n = (v: unknown) => Number(v ?? 0);

function previousPeriod(p: Period): Period {
  const len = p.end.getTime() - p.start.getTime();
  return { start: new Date(p.start.getTime() - len), end: p.start };
}

async function fxRates(db: Database): Promise<{ day: string | null; rates: Map<string, number> }> {
  const rows = await queryRows<{ day: string; quote: string; rate: string }>(
    db,
    sql`SELECT day::text AS day, quote, rate::text AS rate FROM fx_rates WHERE day = (SELECT max(day) FROM fx_rates)`,
  );
  return { day: rows[0]?.day ?? null, rates: new Map(rows.map((r) => [r.quote, Number(r.rate)])) };
}

/** Sum money in EUR; null when any currency has no known rate (never guessed). */
export function eurTotal(amounts: Money[], rates: ReadonlyMap<string, number>): number | null {
  let total = 0;
  for (const a of amounts) {
    const e = toEurCents(a.cents, a.currency, rates);
    if (e === null) return null;
    total += e;
  }
  return total;
}

function addMoney(list: Money[], cents: number, currency: string) {
  const hit = list.find((m) => m.currency === currency);
  if (hit) hit.cents += cents;
  else list.push({ cents, currency });
}

/* ───────────────────────────── Traffic ───────────────────────────── */

export type Channel = 'organic' | 'ai' | 'social' | 'email' | 'referral' | 'direct';
export const CHANNELS: Channel[] = ['organic', 'ai', 'social', 'email', 'referral', 'direct'];

export interface TrafficMetrics {
  /** False when no page view was ever recorded (fresh install). */
  hasData: boolean;
  lastEventAt: string | null;
  /** Visitor-days: visitor hashes rotate daily, so this counts unique visitors per day, summed. */
  visits: Counted;
  pageviews: Counted;
  /** Visits by landing channel (referrer of the first page view of a visit). */
  channels: Record<Channel, Counted>;
  matches: Counted;
  matchesLlm: number;
  topPages: { path: string; pageviews: number; visits: number; clicks: number }[];
  topTools: { toolId: string; name: string; slug: string; pageviews: number; clicks: number }[];
}

async function trafficCounts(db: Database, p: Period) {
  const [base] = await queryRows<{ pageviews: string; visits: string }>(
    db,
    sql`SELECT count(*)::text AS pageviews, count(DISTINCT visitor_hash)::text AS visits
        FROM events WHERE type = 'pageview' AND ts >= ${iso(p.start)}::timestamptz AND ts < ${iso(p.end)}::timestamptz`,
  );
  const landing = await queryRows<{ referrer_domain: string | null; utm_medium: string | null; n: string }>(
    db,
    sql`SELECT referrer_domain, utm_medium, count(*)::text AS n FROM (
          SELECT DISTINCT ON (visitor_hash) visitor_hash, referrer_domain, utm_medium
          FROM events
          WHERE type = 'pageview' AND visitor_hash IS NOT NULL AND ts >= ${iso(p.start)}::timestamptz AND ts < ${iso(p.end)}::timestamptz
          ORDER BY visitor_hash, ts
        ) f GROUP BY 1, 2`,
  );
  const channels = Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Record<Channel, number>;
  for (const r of landing) channels[channelOf(r.referrer_domain, r.utm_medium)] += n(r.n);
  const [m] = await queryRows<{ total: string; llm: string }>(
    db,
    sql`SELECT count(*)::text AS total, count(*) FILTER (WHERE engine = 'llm')::text AS llm
        FROM match_queries WHERE ts >= ${iso(p.start)}::timestamptz AND ts < ${iso(p.end)}::timestamptz`,
  );
  return { pageviews: n(base?.pageviews), visits: n(base?.visits), channels, matches: n(m?.total), matchesLlm: n(m?.llm) };
}

export async function trafficMetrics(db: Database, p: Period): Promise<TrafficMetrics> {
  const prev = previousPeriod(p);
  const [cur, before] = [await trafficCounts(db, p), await trafficCounts(db, prev)];
  const [last] = await queryRows<{ at: string | null }>(db, sql`SELECT max(ts)::text AS at FROM events WHERE type = 'pageview'`);
  const pages = await queryRows<{ path: string; pageviews: string; visits: string }>(
    db,
    sql`SELECT path, count(*)::text AS pageviews, count(DISTINCT visitor_hash)::text AS visits
        FROM events WHERE type = 'pageview' AND path IS NOT NULL AND ts >= ${iso(p.start)}::timestamptz AND ts < ${iso(p.end)}::timestamptz
        GROUP BY path ORDER BY count(*) DESC LIMIT 10`,
  );
  const clicksByPage = await queryRows<{ page_path: string; clicks: string }>(
    db,
    sql`SELECT page_path, count(*)::text AS clicks FROM outbound_clicks
        WHERE page_path IS NOT NULL AND ts >= ${iso(p.start)}::timestamptz AND ts < ${iso(p.end)}::timestamptz GROUP BY page_path`,
  );
  const clickMap = new Map(clicksByPage.map((r) => [r.page_path, n(r.clicks)]));
  const tools = await queryRows<{ tool_id: string; name: string; slug: string; pageviews: string; clicks: string }>(
    db,
    sql`WITH v AS (
          SELECT entity_id AS tool_id, count(*) AS pageviews FROM events
          WHERE type = 'pageview' AND page_type IN ('tool', 'tool_pricing', 'tool_alternatives') AND entity_id IS NOT NULL
            AND ts >= ${iso(p.start)}::timestamptz AND ts < ${iso(p.end)}::timestamptz
          GROUP BY entity_id),
        c AS (
          SELECT tool_id::text AS tool_id, count(*) AS clicks FROM outbound_clicks
          WHERE ts >= ${iso(p.start)}::timestamptz AND ts < ${iso(p.end)}::timestamptz GROUP BY tool_id)
        SELECT t.id::text AS tool_id, t.name, t.slug, COALESCE(v.pageviews, 0)::text AS pageviews, COALESCE(c.clicks, 0)::text AS clicks
        FROM tools t LEFT JOIN v ON v.tool_id = t.id::text LEFT JOIN c ON c.tool_id = t.id::text
        WHERE v.pageviews IS NOT NULL OR c.clicks IS NOT NULL
        ORDER BY COALESCE(c.clicks, 0) DESC, COALESCE(v.pageviews, 0) DESC LIMIT 10`,
  );
  return {
    hasData: Boolean(last?.at),
    lastEventAt: last?.at ?? null,
    visits: counted(cur.visits, before.visits),
    pageviews: counted(cur.pageviews, before.pageviews),
    channels: Object.fromEntries(CHANNELS.map((c) => [c, counted(cur.channels[c], before.channels[c])])) as Record<Channel, Counted>,
    matches: counted(cur.matches, before.matches),
    matchesLlm: cur.matchesLlm,
    topPages: pages.map((r) => ({ path: r.path, pageviews: n(r.pageviews), visits: n(r.visits), clicks: clickMap.get(r.path) ?? 0 })),
    topTools: tools.map((r) => ({ toolId: r.tool_id, name: r.name, slug: r.slug, pageviews: n(r.pageviews), clicks: n(r.clicks) })),
  };
}

/* ───────────────────────────── Revenue ───────────────────────────── */

export type RevenueStream = 'affiliate' | 'sponsorship' | 'newsletter' | 'lead' | 'data' | 'other';
export const STREAMS: RevenueStream[] = ['affiliate', 'sponsorship', 'newsletter', 'lead', 'data', 'other'];

export interface StreamRevenue {
  stream: RevenueStream;
  /**
   * ok: data covers the whole period · partial: data ends inside the period ·
   * unknown: a source exists but has no data · not_configured: no source ·
   * none: manual stream without any entry so far.
   */
  status: 'ok' | 'partial' | 'unknown' | 'not_configured' | 'none';
  amounts: Money[];
  /** Affiliate only: commissions not yet approved by the network. */
  pending: Money[];
  eurCents: number | null;
  /** Data complete through this date (YYYY-MM-DD). */
  through: string | null;
  source: 'conversion_import' | 'manual_entries';
  reason?: string;
}

/** Imports that end at most this long before the period end count as complete. */
export const IMPORT_GRACE_MS = 3 * 86_400_000;

export interface RevenueMetrics {
  streams: StreamRevenue[];
  /** Known revenue in EUR; null when a currency cannot be converted. */
  totalEurCents: number | null;
  /** True when a stream is partial/unknown, so the total is a lower bound. */
  lowerBound: boolean;
  fxDay: string | null;
  conversions: number;
  leads: { created: Counted; qualified: number; won: number; wonValue: Money[] };
}

export async function revenueMetrics(db: Database, p: Period, staleImportDays: number): Promise<RevenueMetrics> {
  const fx = await fxRates(db);
  const streams: StreamRevenue[] = [];

  // Affiliate: imported conversions, attributed to the period by occurred_at.
  const programs = await queryRows<{ id: string; last_import: string | null }>(
    db,
    sql`SELECT p.id::text AS id, max(c.imported_at)::text AS last_import
        FROM affiliate_programs p LEFT JOIN conversions c ON c.program_id = p.id
        WHERE p.status = 'approved' GROUP BY p.id`,
  );
  const conv = await queryRows<{ status: string; currency: string; cents: string; n: string }>(
    db,
    sql`SELECT status, currency, sum(amount_cents)::text AS cents, count(*)::text AS n FROM conversions
        WHERE status <> 'reversed' AND occurred_at >= ${iso(p.start)}::timestamptz AND occurred_at < ${iso(p.end)}::timestamptz
        GROUP BY status, currency`,
  );
  const amounts: Money[] = [];
  const pending: Money[] = [];
  for (const r of conv) addMoney(r.status === 'pending' ? pending : amounts, n(r.cents), r.currency);
  const conversionsCount = conv.reduce((s, r) => s + n(r.n), 0);
  if (!programs.length && !conv.length) {
    streams.push({ stream: 'affiliate', status: 'not_configured', amounts, pending, eurCents: null, through: null, source: 'conversion_import', reason: 'no_approved_programme' });
  } else {
    const imports = programs.map((x) => x.last_import).filter((x): x is string => Boolean(x));
    const through = imports.length === programs.length && imports.length ? imports.map((x) => new Date(x)).sort((a, b) => a.getTime() - b.getTime())[0]! : null;
    let status: StreamRevenue['status'] = 'ok';
    let reason: string | undefined;
    if (!through) {
      status = imports.length ? 'partial' : 'unknown';
      reason = imports.length ? 'programme_without_import' : 'no_import_yet';
    } else if (through.getTime() < p.end.getTime() - IMPORT_GRACE_MS) {
      // Networks report with a delay; a few days of lag is normal, more is "incomplete".
      const staleDays = (p.end.getTime() - through.getTime()) / 86_400_000;
      status = 'partial';
      reason = staleDays > staleImportDays ? 'import_stale' : 'import_before_period_end';
    }
    streams.push({
      stream: 'affiliate',
      status,
      amounts,
      pending,
      eurCents: status === 'unknown' ? null : eurTotal(amounts, fx.rates),
      through: through ? iso(through).slice(0, 10) : null,
      source: 'conversion_import',
      reason,
    });
  }

  // Manual streams (revenue_entries).
  const entries = await queryRows<{ kind: string; currency: string; cents: string }>(
    db,
    sql`SELECT kind, currency, sum(amount_cents)::text AS cents FROM revenue_entries
        WHERE day >= ${iso(p.start).slice(0, 10)}::date AND day < ${iso(p.end).slice(0, 10)}::date GROUP BY kind, currency`,
  );
  const lastEntry = await queryRows<{ kind: string; last: string }>(db, sql`SELECT kind, max(day)::text AS last FROM revenue_entries GROUP BY kind`);
  for (const stream of STREAMS.filter((s) => s !== 'affiliate')) {
    const list: Money[] = [];
    for (const r of entries.filter((e) => e.kind === stream)) addMoney(list, n(r.cents), r.currency);
    const last = lastEntry.find((x) => x.kind === stream)?.last ?? null;
    streams.push({
      stream,
      status: last ? 'ok' : 'none',
      amounts: list,
      pending: [],
      eurCents: last ? eurTotal(list, fx.rates) : null,
      through: last,
      source: 'manual_entries',
    });
  }

  const known = streams.filter((s) => s.status === 'ok' || s.status === 'partial');
  let total: number | null = 0;
  for (const s of known) total = total === null || s.eurCents === null ? null : total + s.eurCents;

  const prev = previousPeriod(p);
  const [leadsNow] = await queryRows<{ created: string; qualified: string; won: string }>(
    db,
    sql`SELECT count(*)::text AS created,
               count(*) FILTER (WHERE status IN ('qualified', 'won'))::text AS qualified,
               count(*) FILTER (WHERE status = 'won')::text AS won
        FROM leads WHERE created_at >= ${iso(p.start)}::timestamptz AND created_at < ${iso(p.end)}::timestamptz`,
  );
  const [leadsPrev] = await queryRows<{ created: string }>(
    db,
    sql`SELECT count(*)::text AS created FROM leads WHERE created_at >= ${iso(prev.start)}::timestamptz AND created_at < ${iso(prev.end)}::timestamptz`,
  );
  const wonRows = await queryRows<{ currency: string | null; cents: string }>(
    db,
    sql`SELECT currency, sum(value_cents)::text AS cents FROM leads
        WHERE status = 'won' AND value_cents IS NOT NULL AND created_at >= ${iso(p.start)}::timestamptz AND created_at < ${iso(p.end)}::timestamptz
        GROUP BY currency`,
  );
  const wonValue: Money[] = [];
  for (const r of wonRows) addMoney(wonValue, n(r.cents), r.currency ?? 'EUR');

  return {
    streams,
    totalEurCents: known.length ? total : null,
    lowerBound: streams.some((s) => s.status === 'partial' || s.status === 'unknown'),
    fxDay: fx.day,
    conversions: conversionsCount,
    leads: { created: counted(n(leadsNow?.created), n(leadsPrev?.created)), qualified: n(leadsNow?.qualified), won: n(leadsNow?.won), wonValue },
  };
}

/* ───────────────────────────── Commerce (clicks, EPC) ───────────────────────────── */

/** Minimum samples before a ratio is shown (docs/strategy/12 C3). */
export const MIN_CLICKS_FOR_EPC = 100;
export const MIN_PAGEVIEWS_FOR_RPM = 1000;

export interface CommerceMetrics {
  clicks: Counted;
  affiliateClicks: Counted;
  /** Tools that received outbound clicks but have no active affiliate link. */
  clicksWithoutProgramme: { toolId: string; name: string; clicks: number }[];
  byPageType: {
    pageType: string;
    pageviews: number;
    clicks: number;
    affiliateClicks: number;
    revenueEurCents: number | null;
    /** Earnings per affiliate click (EUR cents); null below the minimum sample. */
    epcEurCents: number | null;
    /** Revenue per 1000 page views (EUR cents); null below the minimum sample. */
    rpmEurCents: number | null;
  }[];
  brokenAffiliateLinks: { linkId: string; toolId: string; name: string; status: number | null }[];
}

export async function commerceMetrics(db: Database, p: Period): Promise<CommerceMetrics> {
  const prev = previousPeriod(p);
  const clickCounts = async (q: Period) => {
    const [r] = await queryRows<{ total: string; aff: string }>(
      db,
      sql`SELECT count(*)::text AS total, count(*) FILTER (WHERE link_kind = 'affiliate')::text AS aff FROM outbound_clicks
          WHERE ts >= ${iso(q.start)}::timestamptz AND ts < ${iso(q.end)}::timestamptz`,
    );
    return { total: n(r?.total), aff: n(r?.aff) };
  };
  const [cur, before] = [await clickCounts(p), await clickCounts(prev)];
  const fx = await fxRates(db);
  const perType = await queryRows<{ page_type: string; clicks: string; aff: string }>(
    db,
    sql`SELECT COALESCE(page_type, 'unknown') AS page_type, count(*)::text AS clicks, count(*) FILTER (WHERE link_kind = 'affiliate')::text AS aff
        FROM outbound_clicks WHERE ts >= ${iso(p.start)}::timestamptz AND ts < ${iso(p.end)}::timestamptz GROUP BY 1`,
  );
  const views = await queryRows<{ page_type: string; n: string }>(
    db,
    sql`SELECT COALESCE(page_type, 'unknown') AS page_type, count(*)::text AS n FROM events
        WHERE type = 'pageview' AND ts >= ${iso(p.start)}::timestamptz AND ts < ${iso(p.end)}::timestamptz GROUP BY 1`,
  );
  // Revenue attributed through the click id (affiliate sub-id).
  const rev = await queryRows<{ page_type: string; currency: string; cents: string }>(
    db,
    sql`SELECT COALESCE(o.page_type, 'unknown') AS page_type, c.currency, sum(c.amount_cents)::text AS cents
        FROM conversions c JOIN outbound_clicks o ON o.id = c.click_id
        WHERE c.status IN ('approved', 'paid') AND o.ts >= ${iso(p.start)}::timestamptz AND o.ts < ${iso(p.end)}::timestamptz
        GROUP BY 1, 2`,
  );
  const types = new Set([...perType.map((r) => r.page_type), ...views.map((r) => r.page_type)]);
  const byPageType = [...types].map((pageType) => {
    const c = perType.find((r) => r.page_type === pageType);
    const pageviews = n(views.find((r) => r.page_type === pageType)?.n);
    const money: Money[] = [];
    for (const r of rev.filter((x) => x.page_type === pageType)) addMoney(money, n(r.cents), r.currency);
    const eur = eurTotal(money, fx.rates);
    const aff = n(c?.aff);
    return {
      pageType,
      pageviews,
      clicks: n(c?.clicks),
      affiliateClicks: aff,
      revenueEurCents: eur,
      epcEurCents: eur !== null && aff >= MIN_CLICKS_FOR_EPC ? Math.round(eur / aff) : null,
      rpmEurCents: eur !== null && pageviews >= MIN_PAGEVIEWS_FOR_RPM ? Math.round((eur / pageviews) * 1000) : null,
    };
  });
  byPageType.sort((a, b) => b.clicks - a.clicks || b.pageviews - a.pageviews);

  const noProgramme = await queryRows<{ tool_id: string; name: string; clicks: string }>(
    db,
    sql`SELECT o.tool_id::text AS tool_id, t.name, count(*)::text AS clicks FROM outbound_clicks o JOIN tools t ON t.id = o.tool_id
        WHERE o.ts >= ${iso(p.start)}::timestamptz AND o.ts < ${iso(p.end)}::timestamptz
          AND NOT EXISTS (SELECT 1 FROM affiliate_links l WHERE l.tool_id = o.tool_id AND l.active)
        GROUP BY o.tool_id, t.name ORDER BY count(*) DESC LIMIT 10`,
  );
  const broken = await queryRows<{ id: string; tool_id: string; name: string; last_status: number | null }>(
    db,
    sql`SELECT l.id::text AS id, l.tool_id::text AS tool_id, t.name, l.last_status FROM affiliate_links l JOIN tools t ON t.id = l.tool_id
        WHERE l.active AND ((l.last_status IS NULL AND l.last_checked_at IS NOT NULL) OR l.last_status >= 400)`,
  );
  return {
    clicks: counted(cur.total, before.total),
    affiliateClicks: counted(cur.aff, before.aff),
    clicksWithoutProgramme: noProgramme.map((r) => ({ toolId: r.tool_id, name: r.name, clicks: n(r.clicks) })),
    byPageType,
    brokenAffiliateLinks: broken.map((r) => ({ linkId: r.id, toolId: r.tool_id, name: r.name, status: r.last_status })),
  };
}

/* ───────────────────────────── Catalog & data ───────────────────────────── */

export interface CatalogMetrics {
  toolsPublished: number;
  newToolsPublished: { id: string; name: string; slug: string }[];
  candidates: Record<'new' | 'verifying' | 'verified' | 'rejected' | 'promoted' | 'duplicate', number>;
  quarantined: number;
  freshness: Record<'fresh' | 'aging' | 'stale' | 'unknown', number>;
  plans: { total: number; verified: number };
  openPendingChanges: number;
  changes: { kind: string; n: number }[];
  topChanges: { id: string; toolName: string | null; toolSlug: string | null; kind: string; title: Record<string, string>; sourceUrl: string | null; detectedAt: string; significance: number }[];
  websiteDown: { name: string; slug: string; since: string | null }[];
}

export async function catalogMetrics(db: Database, p: Period, now: Date): Promise<CatalogMetrics> {
  const [counts] = await queryRows<{ published: string; quarantined: string }>(
    db,
    sql`SELECT count(*) FILTER (WHERE published)::text AS published,
               count(*) FILTER (WHERE quarantine_until IS NOT NULL AND quarantine_until > ${iso(now)}::timestamptz)::text AS quarantined
        FROM tools`,
  );
  const fresh = await queryRows<{ freshness: string; n: string }>(db, sql`SELECT freshness, count(*)::text AS n FROM tools WHERE published GROUP BY freshness`);
  const newTools = await queryRows<{ id: string; name: string; slug: string }>(
    db,
    sql`SELECT id::text AS id, name, slug FROM tools WHERE published AND created_at >= ${iso(p.start)}::timestamptz AND created_at < ${iso(p.end)}::timestamptz ORDER BY created_at`,
  );
  const cand = await queryRows<{ status: string; n: string }>(
    db,
    sql`SELECT status, count(*)::text AS n FROM tool_candidates WHERE last_seen_at >= ${iso(p.start)}::timestamptz AND last_seen_at < ${iso(p.end)}::timestamptz GROUP BY status`,
  );
  const [plans] = await queryRows<{ total: string; verified: string }>(
    db,
    sql`SELECT count(*)::text AS total, count(*) FILTER (WHERE pp.status = 'verified')::text AS verified
        FROM pricing_plans pp JOIN tools t ON t.id = pp.tool_id
        WHERE t.published AND pp.valid_to IS NULL AND pp.review_status = 'published'`,
  );
  const [pend] = await queryRows<{ n: string }>(db, sql`SELECT count(*)::text AS n FROM pending_changes WHERE status = 'pending'`);
  const kinds = await queryRows<{ kind: string; n: string }>(
    db,
    sql`SELECT kind, count(*)::text AS n FROM change_events
        WHERE status = 'published' AND detected_at >= ${iso(p.start)}::timestamptz AND detected_at < ${iso(p.end)}::timestamptz
        GROUP BY kind ORDER BY count(*) DESC`,
  );
  const top = await queryRows<{ id: string; name: string | null; slug: string | null; kind: string; title: Record<string, string>; source_url: string | null; detected_at: string; significance: number }>(
    db,
    sql`SELECT e.id::text AS id, t.name, t.slug, e.kind, e.title, e.source_url, e.detected_at::text AS detected_at, e.significance
        FROM change_events e LEFT JOIN tools t ON t.id = e.tool_id
        WHERE e.status = 'published' AND e.detected_at >= ${iso(p.start)}::timestamptz AND e.detected_at < ${iso(p.end)}::timestamptz
          AND e.kind NOT IN ('video', 'buzz')
        ORDER BY e.significance DESC, e.detected_at DESC LIMIT 8`,
  );
  const down = await queryRows<{ name: string; slug: string; since: string | null }>(
    db,
    sql`SELECT name, slug, unreachable_since::text AS since FROM tools WHERE published AND website_status = 'down' ORDER BY unreachable_since`,
  );
  const cands = { new: 0, verifying: 0, verified: 0, rejected: 0, promoted: 0, duplicate: 0 };
  for (const r of cand) if (r.status in cands) cands[r.status as keyof typeof cands] = n(r.n);
  const fr = { fresh: 0, aging: 0, stale: 0, unknown: 0 };
  for (const r of fresh) if (r.freshness in fr) fr[r.freshness as keyof typeof fr] = n(r.n);
  return {
    toolsPublished: n(counts?.published),
    newToolsPublished: newTools,
    candidates: cands,
    quarantined: n(counts?.quarantined),
    freshness: fr,
    plans: { total: n(plans?.total), verified: n(plans?.verified) },
    openPendingChanges: n(pend?.n),
    changes: kinds.map((k) => ({ kind: k.kind, n: n(k.n) })),
    topChanges: top.map((r) => ({
      id: r.id,
      toolName: r.name,
      toolSlug: r.slug,
      kind: r.kind,
      title: r.title,
      sourceUrl: r.source_url,
      detectedAt: r.detected_at,
      significance: r.significance,
    })),
    websiteDown: down,
  };
}

/* ───────────────────────────── Automation ───────────────────────────── */

export interface AutomationMetrics {
  /** Automated changes (decision ≠ info), grouped. */
  actions: { action: string; decision: string; n: number }[];
  totalActions: number;
  observations: number;
  reverted: number;
  inbox: { autoResolved: number; defaulted: number; expired: number; approved: number; rejected: number; created: number };
  runs: { agent: string; success: number; partial: number; failed: number; skipped: number; lastStatus: string | null; lastRunAt: string | null }[];
}

export async function automationMetrics(db: Database, p: Period): Promise<AutomationMetrics> {
  const acts = await queryRows<{ action: string; decision: string; n: string; reverted: string }>(
    db,
    sql`SELECT action, decision, count(*)::text AS n, count(reverted_at)::text AS reverted FROM agent_actions
        WHERE created_at >= ${iso(p.start)}::timestamptz AND created_at < ${iso(p.end)}::timestamptz GROUP BY action, decision ORDER BY count(*) DESC`,
  );
  const inbox = await queryRows<{ status: string; n: string }>(
    db,
    sql`SELECT status, count(*)::text AS n FROM review_items
        WHERE reviewed_at >= ${iso(p.start)}::timestamptz AND reviewed_at < ${iso(p.end)}::timestamptz GROUP BY status`,
  );
  const [created] = await queryRows<{ n: string }>(
    db,
    sql`SELECT count(*)::text AS n FROM review_items WHERE created_at >= ${iso(p.start)}::timestamptz AND created_at < ${iso(p.end)}::timestamptz`,
  );
  const runs = await queryRows<{ agent: string; success: string; partial: string; failed: string; skipped: string }>(
    db,
    sql`SELECT agent,
               count(*) FILTER (WHERE status = 'success')::text AS success,
               count(*) FILTER (WHERE status = 'partial')::text AS partial,
               count(*) FILTER (WHERE status = 'failed')::text AS failed,
               count(*) FILTER (WHERE status = 'skipped')::text AS skipped
        FROM agent_runs WHERE started_at >= ${iso(p.start)}::timestamptz AND started_at < ${iso(p.end)}::timestamptz GROUP BY agent ORDER BY agent`,
  );
  const last = await queryRows<{ agent: string; status: string; started_at: string }>(
    db,
    sql`SELECT DISTINCT ON (agent) agent, status, started_at::text AS started_at FROM agent_runs ORDER BY agent, started_at DESC`,
  );
  const real = acts.filter((a) => a.decision !== 'info');
  const count = (s: string) => n(inbox.find((r) => r.status === s)?.n);
  const agents = new Set([...runs.map((r) => r.agent), ...last.map((r) => r.agent)]);
  return {
    actions: real.map((a) => ({ action: a.action, decision: a.decision, n: n(a.n) })),
    totalActions: real.reduce((s, a) => s + n(a.n), 0),
    observations: acts.filter((a) => a.decision === 'info').reduce((s, a) => s + n(a.n), 0),
    reverted: acts.reduce((s, a) => s + n(a.reverted), 0),
    inbox: {
      autoResolved: count('auto_resolved'),
      defaulted: count('defaulted'),
      expired: count('expired'),
      approved: count('approved'),
      rejected: count('rejected'),
      created: n(created?.n),
    },
    runs: [...agents].sort().map((agent) => {
      const r = runs.find((x) => x.agent === agent);
      const l = last.find((x) => x.agent === agent);
      return {
        agent,
        success: n(r?.success),
        partial: n(r?.partial),
        failed: n(r?.failed),
        skipped: n(r?.skipped),
        lastStatus: l?.status ?? null,
        lastRunAt: l?.started_at ?? null,
      };
    }),
  };
}

/* ───────────────────────────── Health ───────────────────────────── */

export interface HealthMetrics {
  checks: { key: string; status: string; message: string | null; lastCheckedAt: string; lastOkAt: string | null }[];
  errors: { fingerprint: string; scope: string; agent: string | null; message: string; count: number; lastAt: string }[];
  errorsTotal: number;
  llm: { calls: number; failures: number; costUsd: number; budgetUsd: number };
}

export async function healthMetrics(db: Database, p: Period, dailyBudgetUsd: number): Promise<HealthMetrics> {
  const checks = await queryRows<{ key: string; status: string; message: string | null; last_checked_at: string; last_ok_at: string | null }>(
    db,
    sql`SELECT key, status, message, last_checked_at::text AS last_checked_at, last_ok_at::text AS last_ok_at FROM health_checks ORDER BY key`,
  );
  const errors = await queryRows<{ fingerprint: string; scope: string; agent: string | null; message: string; count: string; last_at: string }>(
    db,
    sql`SELECT fingerprint, max(scope) AS scope, max(agent) AS agent, max(message) AS message, sum(count)::text AS count, max(at)::text AS last_at
        FROM error_log WHERE at >= ${iso(p.start)}::timestamptz AND at < ${iso(p.end)}::timestamptz
        GROUP BY fingerprint ORDER BY sum(count) DESC LIMIT 10`,
  );
  const [errTotal] = await queryRows<{ n: string }>(
    db,
    sql`SELECT COALESCE(sum(count), 0)::text AS n FROM error_log WHERE at >= ${iso(p.start)}::timestamptz AND at < ${iso(p.end)}::timestamptz`,
  );
  const [llm] = await queryRows<{ calls: string; failures: string; micros: string }>(
    db,
    sql`SELECT COALESCE(sum(calls), 0)::text AS calls, COALESCE(sum(failures), 0)::text AS failures, COALESCE(sum(est_cost_micros), 0)::text AS micros
        FROM llm_usage WHERE day >= ${iso(p.start).slice(0, 10)}::date AND day < ${iso(p.end).slice(0, 10)}::date`,
  );
  const days = Math.max(1, Math.round((p.end.getTime() - p.start.getTime()) / 86_400_000));
  return {
    checks: checks.map((c) => ({ key: c.key, status: c.status, message: c.message, lastCheckedAt: c.last_checked_at, lastOkAt: c.last_ok_at })),
    errors: errors.map((e) => ({ fingerprint: e.fingerprint, scope: e.scope, agent: e.agent, message: e.message, count: n(e.count), lastAt: e.last_at })),
    errorsTotal: n(errTotal?.n),
    llm: { calls: n(llm?.calls), failures: n(llm?.failures), costUsd: n(llm?.micros) / 1e6, budgetUsd: dailyBudgetUsd * days },
  };
}

/* ───────────────────────────── Inbox & audience ───────────────────────────── */

export interface InboxItemView {
  id: string;
  kind: string;
  severity: 'p1' | 'p2' | 'p3';
  category: string;
  title: string;
  reasonCode: string | null;
  defaultAction: string | null;
  dueAt: string | null;
  createdAt: string;
  groupCount: number;
  priority: number;
  impact: { pages?: number; visits30d?: number; evCentsPerMonth?: number; evBasis?: string } | null;
  toolId: string | null;
}

export interface InboxMetrics {
  /** "Needs your attention" = open P1 + P2 (not snoozed). */
  attention: InboxItemView[];
  p3Open: number;
  snoozed: number;
  p2ThisWeek: number;
  budget: number;
  opportunities: InboxItemView[];
}

type ItemRow = {
  id: string;
  kind: string;
  severity: 'p1' | 'p2' | 'p3';
  category: string;
  title: string;
  reason_code: string | null;
  default_action: string | null;
  due_at: string | null;
  created_at: string;
  group_count: number;
  priority: number;
  impact: InboxItemView['impact'];
  tool_id: string | null;
};

const itemView = (r: ItemRow): InboxItemView => ({
  id: r.id,
  kind: r.kind,
  severity: r.severity,
  category: r.category,
  title: r.title,
  reasonCode: r.reason_code,
  defaultAction: r.default_action,
  dueAt: r.due_at,
  createdAt: r.created_at,
  groupCount: r.group_count,
  priority: r.priority,
  impact: r.impact,
  toolId: r.tool_id,
});

export async function inboxMetrics(db: Database, now: Date, budget: number): Promise<InboxMetrics> {
  const select = sql`SELECT id::text AS id, kind, severity, category, title, reason_code, default_action, due_at::text AS due_at,
                            created_at::text AS created_at, group_count, priority, impact, tool_id::text AS tool_id FROM review_items`;
  const open = sql`status = 'pending' AND (snoozed_until IS NULL OR snoozed_until <= ${iso(now)}::timestamptz)`;
  const attention = await queryRows<ItemRow>(
    db,
    sql`${select} WHERE ${open} AND severity IN ('p1', 'p2') AND kind <> 'opportunity'
        ORDER BY severity, due_at NULLS LAST, priority DESC, created_at LIMIT 50`,
  );
  const opportunities = await queryRows<ItemRow>(
    db,
    sql`${select} WHERE ${open} AND kind = 'opportunity'
        ORDER BY COALESCE((impact->>'evCentsPerMonth')::int, 0) DESC, priority DESC LIMIT 20`,
  );
  const [c] = await queryRows<{ p3: string; snoozed: string; p2week: string }>(
    db,
    sql`SELECT count(*) FILTER (WHERE ${open} AND severity = 'p3' AND kind <> 'opportunity')::text AS p3,
               count(*) FILTER (WHERE status = 'pending' AND snoozed_until > ${iso(now)}::timestamptz)::text AS snoozed,
               count(*) FILTER (WHERE severity = 'p2' AND created_at >= ${iso(new Date(now.getTime() - 7 * 86_400_000))}::timestamptz)::text AS p2week
        FROM review_items`,
  );
  return {
    attention: attention.map(itemView),
    p3Open: n(c?.p3),
    snoozed: n(c?.snoozed),
    p2ThisWeek: n(c?.p2week),
    budget,
    opportunities: opportunities.map(itemView),
  };
}

export interface AudienceMetrics {
  subscribers: { confirmed: number; newConfirmed: number; pending: number; unsubscribed: number; newsletter: number };
  stacksSaved: Counted;
  watches: number;
}

export async function audienceMetrics(db: Database, p: Period): Promise<AudienceMetrics> {
  const prev = previousPeriod(p);
  const [s] = await queryRows<{ confirmed: string; new_confirmed: string; pending: string; unsubscribed: string; newsletter: string }>(
    db,
    sql`SELECT count(*) FILTER (WHERE status = 'confirmed')::text AS confirmed,
               count(*) FILTER (WHERE status = 'confirmed' AND confirmed_at >= ${iso(p.start)}::timestamptz AND confirmed_at < ${iso(p.end)}::timestamptz)::text AS new_confirmed,
               count(*) FILTER (WHERE status = 'pending')::text AS pending,
               count(*) FILTER (WHERE status = 'unsubscribed' AND unsubscribed_at >= ${iso(p.start)}::timestamptz AND unsubscribed_at < ${iso(p.end)}::timestamptz)::text AS unsubscribed,
               count(*) FILTER (WHERE status = 'confirmed' AND newsletter)::text AS newsletter
        FROM subscribers`,
  );
  const stackCount = async (q: Period) =>
    n((await queryRows<{ n: string }>(db, sql`SELECT count(*)::text AS n FROM stacks WHERE created_at >= ${iso(q.start)}::timestamptz AND created_at < ${iso(q.end)}::timestamptz`))[0]?.n);
  const [w] = await queryRows<{ n: string }>(db, sql`SELECT count(*)::text AS n FROM watches`);
  return {
    subscribers: {
      confirmed: n(s?.confirmed),
      newConfirmed: n(s?.new_confirmed),
      pending: n(s?.pending),
      unsubscribed: n(s?.unsubscribed),
      newsletter: n(s?.newsletter),
    },
    stacksSaved: counted(await stackCount(p), await stackCount(prev)),
    watches: n(w?.n),
  };
}
