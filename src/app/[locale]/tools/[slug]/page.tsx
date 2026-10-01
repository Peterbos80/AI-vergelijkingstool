import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate, formatMoney } from '@/i18n/formatters';
import { getCatalog, nameOf, toolText } from '@/lib/catalog';
import { getToolDetail } from '@/lib/catalog/detail';
import { EVENT_ICON, eventDate, eventTitle, eventToneClass, localized } from '@/lib/catalog/events';
import { fairFightsFor } from '@/lib/engine/compare';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { href } from '@/lib/routes';
import { alternates, clip, robots } from '@/lib/seo';
import { siteUrl } from '@/lib/env';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JsonLd } from '@/components/ui/JsonLd';
import { ToolMonogram } from '@/components/data/ToolMonogram';
import { StatusStamp } from '@/components/data/StatusStamp';
import { FreshnessDial } from '@/components/data/FreshnessDial';
import { StaleBanner } from '@/components/data/StaleBanner';
import { VisitLink } from '@/components/data/VisitLink';
import { ReceiptDrawer } from '@/components/data/ReceiptDrawer';
import { FactList, hasFactValue } from '@/components/data/FactList';
import { ToolRow } from '@/components/data/ToolRow';
import { VideoFacade } from '@/components/data/VideoFacade';
import { DisclosureNote } from '@/components/data/DisclosureNote';
import { Icon } from '@/components/ui/Icon';
import { entryPriceLabel, planPriceLabel } from '@/components/data/format';
import { FxApprox } from '@/components/data/Price';

export async function generateMetadata({ params }: PageProps<'/[locale]/tools/[slug]'>): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(slug);
  if (!tool) return {};
  const t = getT(locale);
  const text = toolText(tool, locale);
  return {
    title: t('tool.metaTitle', { name: tool.name }),
    description: clip(
      t(tool.hasFreeTier === null ? 'tool.metaDescriptionNoFree' : 'tool.metaDescription', {
        name: tool.name,
        tagline: text?.tagline ?? '',
        price: entryPriceLabel(tool, t, locale),
        free: tool.hasFreeTier ? t('common.yes') : t('common.no'),
      }),
    ),
    alternates: alternates(locale, (l) => href.tool(l, tool.slug), Object.keys(tool.text) as Locale[]),
    robots: robots(tool.indexable.tool && text?.locale === locale),
    openGraph: { title: `${tool.name} — ${text?.tagline ?? ''}`, url: href.tool(locale, tool.slug) },
  };
}

const EU_KEYS = ['eu_data_residency', 'gdpr_dpa', 'trains_on_user_data', 'supports_dutch'];
/** Facts for the Advanced view only. */
const TECHNICAL_KEYS = ['api_available', 'open_source', 'self_hostable', 'model_dependencies'];
const OTHER_KEYS = [
  'has_free_tier',
  'has_free_trial',
  'commercial_use_free_tier',
  'watermark_free_tier',
  'api_available',
  'open_source',
  'self_hostable',
  'platforms',
  'model_dependencies',
];

