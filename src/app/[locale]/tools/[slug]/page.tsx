import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate } from '@/i18n/formatters';
import { getCatalog, nameOf, toolText } from '@/lib/catalog';
import { toolWorld } from '@/lib/catalog/helpers';
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
import { ToolMark } from '@/components/data/ToolMark';
import { StatusStamp } from '@/components/data/StatusStamp';
import { StaleBanner } from '@/components/data/StaleBanner';
import { VisitLink } from '@/components/data/VisitLink';
import { ReceiptDrawer } from '@/components/data/ReceiptDrawer';
import { FactList, hasFactValue } from '@/components/data/FactList';
import { ToolCard } from '@/components/data/ToolCard';
import { VideoFacade } from '@/components/data/VideoFacade';
import { DisclosureNote } from '@/components/data/DisclosureNote';
import { Icon } from '@/components/ui/Icon';
import { entryPriceLabel, factValueLabel, planPriceLabel } from '@/components/data/format';
import { STATUS_GLYPH, receiptChipName } from '@/components/data/ReceiptChip';
import { fitStyle } from '@/components/ui/fit';
import { WorldGlyph } from '@/components/worlds/WorldGlyph';
import { FxApprox } from '@/components/data/Price';
import { EuAlternatives } from '@/components/compare/EuAlternatives';

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
/** The title's key facts, after the entry price (an unknown value shows as a dash, never guessed). */
const HERO_FACTS = ['has_free_tier', 'platforms', 'supports_dutch', 'eu_data_residency', 'trains_on_user_data'];
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

  const world = toolWorld(tool, catalog);
  const mainCategory = world === 'home' ? undefined : catalog.categoriesById.get(world);

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

  const checkedAt = tool.lastCheckedAt ?? tool.priceCheckedAt;
  // The points of care: limitations first, then who it suits less; the first list carries the card's heading.
  const care = text ? (['limitations', 'notFor'] as const).filter((k) => text[k].length > 0) : [];

  return (
    <article className="container-page py-8">
      <Breadcrumbs t={t} items={[{ label: t('tool.breadcrumbTools'), href: href.tools(locale) }, { label: tool.name }]} />
      <JsonLd data={ld} />

      {tool.status === 'shutdown' && <p className="notice notice-warning mt-4">{t('tool.shutdownNotice', { name: tool.name })}</p>}
      {tool.status === 'deprecated' && <p className="notice notice-warning mt-4">{t('tool.deprecatedNotice', { name: tool.name })}</p>}
      {tool.quarantineUntil && tool.quarantineUntil > new Date() && <p className="notice mt-4">{t('tool.quarantineNotice')}</p>}

      <header className="tool-banner marks-light" data-world={world}>
        <div className="tool-banner-copy">
          <div className="tool-banner-top">
            <span className="tool-banner-mark">
              <ToolMark tool={tool} world={world} size={64} />
            </span>
            {mainCategory && world !== 'home' && (
              <Link href={href.category(locale, nameOf(mainCategory, locale).slug)} className="tool-banner-world">
                {t(`worlds.places.${world}`)} · {nameOf(mainCategory, locale).name}
              </Link>
            )}
          </div>
          <h1 className="tool-banner-title" style={fitStyle(tool.name)}>
            {tool.name}
          </h1>
          {text?.tagline && <p className="tool-banner-tagline">{text.tagline}</p>}
          <p className="tool-banner-meta">
            {tool.companyName && <span>{t('tool.by', { company: tool.companyName })}</span>}
            {tool.pricingStatus && (
              <Link
                href={href.toolPricing(locale, tool.slug)}
                className="banner-chip"
                data-status={tool.pricingStatus}
                title={t(`status.${tool.pricingStatus}.tooltip`)}
                prefetch={false}
              >
                <Icon name={STATUS_GLYPH[tool.pricingStatus]} size={16} />
                {t(`status.${tool.pricingStatus}.label`)}
              </Link>
            )}
            {checkedAt ? (
              <span>{t('freshness.checkedOn', { date: formatDate(checkedAt, locale) })}</span>
            ) : (
              tool.pricingStatus !== 'unverified' && <span>{t('freshness.unknown')}</span>
            )}
          </p>
          <div className="tool-banner-actions">
            <VisitLink slug={tool.slug} name={tool.name} t={t} locale={locale} src="tool" affiliate={isAffiliate} />
            <Link href={href.compare(locale, [tool.slug, ...alternativesList.slice(0, 1).map((a) => a.slug)])} className="btn btn-ghost">
              {t('common.compare')}
            </Link>
          </div>
        </div>
        <div className="tool-banner-art" aria-hidden="true">
          <span className="stage-shape stage-shape-1" />
          <span className="stage-shape stage-shape-2" />
          <WorldGlyph world={world} className="tool-banner-glyph" />
        </div>
      </header>

      <dl className="fact-tiles">
        <div className="fact-tile" data-known={entryPriceLabel(tool, t, locale) === '—' ? 'false' : 'true'}>
          <dt>{t('compare.criteria.entry_price')}</dt>
          <dd>
            <span className="fact-tile-value fact-tile-price">{entryPriceLabel(tool, t, locale)}</span>
            <FxApprox cents={tool.entryPriceCents} currency={tool.entryPriceCurrency} fx={catalog.fx} t={t} locale={locale} />
            {tool.pricingStatus && (
              <Link href={href.toolPricing(locale, tool.slug)} className="price-receipt" data-status={tool.pricingStatus} title={t('receipts.open')} prefetch={false}>
                <Icon name={STATUS_GLYPH[tool.pricingStatus]} size={14} />
                {receiptChipName({ status: tool.pricingStatus, t, locale, date: tool.priceCheckedAt })}
              </Link>
            )}
          </dd>
        </div>
        {HERO_FACTS.map((key) => {
          const receipt = detail.facts[key];
          const value = receipt ? receipt.value : snapshot[key];
          const shown = key === 'platforms' && Array.isArray(value) && value.length > 3 ? [...value.slice(0, 3), `+${value.length - 3}`] : value;
          const known = hasFactValue(value);
          return (
            <div key={key} className="fact-tile" data-known={known ? 'true' : 'false'}>
              <dt>{t(`facts.${key}`)}</dt>
              <dd>
                {known ? (
                  <>
                    <span className="fact-tile-value">{factValueLabel(key, shown, t)}</span>
                    {receipt && (
                      <span className="price-receipt" data-status={receipt.status}>
                        <Icon name={STATUS_GLYPH[receipt.status]} size={14} />
                        {receiptChipName({ status: receipt.status, t, locale, sources: receipt.sources.length, date: receipt.verifiedAt ?? receipt.observedAt })}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="fact-tile-value" aria-hidden="true">
                      —
                    </span>
                    <span className="fact-tile-note">{t('hub.noData')}</span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

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

      <div className="tool-body">
        <div className="tool-main" data-world={world}>
          <section aria-labelledby="about">
            <h2 id="about" className="display-4">
              {t('tool.about')}
            </h2>
            <p className="tool-about">{text?.description}</p>
            {text?.contentStatus === 'ai_draft' && <p className="mt-2 text-xs text-ink-3">{t('tool.contentAiDraft')}</p>}
            {text?.contentStatus === 'machine_translated' && <p className="mt-2 text-xs text-ink-3">{t('tool.contentMachineTranslated')}</p>}
            <ul className="cap-chips" aria-label={t('tool.dna')}>
              {tool.capabilities.map((c) => {
                const cap = catalog.capabilitiesById.get(c.id);
                if (!cap) return null;
                const n = nameOf(cap, locale);
                return (
                  <li key={c.id}>
                    <Link href={href.capability(locale, n.slug)} className="cap-chip" data-strength={c.strength}>
                      {n.name}
                      <span className="visually-hidden">({t(`tool.${c.strength}`)})</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
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

          {text && (text.bestFor.length > 0 || care.length > 0) && (
            <div className="pros-cons">
              {text.bestFor.length > 0 && (
                <section className="pro-card pro-card-good" aria-labelledby="best-for">
                  <h2 id="best-for">{t('tool.bestFor')}</h2>
                  <ul className="pro-list">
                    {text.bestFor.map((x) => (
                      <li key={x}>
                        <Icon name="check" size={20} />
                        {x}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {care.length > 0 && (
                <section className="pro-card pro-card-care" aria-labelledby={`care-${care[0]}`}>
                  {care.map((k, i) => {
                    const Heading = i === 0 ? 'h2' : 'h3';
                    return (
                      <div key={k}>
                        <Heading id={`care-${k}`}>{t(`tool.${k}`)}</Heading>
                        <ul className="pro-list">
                          {text[k].map((x) => (
                            <li key={x}>
                              <Icon name={k === 'limitations' ? 'triangle-alert' : 'x'} size={20} />
                              {x}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </section>
              )}
            </div>
          )}

          {knownFacts.length > 0 && (
            <section aria-labelledby="facts">
              <h2 id="facts" className="display-4">
                {t('tool.facts')}
              </h2>
              <div className="card mt-5 px-4">
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
            <h2 id="timeline" className="display-4">
              {t('tool.timeline')}
            </h2>
            {detail.events.length === 0 ? (
              <p className="mt-4 text-ink-2">{t('tool.timelineEmpty')}</p>
            ) : (
              <ol className="mt-5 space-y-3 border-l border-line pl-4">
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
              <h2 id="videos" className="display-4">
                {t('tool.videos')}
              </h2>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {detail.videos.map((v) => (
                  <li key={v.videoId}>
                    <VideoFacade videoId={v.videoId} title={v.title} channel={v.channelTitle} t={t} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="alternatives">
            <header className="bold-head">
              <h2 id="alternatives" className="display-4">
                {t('tool.alternatives')}
              </h2>
              <Link href={href.toolAlternatives(locale, tool.slug)} className="link-bold">
                {t('tool.allAlternatives', { name: tool.name })} →
              </Link>
            </header>
            {alternativesList.length > 0 && (
              <ul className="card-grid">
                {alternativesList.map((a) => (
                  <li key={a.id}>
                    <ToolCard tool={a} catalog={catalog} t={t} locale={locale} />
                  </li>
                ))}
              </ul>
            )}
            {fights[0] && (
              <Link href={href.fairFight(locale, tool.slug, fights[0].slug)} className="fight-bar">
                <span>
                  {t('tool.fairFights')}: {tool.name} vs {fights[0].name}
                </span>
                <Icon name="arrow-right" size={26} />
              </Link>
            )}
            {fights.length > 1 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label={t('tool.fairFights')}>
                {fights.slice(1).map((f) => (
                  <li key={f.id}>
                    <Link href={href.fairFight(locale, tool.slug, f.slug)} className="chip">
                      {tool.name} vs {f.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <EuAlternatives tool={tool} catalog={catalog} t={t} locale={locale} />
        </div>

        <aside className="tool-aside">
          <section className="receipt price-receipt-card" aria-labelledby="pricing">
            <div className="price-receipt-head">
              <h2 id="pricing">{t('tool.pricing')}</h2>
              <span className="price-receipt-label">{t('receipts.label')}</span>
            </div>
            {tool.plans.length === 0 ? (
              <p className="mt-4 border-t-2 border-dashed border-line pt-4 font-sans">{t('plans.noPlans')}</p>
            ) : (
              <ul className="price-receipt-plans">
                {tool.plans.map((p) => (
                  <li key={p.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="num flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                        {planPriceLabel(p, t, locale)}
                        <FxApprox cents={p.priceCents} currency={p.currency} fx={catalog.fx} t={t} locale={locale} />
                        <StatusStamp status={p.status} t={t} />
                      </span>
                    </div>
                    {p.quota && <p className="mt-0.5 text-xs text-ink-3">{p.quota}</p>}
                    {p.pendingChange && <p className="mt-1 text-xs font-semibold text-warning-ink">{t('plans.pendingBadge')}</p>}
                    <ReceiptDrawer receipt={detail.plans[p.key]} t={t} locale={locale} />
                  </li>
                ))}
              </ul>
            )}
            {tool.priceCheckedAt && (
              <dl className="price-receipt-foot">
                <div>
                  <dt>{t('receipts.observed')}</dt>
                  <dd>{formatDate(tool.priceCheckedAt, locale)}</dd>
                </div>
              </dl>
            )}
            {priceSince && history.length > 0 && <p className="mt-1.5 text-[0.8125rem] text-ink-3">{t('tool.priceStable', { date: formatDate(priceSince, locale) })}</p>}
            <Link href={href.toolPricing(locale, tool.slug)} className="price-receipt-more">
              {t('tool.allPlans')} →
            </Link>
          </section>

          <section className="aside-card" aria-labelledby="vitals">
            <h2 id="vitals">{t('tool.vitals')}</h2>
            <dl className="mt-4 space-y-2.5 text-[0.9375rem]">
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
                <dd>{formatDate(checkedAt, locale)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">{t('tool.lastChange')}</dt>
                <dd className="text-right">{lastEvent ? formatDate(eventDate(lastEvent), locale) : t('tool.noChange')}</dd>
              </div>
            </dl>
          </section>

          {knownEu.length > 0 && (
            <section className="aside-card" aria-labelledby="eu-lens">
              <h2 id="eu-lens">{t('tool.euLens')}</h2>
              <FactList keys={EU_KEYS} detail={detail} snapshot={snapshot} t={t} locale={locale} />
            </section>
          )}

          <section className="aside-card" aria-labelledby="sources">
            <h2 id="sources">{t('tool.sources')}</h2>
            <ul className="source-list">
              {detail.sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} rel="nofollow noopener noreferrer">
                    {s.title ?? s.domain}
                  </a>
                  <span className="source-type">{t(`sourceType.${s.type}`)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-2">
              {t('receipts.explainer')} <Link href={href.page(locale, 'methodology')}>{t('receipts.methodologyLink')}</Link>
            </p>
          </section>
        </aside>
      </div>
    </article>
  );
}
