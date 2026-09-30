import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { staticSite } from '@/lib/env';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { href } from '@/lib/routes';
import { track } from '@/lib/analytics/track';
import { ComparePicker } from '@/components/data/ComparePicker';
import { StaticQueryPage } from '@/components/static/StaticQueryPage';

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/compare'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  return {
    title: t('compare.metaTitle'),
    description: t('compare.metaDescription'),
    alternates: { canonical: href.compare(locale) },
    robots: Object.keys(sp).length ? { index: false, follow: true } : undefined,
  };
}

export default async function ComparePage({ params, searchParams }: PageProps<'/[locale]/compare'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  const catalog = await getCatalog();
  const affiliates = await affiliateToolIds();
  if (staticSite()) {
    return (
      <StaticQueryPage kind="compare" locale={locale} labels={{ loading: t('static.loading'), failed: t('static.failed') }}>
        <ComparePicker locale={locale} t={t} catalog={catalog} sp={{}} affiliates={affiliates} />
      </StaticQueryPage>
    );
  }
  const raw = ([] as string[]).concat(sp.tools ?? []).flatMap((x) => x.split(','));
  const slugs = [...new Set(raw.map((s) => s.trim()).filter(Boolean))].slice(0, 4).filter((s) => catalog.toolsBySlug.has(s));
  await track({ path: href.compare(locale), pageType: 'compare', locale, props: { tools: slugs } });
  return <ComparePicker locale={locale} t={t} catalog={catalog} sp={sp} affiliates={affiliates} />;
}