export default async function ToolPage({ params }: PageProps<'/[locale]/tools/[slug]'>) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(slug);
  if (!tool) notFound();
  const t = getT(locale);
  const text = toolText(tool, locale);
  const [detail, affiliates] = await Promise.all([getToolDetail(tool.id), affiliateToolIds()]);
  await track({ path: href.tool(locale, tool.slug), pageType: 'tool', locale, entityId: tool.id });

  const snapshot: Record<string, unknown> = {
    has_free_tier: tool.hasFreeTier,
    has_free_trial: tool.hasFreeTrial,
    api_available: tool.apiAvailable,
    open_source: tool.openSource,
    self_hostable: tool.selfHostable,
    platforms: tool.platforms.length ? tool.platforms : null,
    supports_dutch: tool.supportsDutch,
    eu_data_residency: tool.euDataResidency,
    gdpr_dpa: tool.gdprDpa,
    trains_on_user_data: tool.trainsOnUserData,
    commercial_use_free_tier: tool.commercialUseFreeTier,
    watermark_free_tier: tool.watermarkFreeTier,
    model_dependencies: tool.modelDependencies.length ? tool.modelDependencies : null,
  };
  const known = (keys: string[]) => keys.filter((k) => hasFactValue(detail.facts[k] ? detail.facts[k].value : snapshot[k]));
  const knownFacts = known(OTHER_KEYS);
  const knownEu = known(EU_KEYS);
  const missingFacts = knownFacts.length + knownEu.length < OTHER_KEYS.length + EU_KEYS.length;
  const alternativesList = tool.alternatives
    .map((a) => catalog.toolsById.get(a.id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x) && x!.status !== 'shutdown')
    .slice(0, 3);
  const fights = fairFightsFor(catalog, tool);
  const isAffiliate = affiliates.has(tool.id);
  const lastEvent = detail.events[0];
  const history = detail.history.filter((h) => h.validTo !== null);
  const priceSince = tool.plans.length
    ? detail.history.filter((h) => h.validTo === null).reduce<Date | null>((acc, h) => (!acc || h.validFrom > acc ? h.validFrom : acc), null)
    : null;

  const offers = tool.plans
    .filter((p) => !p.isCustom && p.priceCents !== null && p.currency && p.status !== 'unverified')
    .map((p) => ({
      '@type': 'Offer',
      name: p.name,
      price: (p.priceCents! / 100).toFixed(2),
      priceCurrency: p.currency,
      url: siteUrl(href.toolPricing(locale, tool.slug)),
    }));
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: tool.platforms.map((p) => t(`platforms.${p}`)).join(', ') || undefined,
    description: text?.description,
    url: siteUrl(href.tool(locale, tool.slug)),
    sameAs: tool.websiteUrl,
    ...(tool.companyName ? { publisher: { '@type': 'Organization', name: tool.companyName } } : {}),
    ...(offers.length ? { offers } : {}),
  };

  return (
    <article className="container-page py-8">
      <Breadcrumbs t={t} items={[{ label: t('tool.breadcrumbTools'), href: href.tools(locale) }, { label: tool.name }]} />
      <JsonLd data={ld} />

      {tool.status === 'shutdown' && <p className="notice notice-warning mt-4">{t('tool.shutdownNotice', { name: tool.name })}</p>}
      {tool.status === 'deprecated' && <p className="notice notice-warning mt-4">{t('tool.deprecatedNotice', { name: tool.name })}</p>}
      {tool.quarantineUntil && tool.quarantineUntil > new Date() && <p className="notice mt-4">{t('tool.quarantineNotice')}</p>}

      <header className="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <ToolMonogram name={tool.name} size={56} />
          <div>
            <h1 className="text-3xl md:text-4xl">{tool.name}</h1>
            <p className="mt-1 text-lg text-ink-2">{text?.tagline}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-3">
              {tool.companyName && <span>{t('tool.by', { company: tool.companyName })}</span>}
              {tool.pricingStatus && <StatusStamp status={tool.pricingStatus} t={t} />}
              <FreshnessDial freshness={tool.freshness} t={t} />
              <span>{t('freshness.checkedOn', { date: formatDate(tool.lastCheckedAt ?? tool.priceCheckedAt, locale) })}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <VisitLink slug={tool.slug} name={tool.name} t={t} locale={locale} src="tool" affiliate={isAffiliate} />
          <Link href={href.compare(locale, [tool.slug, ...alternativesList.slice(0, 1).map((a) => a.slug)])} className="btn btn-ghost">
            {t('common.compare')}
          </Link>
        </div>
      </header>

      <div className="mt-4">
        <StaleBanner freshness={tool.freshness} checkedAt={tool.priceCheckedAt} t={t} locale={locale} />
        {tool.plans.some((p) => p.pendingChange) && (
          <p role="status" className="notice notice-warning">
            {t('plans.pendingNotice')}
          </p>
        )}
      </div>
      {isAffiliate && (
        <div className="mt-4">
          <DisclosureNote t={t} locale={locale} />
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-10">
          <section>
            <p className="max-w-3xl text-ink-2">{text?.description}</p>
            {text?.contentStatus === 'ai_draft' && <p className="mt-2 text-xs text-ink-3">{t('tool.contentAiDraft')}</p>}
            {text?.contentStatus === 'machine_translated' && <p className="mt-2 text-xs text-ink-3">{t('tool.contentMachineTranslated')}</p>}
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {(['bestFor', 'notFor', 'limitations'] as const).map((k) =>
                text && text[k].length > 0 ? (
                  <div key={k}>
                    <h2 className="eyebrow">{t(`tool.${k}`)}</h2>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {text[k].map((x) => (
                        <li key={x} className="flex gap-2">
                          <span aria-hidden="true" className="text-ink-3">
                            {k === 'bestFor' ? '+' : k === 'notFor' ? '−' : '!'}
                          </span>
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </section>

          <section aria-labelledby="dna">
            <h2 id="dna" className="text-xl">
              {t('tool.dna')}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {tool.capabilities.map((c) => {
                const cap = catalog.capabilitiesById.get(c.id);
                if (!cap) return null;
                const n = nameOf(cap, locale);
                return (
                  <li key={c.id}>
                    <Link href={href.capability(locale, n.slug)} className="chip">
                      <span aria-hidden="true">{c.strength === 'primary' ? '●' : '○'}</span>
                      {n.name}
                      <span className="visually-hidden">({t(`tool.${c.strength}`)})</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3 border-b border-line py-1.5">
                <dt className="text-ink-2">{t('tool.skillLevel')}</dt>
                <dd>{t(`skill.${tool.skillLevel}`)}</dd>
              </div>
              {tool.platforms.length > 0 && (
                <div className="flex justify-between gap-3 border-b border-line py-1.5">
                  <dt className="text-ink-2">{t('facts.platforms')}</dt>
                  <dd className="text-right">{tool.platforms.map((p) => t(`platforms.${p}`)).join(', ')}</dd>
                </div>
              )}
            </dl>
          </section>

          <section aria-labelledby="pricing">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="pricing" className="text-xl">
                {t('tool.pricing')}
              </h2>
              <Link href={href.toolPricing(locale, tool.slug)} className="text-sm">
                {t('tool.allPlans')} →
              </Link>
            </div>
            {tool.plans.length === 0 ? (
              <p className="mt-2 text-ink-2">{t('plans.noPlans')}</p>
            ) : (
              <ul className="receipt mt-4 divide-y divide-dashed divide-line px-4 py-3">
                {tool.plans.map((p) => {
                  return (
                    <li key={p.key} className="py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold">{p.name}</span>
                        <span className="num flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                          {planPriceLabel(p, t, locale)}
                          <FxApprox cents={p.priceCents} currency={p.currency} fx={catalog.fx} t={t} locale={locale} />
                          <StatusStamp status={p.status} t={t} compact />
                        </span>
                      </div>
                      {p.quota && <p className="mt-0.5 text-xs text-ink-3">{p.quota}</p>}
                      {p.pendingChange && <p className="mt-1 text-xs font-semibold text-warning-ink">{t('plans.pendingBadge')}</p>}
                      <ReceiptDrawer receipt={detail.plans[p.key]} t={t} locale={locale} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {knownFacts.length > 0 && (
            <section aria-labelledby="facts">
              <h2 id="facts" className="text-xl">
                {t('tool.facts')}
              </h2>
              <div className="card mt-3 px-4">
                <FactList keys={OTHER_KEYS} detail={detail} snapshot={snapshot} t={t} locale={locale} technical={TECHNICAL_KEYS} />
              </div>
              {missingFacts && (
                <p className="mt-2 text-xs text-ink-3">
                  {t('tool.missingFacts', { name: tool.name })}{' '}
                  <Link href={href.page(locale, 'corrections')}>{t('tool.missingFactsLink')}</Link>
                </p>
              )}
            </section>
          )}

          <section aria-labelledby="timeline">
            <h2 id="timeline" className="text-xl">
              {t('tool.timeline')}
            </h2>
            {detail.events.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">{t('tool.timelineEmpty')}</p>
            ) : (
              <ol className="mt-3 space-y-3 border-l border-line pl-4">
                {detail.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="mono text-xs text-ink-3">
                      {formatDate(eventDate(e), locale)} · {t(`eventKind.${e.kind}`)}
                    </p>
                    <p className="font-medium">
                      <Icon name={EVENT_ICON[e.kind]} size={16} className={`mr-1.5 ${eventToneClass(e.kind)}`} />
                      {eventTitle(e, locale)}
                    </p>
                    {localized(e.summary, locale) && <p className="text-ink-2">{localized(e.summary, locale)}</p>}
                    {e.sourceUrl && (
                      <a href={e.sourceUrl} rel="nofollow noopener noreferrer" className="text-xs text-ink-3">
                        {t('common.source')}: {new URL(e.sourceUrl).hostname}
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {detail.videos.length > 0 && (
            <section aria-labelledby="videos">
              <h2 id="videos" className="text-xl">
                {t('tool.videos')}
              </h2>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {detail.videos.map((v) => (
                  <li key={v.videoId}>
                    <VideoFacade videoId={v.videoId} title={v.title} channel={v.channelTitle} t={t} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="alternatives">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="alternatives" className="text-xl">
                {t('tool.alternatives')}
              </h2>
              <Link href={href.toolAlternatives(locale, tool.slug)} className="text-sm">
                {t('tool.allAlternatives', { name: tool.name })} →
              </Link>
            </div>
            <ul className="card mt-3 px-4">
              {alternativesList.map((a) => (
                <ToolRow key={a.id} tool={a} catalog={catalog} t={t} locale={locale} />
              ))}
            </ul>
            {fights.length > 0 && (
              <div className="mt-4">
                <h3 className="eyebrow">{t('tool.fairFights')}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {fights.map((f) => (
                    <li key={f.id}>
                      <Link href={href.fairFight(locale, tool.slug, f.slug)} className="chip">
                        {tool.name} vs {f.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-4" aria-labelledby="vitals">
            <h2 id="vitals" className="eyebrow">
              {t('tool.vitals')}
            </h2>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">{t('tool.website')}</dt>
                <dd className="text-right">
                  {tool.websiteStatus === 'up'
                    ? t('tool.websiteUp')
                    : tool.websiteStatus === 'down'
                      ? t('tool.websiteDown', { date: formatDate(tool.unreachableSince, locale) })
                      : t('tool.websiteUnknown')}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">{t('tool.lastChecked')}</dt>
                <dd>{formatDate(tool.lastCheckedAt ?? tool.priceCheckedAt, locale)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">{t('tool.lastChange')}</dt>
                <dd className="text-right">{lastEvent ? formatDate(eventDate(lastEvent), locale) : t('tool.noChange')}</dd>
              </div>
              {priceSince && history.length > 0 && (
                <div className="text-xs text-ink-3">{t('tool.priceStable', { date: formatDate(priceSince, locale) })}</div>
              )}
              {tool.entryPriceCents !== null && tool.entryPriceCurrency && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">{t('tool.pricing')}</dt>
                  <dd>{t('tool.fromPrice', { price: `${formatMoney(tool.entryPriceCents, tool.entryPriceCurrency, locale)}${t('period.month')}` })}</dd>
                </div>
              )}
            </dl>
          </section>

          {knownEu.length > 0 && (
            <section className="card p-4" aria-labelledby="eu-lens">
              <h2 id="eu-lens" className="eyebrow">
                {t('tool.euLens')}
              </h2>
              <FactList keys={EU_KEYS} detail={detail} snapshot={snapshot} t={t} locale={locale} />
            </section>
          )}

          <section className="card p-4" aria-labelledby="sources">
            <h2 id="sources" className="eyebrow">
              {t('tool.sources')}
            </h2>
            <ul className="mt-2 space-y-1.5 text-xs">
              {detail.sources.map((s) => (
                <li key={s.id} className="break-words">
                  <span className="text-ink-3">[{t(`sourceType.${s.type}`)}]</span>{' '}
                  <a href={s.url} rel="nofollow noopener noreferrer">
                    {s.title ?? s.domain}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-3">
              {t('receipts.explainer')}{' '}
              <Link href={href.page(locale, 'methodology')}>{t('receipts.methodologyLink')}</Link>
            </p>
          </section>
        </aside>
      </div>
    </article>
  );
}
