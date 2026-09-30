/**
 * Owner dashboard (docs/strategy/12 §6): "Needs your attention" first — the
 * default state is "Nothing to do" — then what the system handled itself,
 * business KPIs with source and "data through", health and opportunities.
 * Every number comes from the fixed queries in lib/reports/metrics.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { reports } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { flashMessage } from '@/lib/admin/flash';
import { actionLabel, dependencyName, ifNothing, kindLabel, reasonText } from '@/lib/admin/labels';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/i18n/formatters';
import { localized } from '@/lib/catalog/events';
import { tzParts, zoned } from '@/agents/schedule';
import {
  automationMetrics,
  catalogMetrics,
  commerceMetrics,
  healthMetrics,
  inboxMetrics,
  revenueMetrics,
  trafficMetrics,
  type Counted,
} from '@/lib/reports/metrics';
import { Badge, Card, Empty, Flash, Meter, PageHeader, severityTone, Stat, statusTone, Table, TextLink } from '@/components/admin/ui';
import { nowDate } from '@/lib/time';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.overview.title') };
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, t, locale, settings } = await adminContext();
  const sp = await searchParams;
  const now = nowDate();
  const days = (n: number) => ({ start: new Date(now.getTime() - n * 86_400_000), end: now });
  const tz = tzParts(now, settings.report.timezone);
  const monthStart = zoned(tz.y, tz.mo, 1, 0, 0, settings.report.timezone);

  const [inbox, handled, month, traffic, commerce, leads30, health, catalog, [latest]] = await Promise.all([
    inboxMetrics(db, now, settings.autonomy.escalationBudgetPerWeek),
    automationMetrics(db, days(7)),
    revenueMetrics(db, { start: monthStart, end: now }, settings.revenue.staleImportDays),
    trafficMetrics(db, days(30)),
    commerceMetrics(db, days(30)),
    revenueMetrics(db, days(30), settings.revenue.staleImportDays),
    healthMetrics(db, days(7), settings.llm.dailyBudgetUsd),
    catalogMetrics(db, days(7), now),
    db.select().from(reports).where(eq(reports.kind, 'weekly')).orderBy(desc(reports.periodStart)).limit(1),
  ]);

  const flash = flashMessage(sp, t);
  const eur = (cents: number) => formatMoney(cents, 'EUR', locale);
  const vs = (c: Counted) => (c.previous === null ? null : `${t('admin.overview.vs', { value: formatNumber(c.previous, locale) })} · ${t(`admin.trend.${c.trend}`)}`);
  const handledCount = handled.totalActions + handled.inbox.autoResolved + handled.inbox.defaulted + handled.inbox.expired;

  // Revenue tile: known total with its limits, or "—" with the reason (unknown ≠ 0).
  const configured = month.streams.filter((s) => s.status !== 'not_configured' && s.status !== 'none');
  const affiliate = month.streams.find((s) => s.stream === 'affiliate')!;
  let revenueValue: string = t('admin.common.dash');
  let revenueSub: string = t('admin.overview.revenueNone');
  if (configured.length) {
    if (month.totalEurCents === null) {
      revenueSub = t('admin.revenue.noFx');
    } else {
      revenueValue = month.lowerBound ? t('admin.revenue.atLeast', { amount: eur(month.totalEurCents) }) : eur(month.totalEurCents);
      revenueSub = configured.map((s) => `${t(`admin.revenue.stream.${s.stream}`)} ${s.eurCents !== null ? eur(s.eurCents) : t('admin.common.dash')}`).join(' · ');
    }
  }
  const goal = settings.revenue.goalCentsPerMonth;
  const revenueFoot =
    configured.length && month.totalEurCents !== null
      ? t('admin.overview.goal', { amount: eur(goal), pct: Math.round((month.totalEurCents / Math.max(1, goal)) * 100) })
      : t('admin.overview.goalUnknown', { amount: eur(goal) });
  const affiliateFoot =
    affiliate.status === 'not_configured'
      ? t('admin.revenue.reason.no_approved_programme')
      : affiliate.through
        ? `${t('admin.revenue.stream.affiliate')}: ${t('admin.revenue.through', { date: formatDate(affiliate.through, locale) })}`
        : affiliate.reason
          ? t(`admin.revenue.reason.${affiliate.reason}`)
          : '';

  const failingChecks = health.checks.filter((c) => c.status === 'fail');
  const agentsFailed = handled.runs.filter((r) => r.lastStatus === 'failed');

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('admin.overview.title')} sub={formatDateTime(now, locale)} />
      <Flash message={flash?.text ?? null} tone={flash?.tone} />

      {/* 1. Needs your attention (default state: nothing to do) */}
      <Card
        id="attention"
        title={t('admin.overview.attention')}
        className={inbox.attention.length ? 'border-signal' : ''}
        action={inbox.attention.length ? <Badge tone="signal">{t('admin.overview.attentionCount', { count: inbox.attention.length })}</Badge> : undefined}
      >
        {inbox.attention.length === 0 ? (
          <div className="flex flex-wrap items-center gap-4">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--verified)_15%,transparent)] text-xl text-verified">
              ✓
            </span>
            <div>
              <p className="text-lg font-bold">{t('admin.overview.nothingToDo')}</p>
              <p className="text-sm text-ink-2">
                {t('admin.overview.nothingToDoSub', { count: handledCount })}{' '}
                <TextLink href="/admin/operations">{t('admin.overview.viewActions')}</TextLink>
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {inbox.attention.slice(0, 6).map((i) => (
              <li key={i.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 md:flex-row md:items-start md:justify-between md:gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={severityTone(i.severity)}>{t(`admin.severity.${i.severity}`)}</Badge>
                    <span className="eyebrow">{kindLabel(t, i.kind)}</span>
                    {i.groupCount > 1 && <Badge>{t('admin.inbox.group', { count: i.groupCount })}</Badge>}
                  </div>
                  <p className="mt-1 font-semibold">{i.title}</p>
                  <p className="text-sm text-ink-2">{reasonText(t, i.reasonCode, '')}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {t('admin.inbox.ifNothing')}: {ifNothing(t, locale, i.defaultAction, i.dueAt)}
                  </p>
                </div>
                <Link href={`/admin/inbox/${i.id}`} className="btn btn-sm shrink-0 self-start">
                  {t('admin.common.open')}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {inbox.attention.length > 6 && (
          <p className="mt-3 text-sm">
            <TextLink href="/admin/inbox">{t('admin.common.showAll')}</TextLink>
          </p>
        )}
        <p className="mt-4 text-xs text-ink-3">
          <TextLink href="/admin/inbox?tab=queue">{t('admin.overview.p3Queue', { count: inbox.p3Open })}</TextLink>
        </p>
        {inbox.p2ThisWeek > inbox.budget && <p className="notice notice-warning mt-3 text-sm">{t('admin.overview.overBudget', { count: inbox.p2ThisWeek, budget: inbox.budget })}</p>}
      </Card>

      {/* 2. KPIs: source and "data through" on every tile */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('admin.overview.revenue')} value={revenueValue} sub={revenueSub} foot={`${revenueFoot}${affiliateFoot ? ` · ${affiliateFoot}` : ''}`} />
        <Stat
          label={t('admin.overview.traffic')}
          value={traffic.hasData ? formatNumber(traffic.visits.value, locale) : t('admin.common.dash')}
          sub={traffic.hasData ? `${t('admin.metric.organic')} ${formatNumber(traffic.channels.organic.value, locale)} · ${t('admin.metric.ai')} ${formatNumber(traffic.channels.ai.value, locale)}` : t('admin.overview.noTraffic')}
          foot={traffic.hasData ? `${vs(traffic.visits) ?? ''} · ${t('admin.overview.visitsNote')}` : undefined}
        />
        <Stat
          label={t('admin.overview.clicks')}
          value={formatNumber(commerce.clicks.value, locale)}
          sub={`${t('admin.metric.affiliateClicks')} ${formatNumber(commerce.affiliateClicks.value, locale)} · ${t('admin.metric.matches')} ${formatNumber(traffic.matches.value, locale)}`}
          foot={vs(commerce.clicks) ?? undefined}
        />
        <Stat
          label={t('admin.overview.leads')}
          value={formatNumber(leads30.leads.created.value, locale)}
          sub={`${formatNumber(leads30.leads.qualified, locale)} ${t('admin.metric.qualified')} · ${formatNumber(leads30.leads.won, locale)} ${t('admin.metric.won')}`}
          foot={vs(leads30.leads.created) ?? undefined}
        />
      </div>

      {/* 3. What the system did, and whether it is healthy */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card id="handled" title={t('admin.overview.handled')} action={<TextLink href="/admin/operations">{t('admin.common.details')}</TextLink>}>
          {handledCount === 0 && handled.observations === 0 ? (
            <Empty>{t('admin.overview.handledEmpty')}</Empty>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {Object.entries(
                handled.actions.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.action]: (acc[a.action] ?? 0) + a.n }), {}),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([action, n]) => (
                  <li key={action} className="flex justify-between gap-3">
                    <span>{actionLabel(t, action)}</span>
                    <span className="tabular font-semibold">{formatNumber(n, locale)}</span>
                  </li>
                ))}
              <li className="flex justify-between gap-3 border-t border-line pt-1.5">
                <span>{t('admin.overview.resolvedAuto')}</span>
                <span className="tabular font-semibold">{formatNumber(handled.inbox.autoResolved + handled.inbox.expired, locale)}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>{t('admin.overview.defaulted')}</span>
                <span className="tabular font-semibold">{formatNumber(handled.inbox.defaulted, locale)}</span>
              </li>
              <li className="flex justify-between gap-3 text-ink-3">
                <span>{t('admin.overview.reverts')}</span>
                <span className="tabular">{formatNumber(handled.reverted, locale)}</span>
              </li>
              <li className="flex justify-between gap-3 text-ink-3">
                <span>{t('admin.overview.observations')}</span>
                <span className="tabular">{formatNumber(handled.observations, locale)}</span>
              </li>
            </ul>
          )}
        </Card>

        <Card id="health" title={t('admin.overview.health')} action={<TextLink href="/admin/automation#dependencies">{t('admin.common.details')}</TextLink>}>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            {health.checks.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-2">
                <span className="truncate" title={c.message ?? ''}>
                  {dependencyName(t, c.key)}
                </span>
                <Badge tone={statusTone(c.status)}>{t(`admin.automation.depStatus.${c.status}`)}</Badge>
              </li>
            ))}
          </ul>
          {!health.checks.length && <Empty>{t('admin.common.noData')}</Empty>}
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-sm">
            <div>
              <dt className="eyebrow">{t('admin.overview.healthAgents')}</dt>
              <dd className={`tabular font-semibold ${agentsFailed.length ? 'text-danger' : ''}`}>
                {handled.runs.length - agentsFailed.length}/{handled.runs.length}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{t('admin.overview.healthErrors')}</dt>
              <dd className="tabular font-semibold">{formatNumber(health.errorsTotal, locale)}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t('admin.overview.healthLlm')}</dt>
              <dd className="tabular font-semibold">{t('admin.overview.llmSpend', { spent: health.llm.costUsd.toFixed(2), budget: health.llm.budgetUsd.toFixed(0) })}</dd>
            </div>
          </dl>
          {failingChecks.length > 0 && (
            <p className="mt-3 text-xs text-danger">{failingChecks.map((c) => `${dependencyName(t, c.key)}: ${c.message ?? ''}`).join(' · ')}</p>
          )}
        </Card>
      </div>

      {/* 4. Changes, candidates, opportunities */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card id="changes" title={t('admin.overview.changes')}>
          {catalog.topChanges.length === 0 ? (
            <Empty>{t('admin.common.empty')}</Empty>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {catalog.topChanges.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <span className="font-semibold">{c.toolName ?? ''}</span> {localized(c.title, locale) ?? ''}
                  {c.sourceUrl && (
                    <>
                      {' '}
                      <TextLink href={c.sourceUrl} external>
                        {t('admin.common.source')}
                      </TextLink>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs text-ink-3">
            <div>
              <dt>{t('admin.metric.verifiedPrices')}</dt>
              <dd className="tabular text-sm font-semibold text-ink">
                {formatNumber(catalog.plans.verified, locale)}/{formatNumber(catalog.plans.total, locale)}
              </dd>
              <Meter value={catalog.plans.total ? catalog.plans.verified / catalog.plans.total : 0} label={t('admin.metric.verifiedPrices')} />
            </div>
            <div>
              <dt>{t('admin.metric.stale')}</dt>
              <dd className="tabular text-sm font-semibold text-ink">
                {formatNumber(catalog.freshness.stale, locale)} · {t('admin.metric.unreachable')} {formatNumber(catalog.websiteDown.length, locale)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card id="candidates" title={t('admin.overview.candidates')} action={<TextLink href="/admin/candidates">{t('admin.common.details')}</TextLink>}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {(['verified', 'new', 'rejected', 'duplicate'] as const).map((k) => (
              <div key={k}>
                <dt className="eyebrow">{t(`admin.candidates.status.${k}`)}</dt>
                <dd className="tabular text-xl font-bold">{formatNumber(catalog.candidates[k], locale)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-3">
            {t('admin.metric.tools')}: {formatNumber(catalog.toolsPublished, locale)}
          </p>
        </Card>

        <Card id="opportunities" title={t('admin.overview.opportunities')}>
          {inbox.opportunities.length === 0 ? (
            <Empty>{t('admin.common.empty')}</Empty>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {inbox.opportunities.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-2">
                  <TextLink href={`/admin/inbox/${o.id}`}>{o.title}</TextLink>
                  {o.impact?.evCentsPerMonth ? <Badge tone="info">{t('admin.common.perMonth', { amount: eur(o.impact.evCentsPerMonth) })}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 5. Top pages and tools */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card id="top-pages" title={t('admin.overview.topPages')}>
          {traffic.topPages.length === 0 ? (
            <Empty>{t('admin.overview.noTraffic')}</Empty>
          ) : (
            <Table head={['', t('admin.metric.pageviews'), t('admin.metric.clicks')]}>
              {traffic.topPages.map((p) => (
                <tr key={p.path}>
                  <td className="max-w-[18rem] truncate mono text-xs">
                    <TextLink href={p.path} external>
                      {p.path}
                    </TextLink>
                  </td>
                  <td className="tabular">{formatNumber(p.pageviews, locale)}</td>
                  <td className="tabular">{formatNumber(p.clicks, locale)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card id="top-tools" title={t('admin.overview.topTools')}>
          {traffic.topTools.length === 0 ? (
            <Empty>{t('admin.overview.noTraffic')}</Empty>
          ) : (
            <Table head={[t('admin.common.tool'), t('admin.metric.pageviews'), t('admin.metric.clicks')]}>
              {traffic.topTools.map((x) => (
                <tr key={x.toolId}>
                  <td>
                    <TextLink href={`/admin/tools/${x.toolId}`}>{x.name}</TextLink>
                  </td>
                  <td className="tabular">{formatNumber(x.pageviews, locale)}</td>
                  <td className="tabular">{formatNumber(x.clicks, locale)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {/* 6. Weekly report */}
      <Card id="report" title={t('admin.overview.report')} className="mt-6">
        {latest ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{(latest.summary as Record<string, string>)[locale] ?? ''}</p>
            <Link href={`/admin/reports/${latest.id}`} className="btn btn-sm btn-ghost">
              {t('admin.reports.week', { date: formatDate(latest.periodStart, locale) })}
            </Link>
          </div>
        ) : (
          <Empty>{t('admin.overview.noReport')}</Empty>
        )}
      </Card>
    </div>
  );
}
