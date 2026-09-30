import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate, formatMoney } from '@/i18n/formatters';
import { getCatalog, toolText } from '@/lib/catalog';
import { getToolDetail } from '@/lib/catalog/detail';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { href } from '@/lib/routes';
import { alternates, clip, robots } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { StatusStamp } from '@/components/data/StatusStamp';
import { StaleBanner } from '@/components/data/StaleBanner';
import { ReceiptDrawer } from '@/components/data/ReceiptDrawer';
import { VisitLink } from '@/components/data/VisitLink';
import { DisclosureNote } from '@/components/data/DisclosureNote';
import { PriceHistoryChart } from '@/components/data/PriceHistoryChart';
import { approxEur, entryPriceLabel, planPriceLabel } from '@/components/data/format';

export async function generateMetadata({ params }: PageProps<'/[locale]/tools/[slug]/pricing'>): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(slug);
  if (!tool) return {};
  const t = getT(locale);
  const year = new Date().getFullYear();
  return {
    title: t('plans.metaTitle', { name: tool.name, year }),
    description: clip(t('plans.metaDescription', { name: tool.name, count: tool.plans.length, price: entryPriceLabel(tool, t, locale) })),
    alternates: alternates(locale, (l) => href.toolPricing(l, tool.slug), Object.keys(tool.text) as Locale[]),
    // Same gate as the sitemap: indexable only in locales with the tool's own text.
    robots: robots(tool.indexable.pricing && toolText(tool, locale)?.locale === locale),
  };
}

export default async function PricingPage({ params }: PageProps<'/[locale]/tools/[slug]/pricing'>) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(slug);
  if (!tool) notFound();
  const t = getT(locale);
  const [detail, affiliates] = await Promise.all([getToolDetail(tool.id), affiliateToolIds()]);
  await track({ path: href.toolPricing(locale, tool.slug), pageType: 'tool_pricing', locale, entityId: tool.id });
  const currencies = [...new Set(tool.plans.map((p) => p.currency).filter((c): c is string => Boolean(c)))];
  const foreign = currencies.filter((c) => c !== 'EUR');
  const historyByPlan = new Map<string, typeof detail.history>();
  for (const h of detail.history) historyByPlan.set(h.planKey, [...(historyByPlan.get(h.planKey) ?? []), h]);
  const changedPlans = [...historyByPlan.entries()].filter(([, rows]) => rows.some((r) => r.validTo !== null));
  const isAffiliate = affiliates.has(tool.id);

  return (
    <article className="container-page py-8">
      <Breadcrumbs
        t={t}
        items={[
          { label: t('tool.breadcrumbTools'), href: href.tools(locale) },
          { label: tool.name, href: href.tool(locale, tool.slug) },
          { label: t('tool.pricing') },
        ]}
      />
      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">{t('plans.title', { name: tool.name })}</h1>
          <p className="mt-2 text-sm text-ink-3">{t('freshness.checkedOn', { date: formatDate(tool.priceCheckedAt, locale) })}</p>
        </div>
        <VisitLink slug={tool.slug} name={tool.name} t={t} locale={locale} src="pricing" affiliate={isAffiliate} />
      </header>
      <div className="mt-4 space-y-3">
        <StaleBanner freshness={tool.freshness} checkedAt={tool.priceCheckedAt} t={t} locale={locale} />
        {tool.plans.some((p) => p.pendingChange) && (
          <p role="status" className="notice notice-warning">
            {t('plans.pendingNotice')}
          </p>
        )}
        {isAffiliate && <DisclosureNote t={t} locale={locale} />}
      </div>

      {tool.plans.length === 0 ? (
        <p className="mt-8 text-ink-2">{t('plans.noPlans')}</p>
      ) : (
        <div className="table-scroll mt-8">
          <table className="table-data">
            <caption className="visually-hidden">{t('plans.title', { name: tool.name })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('plans.plan')}</th>
                <th scope="col">{t('plans.price')}</th>
                <th scope="col">{t('plans.annual')}</th>
                <th scope="col">{t('plans.includes')}</th>
                <th scope="col">{t('plans.status')}</th>
              </tr>
            </thead>
            <tbody>
              {tool.plans.map((p) => {
                const eur = approxEur(p.priceCents, p.currency, catalog.fx.rates, locale);
                return (
                  <tr key={p.key}>
                    <th scope="row" className="font-semibold">
                      {p.name}
                    </th>
                    <td className="tabular whitespace-nowrap">
                      {planPriceLabel(p, t, locale)}
                      {eur && <div className="text-xs text-ink-3">{t('common.approxEur', { amount: eur })}</div>}
                    </td>
                    <td className="tabular whitespace-nowrap">
                      {p.annualMonthlyCents !== null && p.currency
                        ? `${formatMoney(p.annualMonthlyCents, p.currency, locale)}${t('period.month')}`
                        : '—'}
                    </td>
                    <td className="min-w-[12rem] text-ink-2">{p.quota ?? '—'}</td>
                    <td>
                      <StatusStamp status={p.status} t={t} />
                      {p.pendingChange && <div className="mt-1 text-xs font-semibold text-warning-ink">{t('plans.pendingBadge')}</div>}
                      <ReceiptDrawer receipt={detail.plans[p.key]} t={t} locale={locale} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-3">
        {t('plans.vatNote')}{' '}
        {foreign.length > 0 && catalog.fx.day && t('plans.currencyNote', { currency: foreign.join(', '), date: formatDate(catalog.fx.day, locale) })}
      </p>

      <section className="mt-12" aria-labelledby="history">
        <h2 id="history" className="text-xl">
          {t('plans.history')}
        </h2>
        {changedPlans.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">{t('plans.historyEmpty')}</p>
        ) : (
          changedPlans.map(([planKey, rows]) => (
            <div key={planKey} className="mt-6">
              <h3 className="font-semibold">{rows[0]!.name}</h3>
              <PriceHistoryChart rows={rows} locale={locale} label={`${t('plans.history')}: ${rows[0]!.name}`} />
              <ul className="mt-2 space-y-1 text-sm">
                {rows
                  .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())
                  .map((r, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2">
                      <span className="tabular font-medium">{planPriceLabel({ ...r, period: r.period as never, unit: 'flat' }, t, locale)}</span>
                      <span className="text-ink-3">
                        {r.validTo === null
                          ? `${t('plans.historyFrom', { date: formatDate(r.validFrom, locale) })} · ${t('plans.historyCurrent')}`
                          : r.validFrom.getTime() === r.validTo.getTime()
                            ? t('plans.historyUntil', { date: formatDate(r.validTo, locale) })
                            : `${formatDate(r.validFrom, locale)} – ${formatDate(r.validTo, locale)}`}
                      </span>
                      <StatusStamp status={r.status} t={t} compact />
                      {r.sourceUrl && (
                        <a href={r.sourceUrl} rel="nofollow noopener noreferrer" className="text-xs text-ink-3">
                          {t('common.source')}
                        </a>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <p className="mt-12">
        <Link href={href.tool(locale, tool.slug)}>← {tool.name}</Link>
      </p>
    </article>
  );
}
