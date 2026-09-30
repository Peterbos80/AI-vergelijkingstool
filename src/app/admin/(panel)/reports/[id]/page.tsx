/** The weekly report as stored (docs/strategy/12 §7.2): fixed sections, real data only. */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { reports } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { actionLabel, dependencyAction, dependencyName, ifNothing, kindLabel } from '@/lib/admin/labels';
import { formatDate, formatMoney, formatNumber } from '@/i18n/formatters';
import { localized } from '@/lib/catalog/events';
import { CHANNELS, type Counted } from '@/lib/reports/metrics';
import type { WeeklyReportData } from '@/lib/reports/weekly';
import { Badge, Card, Empty, PageHeader, severityTone, statusTone, Table, TextLink } from '@/components/admin/ui';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.reports.title') };
}

export default async function ReportPage({ params }: Props) {
  const { db, t, locale } = await adminContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [r] = await db.select().from(reports).where(eq(reports.id, id));
  if (!r) notFound();
  const d = r.data as unknown as WeeklyReportData;
  const eur = (c: number | null) => (c === null ? t('admin.common.dash') : formatMoney(c, 'EUR', locale));
  const num = (n: number) => formatNumber(n, locale);
  const row = (label: string, c: Counted) => (
    <tr key={label}>
      <td>{label}</td>
      <td className="tabular font-semibold">{num(c.value)}</td>
      <td className="tabular text-ink-3">{c.previous === null ? '—' : num(c.previous)}</td>
      <td className="text-xs text-ink-3">{t(`admin.trend.${c.trend}`)}</td>
    </tr>
  );
  const end = new Date(new Date(d.period.end).getTime() - 1);
  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-2 text-sm">
        <TextLink href="/admin/reports">← {t('admin.reports.title')}</TextLink>
      </p>
      <PageHeader title={`${formatDate(d.period.start, locale)} – ${formatDate(end, locale)}`} sub={r.emailedAt ? t('admin.reports.emailed', { date: formatDate(r.emailedAt, locale) }) : t('admin.reports.notEmailed')} />
      <div className="grid gap-4">
        <Card title={t('admin.reports.summary')}>
          <p>{(r.summary as Record<string, string>)[locale] ?? ''}</p>
          {d.coverageStart && <p className="mt-2 text-sm text-ink-3">{t('admin.reports.coverage', { date: formatDate(d.coverageStart, locale) })}</p>}
        </Card>

        <Card title={t('admin.reports.recommended')}>
          {d.recommendations.length === 0 ? (
            <Empty>{t('admin.overview.nothingToDo')}</Empty>
          ) : (
            <ol className="list-decimal pl-5 text-sm">
              {d.recommendations.map((x) => (
                <li key={`${x.kind}:${x.ref}`} className="py-1">
                  {x.kind === 'dependency' ? dependencyAction(t, x.ref) : x.kind === 'inbox' || x.kind === 'opportunity' ? <TextLink href={`/admin/inbox/${x.ref}`}>{x.label}</TextLink> : x.label}{' '}
                  <span className="text-ink-3">
                    ({t('admin.report.email.minutes', { n: x.estMinutes })}
                    {x.evCentsPerMonth ? ` · ${t('admin.report.email.ev', { amount: eur(x.evCentsPerMonth) })}` : ''})
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title={t('admin.reports.openIssues')}>
          {d.inbox.attention.length === 0 ? (
            <Empty>{t('admin.overview.nothingToDo')}</Empty>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {d.inbox.attention.map((i) => (
                <li key={i.id}>
                  <Badge tone={severityTone(i.severity)}>{i.severity.toUpperCase()}</Badge> <span className="eyebrow">{kindLabel(t, i.kind)}</span> <TextLink href={`/admin/inbox/${i.id}`}>{i.title}</TextLink>
                  <div className="text-xs text-ink-3">{ifNothing(t, locale, i.defaultAction, i.dueAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t('admin.reports.traffic')}>
            {!d.traffic.hasData ? (
              <Empty>{t('admin.overview.noTraffic')}</Empty>
            ) : (
              <Table head={['', t('admin.common.value'), t('admin.common.previous'), '']}>
                {row(t('admin.metric.visits'), d.traffic.visits)}
                {row(t('admin.metric.pageviews'), d.traffic.pageviews)}
                {CHANNELS.map((c) => row(t(`admin.metric.${c}`), d.traffic.channels[c]))}
                {row(t('admin.metric.matches'), d.traffic.matches)}
              </Table>
            )}
          </Card>
          <Card title={t('admin.reports.revenue')}>
            <Table head={['', t('admin.common.value'), t('admin.common.status'), '']}>
              {d.revenue.streams.map((s) => (
                <tr key={s.stream}>
                  <td>{t(`admin.revenue.stream.${s.stream}`)}</td>
                  <td className="tabular font-semibold">{s.status === 'not_configured' || s.status === 'unknown' || s.status === 'none' ? t('admin.common.dash') : eur(s.eurCents)}</td>
                  <td>
                    <Badge tone={s.status === 'ok' ? 'ok' : s.status === 'partial' ? 'warn' : 'neutral'}>{t(`admin.revenue.status.${s.status}`)}</Badge>
                  </td>
                  <td className="text-xs text-ink-3">
                    {s.through ? t('admin.revenue.through', { date: formatDate(s.through, locale) }) : s.reason ? t(`admin.revenue.reason.${s.reason}`) : ''}
                  </td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 text-sm">
              {t('admin.revenue.total')}: <strong>{d.revenue.totalEurCents === null ? t('admin.common.dash') : d.revenue.lowerBound ? t('admin.revenue.atLeast', { amount: eur(d.revenue.totalEurCents) }) : eur(d.revenue.totalEurCents)}</strong> · {t('admin.metric.leads')} {num(d.revenue.leads.created.value)}
            </p>
          </Card>
        </div>

        <Card title={t('admin.reports.affiliate')}>
          {d.commerce.byPageType.length === 0 ? (
            <Empty>{t('admin.common.noData')}</Empty>
          ) : (
            <Table head={[t('admin.reports.pageType'), t('admin.metric.pageviews'), t('admin.metric.clicks'), t('admin.metric.affiliateClicks'), t('admin.metric.epc'), t('admin.metric.rpm')]}>
              {d.commerce.byPageType.map((p) => (
                <tr key={p.pageType}>
                  <td className="mono text-xs">{p.pageType}</td>
                  <td className="tabular">{num(p.pageviews)}</td>
                  <td className="tabular">{num(p.clicks)}</td>
                  <td className="tabular">{num(p.affiliateClicks)}</td>
                  <td className="tabular text-xs">{p.epcEurCents === null ? t('admin.reports.noMinSample') : eur(p.epcEurCents)}</td>
                  <td className="tabular text-xs">{p.rpmEurCents === null ? t('admin.reports.noMinSample') : eur(p.rpmEurCents)}</td>
                </tr>
              ))}
            </Table>
          )}
          {d.commerce.brokenAffiliateLinks.length > 0 && <p className="mt-2 text-sm text-danger">{d.commerce.brokenAffiliateLinks.map((b) => b.name).join(', ')}</p>}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t('admin.reports.changes')}>
            {d.catalog.topChanges.length === 0 ? (
              <Empty>{t('admin.common.empty')}</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {d.catalog.topChanges.map((c) => (
                  <li key={c.id}>
                    <strong>{c.toolName}</strong> {localized(c.title, locale)}{' '}
                    {c.sourceUrl && (
                      <TextLink href={c.sourceUrl} external>
                        {t('admin.common.source')}
                      </TextLink>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t('admin.reports.newTools')}>
            <p className="text-sm">
              {t('admin.reports.candidates', { new: d.catalog.candidates.new, verified: d.catalog.candidates.verified, rejected: d.catalog.candidates.rejected, duplicate: d.catalog.candidates.duplicate })}
            </p>
            {d.catalog.newToolsPublished.length > 0 && <p className="mt-2 text-sm">{d.catalog.newToolsPublished.map((x) => x.name).join(', ')}</p>}
            {d.seo && (
              <p className="mt-3 text-sm">
                {t('admin.reports.seo')}: {t('admin.metric.indexable')} <strong className="tabular">{num(d.seo.total)}</strong>
              </p>
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t('admin.reports.bestPages')}>
            {d.traffic.topPages.length === 0 ? (
              <Empty>{t('admin.overview.noTraffic')}</Empty>
            ) : (
              <Table head={['', t('admin.metric.pageviews'), t('admin.metric.clicks')]}>
                {d.traffic.topPages.map((p) => (
                  <tr key={p.path}>
                    <td className="mono text-xs">{p.path}</td>
                    <td className="tabular">{num(p.pageviews)}</td>
                    <td className="tabular">{num(p.clicks)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <Card title={t('admin.reports.opportunities')}>
            {d.opportunities.length === 0 ? (
              <Empty>{t('admin.common.empty')}</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {d.opportunities.map((o) => (
                  <li key={o.id}>
                    <TextLink href={`/admin/inbox/${o.id}`}>{o.title}</TextLink>
                    {o.impact?.evBasis && <div className="text-xs text-ink-3">{o.impact.evBasis}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t('admin.reports.automation')}>
            <ul className="flex flex-col gap-1 text-sm">
              {d.automation.actions.map((a) => (
                <li key={`${a.action}:${a.decision}`} className="flex justify-between gap-2">
                  <span>
                    {actionLabel(t, a.action)} <span className="text-xs text-ink-3">({t(`admin.operations.decision.${a.decision}`)})</span>
                  </span>
                  <span className="tabular font-semibold">{num(a.n)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-2 border-t border-line pt-1">
                <span>{t('admin.overview.resolvedAuto')}</span>
                <span className="tabular">{num(d.automation.inbox.autoResolved + d.automation.inbox.expired)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>{t('admin.overview.defaulted')}</span>
                <span className="tabular">{num(d.automation.inbox.defaulted)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>{t('admin.overview.reverts')}</span>
                <span className="tabular">{num(d.automation.reverted)}</span>
              </li>
            </ul>
          </Card>
          <Card title={t('admin.reports.health')}>
            <Table head={[t('admin.reports.agentRuns'), '✓', '~', '✗']}>
              {d.automation.runs.map((x) => (
                <tr key={x.agent}>
                  <td className="mono text-xs">{x.agent}</td>
                  <td className="tabular">{x.success}</td>
                  <td className="tabular">{x.partial}</td>
                  <td className={`tabular ${x.failed ? 'font-semibold text-danger' : ''}`}>{x.failed}</td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 text-sm">
              {t('admin.overview.healthErrors')}: <strong>{num(d.health.errorsTotal)}</strong> · {t('admin.overview.healthLlm')}: {t('admin.overview.llmSpend', { spent: d.health.llm.costUsd.toFixed(2), budget: d.health.llm.budgetUsd.toFixed(0) })}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1">
              {d.health.checks.map((c) => (
                <li key={c.key}>
                  <Badge tone={statusTone(c.status)}>{dependencyName(t, c.key)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title={t('admin.reports.unmeasured')}>
          {d.unmeasured.length === 0 ? (
            <Empty>{t('admin.common.empty')}</Empty>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {d.unmeasured.map((u) => (
                <li key={u}>{t(`admin.unmeasured.${u}`)}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
