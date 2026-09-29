import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog, nameOf } from '@/lib/catalog';
import { fairFightGate, parsePair, sharedPrimary } from '@/lib/engine/compare';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { href } from '@/lib/routes';
import { alternates, robots } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { CompareView } from '@/components/data/CompareView';
import { DisclosureNote } from '@/components/data/DisclosureNote';

export async function generateMetadata({ params }: PageProps<'/[locale]/compare/[pair]'>): Promise<Metadata> {
  const { locale, pair } = (await params) as { locale: Locale; pair: string };
  const catalog = await getCatalog();
  const tools = parsePair(pair, catalog);
  if (!tools) return {};
  const [a, b] = tools;
  const t = getT(locale);
  return {
    title: t('compare.fairFightMetaTitle', { a: a.name, b: b.name }),
    description: t('compare.fairFightMetaDescription', { a: a.name, b: b.name }),
    alternates: alternates(locale, (l) => href.fairFight(l, a.slug, b.slug)),
    robots: robots(fairFightGate(a, b).ok),
  };
}

export default async function FairFightPage({ params }: PageProps<'/[locale]/compare/[pair]'>) {
  const { locale, pair } = (await params) as { locale: Locale; pair: string };
  const catalog = await getCatalog();
  const tools = parsePair(pair, catalog);
  if (!tools) notFound();
  const canonical = href.fairFight(locale, tools[0].slug, tools[1].slug);
  if (canonical !== `/${locale}/compare/${pair}`) permanentRedirect(canonical);
  const sorted = [...tools].sort((x, y) => x.slug.localeCompare(y.slug)) as [typeof tools[0], typeof tools[1]];
  const [a, b] = sorted;
  const t = getT(locale);
  const affiliates = await affiliateToolIds();
  await track({ path: canonical, pageType: 'fair_fight', locale, props: { pair } });
  const shared = [...new Set([...sharedPrimary(a, b), ...sharedPrimary(b, a)])];

  return (
    <article className="container-page py-8">
      <Breadcrumbs t={t} items={[{ label: t('compare.title'), href: href.compare(locale) }, { label: `${a.name} vs ${b.name}` }]} />
      <h1 className="mt-6 text-3xl md:text-4xl">{t('compare.fairFightTitle', { a: a.name, b: b.name })}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('compare.fairFightIntro')}</p>
      {shared.length > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          <span className="text-ink-3">{t('compare.sharedCapabilities')}:</span>{' '}
          {shared
            .map((id) => catalog.capabilitiesById.get(id))
            .filter(Boolean)
            .map((c) => nameOf(c!, locale).name)
            .join(', ')}
        </p>
      )}
      {(affiliates.has(a.id) || affiliates.has(b.id)) && (
        <div className="mt-4">
          <DisclosureNote t={t} locale={locale} />
        </div>
      )}
      <CompareView tools={[a, b]} catalog={catalog} t={t} locale={locale} affiliates={affiliates} src="fair_fight" />
      <p className="mt-10 text-sm text-ink-2">
        {t('compare.shareMatch')} <Link href={href.home(locale)}>{t('compare.matchCta')} →</Link>
      </p>
    </article>
  );
}
