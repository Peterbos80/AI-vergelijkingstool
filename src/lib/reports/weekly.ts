/**
 * Weekly autonomous report (docs/strategy/12 §7). Built from the fixed
 * metric queries; the summary is a template filled with numbers from the
 * data itself (no model may introduce new numbers).
 */
import { sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';
import { enabledLocales } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { loadCatalog } from '@/lib/catalog/load';
import { emailEnabled } from '@/lib/env';
import { readDataVersion } from '@/lib/settings';
import type { Settings } from '@/lib/settings/defaults';
import { indexableCounts, sitemapEntries } from '@/lib/sitemap';
import { tzParts, zoned } from '@/agents/schedule';
import {
  audienceMetrics,
  automationMetrics,
  catalogMetrics,
  commerceMetrics,
  healthMetrics,
  inboxMetrics,
  revenueMetrics,
  trafficMetrics,
  type AudienceMetrics,
  type AutomationMetrics,
  type CatalogMetrics,
  type CommerceMetrics,
  type HealthMetrics,
  type InboxItemView,
  type Period,
  type RevenueMetrics,
  type TrafficMetrics,
} from './metrics';

export type OwnerLocale = 'nl' | 'en';

export interface Recommendation {
  kind: 'inbox' | 'dependency' | 'opportunity';
  /** Inbox item id or dependency key. */
  ref: string;
  /** Plain technical label (the UI renders localized text from kind/ref). */
  label: string;
  estMinutes: number;
  evCentsPerMonth?: number;
  dueAt?: string | null;
  score: number;
}

export type Unmeasured = 'search_console' | 'revenue_import' | 'affiliate_none' | 'backups' | 'email' | 'fx' | 'heartbeat' | 'outbound_network' | 'traffic_none';

export interface WeeklyReportData {
  version: 1;
  period: { start: string; end: string };
  generatedAt: string;
  /** Set when the system started collecting data inside this period. */
  coverageStart: string | null;
  traffic: TrafficMetrics;
  revenue: RevenueMetrics;
  commerce: CommerceMetrics;
  catalog: CatalogMetrics;
  seo: ReturnType<typeof indexableCounts> | null;
  audience: AudienceMetrics;
  automation: AutomationMetrics;
  health: HealthMetrics;
  inbox: { attention: InboxItemView[]; p3Open: number; p2ThisWeek: number; budget: number; overBudget: boolean };
  opportunities: InboxItemView[];
  recommendations: Recommendation[];
  unmeasured: Unmeasured[];
}

/** Estimated owner minutes per dependency action (docs/strategy/12 §10). */
const DEPENDENCY_MINUTES: Record<string, number> = {
  legal: 90,
  owner_account: 5,
  heartbeat: 15,
  email: 60,
  revenue_import: 15,
  backups: 30,
  agents: 20,
  database: 30,
  fx: 10,
  outbound_network: 20,
};

/**
 * The most recent complete reporting week: it ends on `weekday` 00:00
 * (Europe/Amsterdam) and becomes due `hour` hours later.
 */
export function reportPeriod(now: Date, cfg: Settings['report']): { period: Period; dueAt: Date } {
  const tz = cfg.timezone;
  /** Midnight of the report weekday at or before instant d. */
  const weekStart = (d: Date) => {
    const p = tzParts(d, tz);
    return zoned(p.y, p.mo, p.day - ((p.wd - cfg.weekday + 7) % 7), 0, 0, tz);
  };
  let end = weekStart(now);
  let due = new Date(end.getTime() + cfg.hour * 3600_000);
  if (now < due) {
    end = weekStart(new Date(end.getTime() - 3 * 86_400_000));
    due = new Date(end.getTime() + cfg.hour * 3600_000);
  }
  const start = weekStart(new Date(end.getTime() - 3 * 86_400_000));
  return { period: { start, end }, dueAt: due };
}

/** Owner actions worth doing this week: max 3, by expected value × urgency (§7.2.13). */
export function recommend(
  now: Date,
  inbox: InboxItemView[],
  opportunities: InboxItemView[],
  checks: HealthMetrics['checks'],
  minEvCents: number,
): Recommendation[] {
  const out: Recommendation[] = [];
  for (const i of inbox) {
    const hoursLeft = i.dueAt ? (new Date(i.dueAt).getTime() - now.getTime()) / 3600_000 : null;
    const score = i.severity === 'p1' ? 10_000 + i.priority : hoursLeft !== null && hoursLeft < 72 ? 5000 + Math.round(72 - Math.max(0, hoursLeft)) : 1500 + i.priority;
    out.push({ kind: 'inbox', ref: i.id, label: i.title, estMinutes: i.severity === 'p1' ? 20 : 5, dueAt: i.dueAt, score });
  }
  for (const o of opportunities) {
    const ev = o.impact?.evCentsPerMonth ?? 0;
    if (ev < minEvCents) continue;
    out.push({ kind: 'opportunity', ref: o.id, label: o.title, estMinutes: 15, evCentsPerMonth: ev, score: 1000 + Math.round(ev / 10) });
  }
  const weight: Record<string, number> = { legal: 4000, owner_account: 4000, database: 9000, agents: 6000, revenue_import: 3000, heartbeat: 2500, email: 2000, backups: 1200 };
  for (const c of checks) {
    const w = weight[c.key];
    if (!w) continue;
    const bad = c.status === 'fail' || (c.status === 'warn' && c.key === 'revenue_import') || (c.status === 'not_configured' && ['heartbeat', 'email', 'backups'].includes(c.key));
    if (!bad) continue;
    out.push({ kind: 'dependency', ref: c.key, label: c.message ?? c.key, estMinutes: DEPENDENCY_MINUTES[c.key] ?? 15, score: w });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function unmeasured(checks: HealthMetrics['checks'], traffic: TrafficMetrics, revenue: RevenueMetrics): Unmeasured[] {
  const status = (k: string) => checks.find((c) => c.key === k)?.status;
  const out: Unmeasured[] = [];
  if (!traffic.hasData) out.push('traffic_none');
  if (status('search_console') !== 'ok') out.push('search_console');
  const aff = revenue.streams.find((s) => s.stream === 'affiliate');
  if (aff?.status === 'not_configured') out.push('affiliate_none');
  else if (aff && aff.status !== 'ok') out.push('revenue_import');
  if (status('backups') !== 'ok') out.push('backups');
  if (status('email') === 'not_configured') out.push('email');
  if (status('fx') !== 'ok') out.push('fx');
  if (status('heartbeat') !== 'ok') out.push('heartbeat');
  if (status('outbound_network') === 'warn') out.push('outbound_network');
  return out;
}

export async function buildWeeklyReport(db: Database, period: Period, settings: Settings, now: Date): Promise<WeeklyReportData> {
  const [first] = await queryRows<{ at: string | null }>(db, sql`SELECT min(started_at)::text AS at FROM agent_runs`);
  const coverageStart = first?.at && new Date(first.at) > period.start ? first.at : null;
  const traffic = await trafficMetrics(db, period);
  const revenue = await revenueMetrics(db, period, settings.revenue.staleImportDays);
  const commerce = await commerceMetrics(db, period);
  const catalog = await catalogMetrics(db, period, now);
  const audience = await audienceMetrics(db, period);
  const automation = await automationMetrics(db, period);
  const health = await healthMetrics(db, period, settings.llm.dailyBudgetUsd);
  const inbox = await inboxMetrics(db, now, settings.autonomy.escalationBudgetPerWeek);
  let seo: WeeklyReportData['seo'] = null;
  try {
    const cat = await loadCatalog(db, await readDataVersion(db), now);
    seo = indexableCounts(sitemapEntries(cat, enabledLocales(), { newsletter: emailEnabled() }));
  } catch {
    seo = null;
  }
  return {
    version: 1,
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    generatedAt: now.toISOString(),
    coverageStart,
    traffic,
    revenue,
    commerce,
    catalog,
    seo,
    audience,
    automation,
    health,
    inbox: {
      attention: inbox.attention,
      p3Open: inbox.p3Open,
      p2ThisWeek: inbox.p2ThisWeek,
      budget: inbox.budget,
      overBudget: inbox.p2ThisWeek > inbox.budget,
    },
    opportunities: inbox.opportunities.slice(0, 5),
    recommendations: recommend(now, inbox.attention, inbox.opportunities, health.checks, settings.autonomy.opportunityMinEvCents),
    unmeasured: unmeasured(health.checks, traffic, revenue),
  };
}

/* ───────────────────────────── Text ───────────────────────────── */

const INTL: Record<OwnerLocale, string> = { nl: 'nl-NL', en: 'en-GB' };

export function formatEur(cents: number, locale: OwnerLocale): string {
  return new Intl.NumberFormat(INTL[locale], { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function formatDay(isoString: string, locale: OwnerLocale): string {
  return new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(isoString));
}

/** Three sentences: what went well, what needs attention, what the system did itself (§7.2.1). */
export function summarize(d: WeeklyReportData, locale: OwnerLocale): string {
  const t = getT(locale);
  const priceChecks = d.automation.actions.filter((a) => a.action === 'plan_verified').reduce((s, a) => s + a.n, 0);
  const published = d.automation.actions.filter((a) => a.action === 'price_published' || a.action === 'event_published').reduce((s, a) => s + a.n, 0);
  const handled = d.automation.inbox.autoResolved + d.automation.inbox.defaulted + d.automation.inbox.expired;

  let good: string;
  if (d.traffic.visits.trend === 'up') good = t('admin.report.summary.goodTraffic', { visits: d.traffic.visits.value, previous: d.traffic.visits.previous ?? 0 });
  else if ((d.revenue.totalEurCents ?? 0) > 0) good = t('admin.report.summary.goodRevenue', { amount: formatEur(d.revenue.totalEurCents!, locale) });
  else if (d.catalog.newToolsPublished.length > 0) good = t('admin.report.summary.goodTools', { count: d.catalog.newToolsPublished.length });
  else if (d.catalog.plans.total > 0 && d.catalog.plans.verified / d.catalog.plans.total >= 0.5)
    good = t('admin.report.summary.goodData', { verified: d.catalog.plans.verified, total: d.catalog.plans.total, tools: d.catalog.toolsPublished });
  else good = t('admin.report.summary.statusData', { verified: d.catalog.plans.verified, total: d.catalog.plans.total, tools: d.catalog.toolsPublished });

  const attention = d.inbox.attention.length
    ? t('admin.report.summary.attention', { count: d.inbox.attention.length, p1: d.inbox.attention.filter((i) => i.severity === 'p1').length })
    : t('admin.report.summary.noAttention');

  const did = t('admin.report.summary.did', { actions: d.automation.totalActions, prices: priceChecks, published, handled });
  return `${good} ${attention} ${did}`;
}

export interface RenderedEmail {
  subject: string;
  text: string;
}

/** Plain-text e-mail (deliberately no HTML: robust, private, readable everywhere). */
export function renderReportEmail(d: WeeklyReportData, locale: OwnerLocale, adminUrl: string): RenderedEmail {
  const t = getT(locale);
  const nf = new Intl.NumberFormat(INTL[locale]);
  const lines: string[] = [];
  const range = `${formatDay(d.period.start, locale)} – ${formatDay(new Date(new Date(d.period.end).getTime() - 1).toISOString(), locale)}`;
  const trendLabel = (tr: string) => t(`admin.trend.${tr}`);

  lines.push(t('admin.report.email.heading', { range }), '', summarize(d, locale), '');
  if (d.coverageStart) lines.push(t('admin.report.email.coverage', { date: formatDay(d.coverageStart, locale) }), '');

  lines.push(`■ ${t('admin.report.email.attention')}`);
  if (!d.inbox.attention.length) lines.push(`  ${t('admin.report.email.nothing')}`);
  for (const i of d.inbox.attention.slice(0, 8)) {
    const due = i.dueAt ? ` · ${t('admin.report.email.defaultAt', { date: formatDay(i.dueAt, locale), action: t(`admin.defaultAction.${i.defaultAction ?? 'none'}`) })}` : '';
    lines.push(`  [${i.severity.toUpperCase()}] ${i.title}${due}`);
  }
  lines.push('');

  lines.push(`■ ${t('admin.report.email.numbers')}`);
  lines.push(`  ${t('admin.metric.visits')}: ${nf.format(d.traffic.visits.value)} (${trendLabel(d.traffic.visits.trend)})`);
  lines.push(`  ${t('admin.metric.organic')}: ${nf.format(d.traffic.channels.organic.value)} · ${t('admin.metric.ai')}: ${nf.format(d.traffic.channels.ai.value)}`);
  lines.push(`  ${t('admin.metric.matches')}: ${nf.format(d.traffic.matches.value)} (${trendLabel(d.traffic.matches.trend)})`);
  lines.push(`  ${t('admin.metric.clicks')}: ${nf.format(d.commerce.clicks.value)} · ${t('admin.metric.affiliateClicks')}: ${nf.format(d.commerce.affiliateClicks.value)}`);
  for (const s of d.revenue.streams.filter((x) => x.status !== 'none')) {
    const value =
      s.status === 'not_configured' || s.status === 'unknown'
        ? `— (${t(`admin.revenue.status.${s.status}`)})`
        : `${s.eurCents !== null ? formatEur(s.eurCents, locale) : s.amounts.map((m) => `${(m.cents / 100).toFixed(2)} ${m.currency}`).join(' + ') || formatEur(0, locale)}${s.through ? ` · ${t('admin.revenue.through', { date: formatDay(s.through, locale) })}` : ''}${s.status === 'partial' ? ` · ${t('admin.revenue.status.partial')}` : ''}`;
    lines.push(`  ${t(`admin.revenue.stream.${s.stream}`)}: ${value}`);
  }
  lines.push(`  ${t('admin.metric.leads')}: ${nf.format(d.revenue.leads.created.value)} · ${t('admin.metric.subscribers')}: ${nf.format(d.audience.subscribers.confirmed)}`);
  if (d.seo) lines.push(`  ${t('admin.metric.indexable')}: ${nf.format(d.seo.total)}`);
  lines.push('');

  lines.push(`■ ${t('admin.report.email.handled')}`);
  lines.push(`  ${t('admin.report.email.handledLine', { actions: d.automation.totalActions, resolved: d.automation.inbox.autoResolved, defaulted: d.automation.inbox.defaulted, reverted: d.automation.reverted })}`);
  const failedRuns = d.automation.runs.filter((r) => r.failed > 0);
  if (failedRuns.length) lines.push(`  ${t('admin.report.email.failedRuns', { agents: failedRuns.map((r) => `${r.agent} (${r.failed})`).join(', ') })}`);
  lines.push('');

  if (d.recommendations.length) {
    lines.push(`■ ${t('admin.report.email.recommended')}`);
    for (const r of d.recommendations) {
      const what = r.kind === 'dependency' ? t(`admin.dependency.${r.ref}.action`) : r.label;
      const ev = r.evCentsPerMonth ? ` · ${t('admin.report.email.ev', { amount: formatEur(r.evCentsPerMonth, locale) })}` : '';
      lines.push(`  • ${what} (${t('admin.report.email.minutes', { n: r.estMinutes })}${ev})`);
    }
    lines.push('');
  }

  if (d.unmeasured.length) {
    lines.push(`■ ${t('admin.report.email.unmeasured')}`);
    for (const u of d.unmeasured) lines.push(`  • ${t(`admin.unmeasured.${u}`)}`);
    lines.push('');
  }

  lines.push(t('admin.report.email.footer', { url: adminUrl }));
  return { subject: t('admin.report.email.subject', { range, attention: d.inbox.attention.length }), text: lines.join('\n') };
}
