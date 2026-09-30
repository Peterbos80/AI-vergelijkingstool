import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { staticSite } from '@/lib/env';
import { parseFilters } from '@/lib/engine/search';
import { href } from '@/lib/routes';
import { track } from '@/lib/analytics/track';
import { ExplorerView } from '@/components/explorer/ExplorerView';
import { StaticQueryPage } from '@/components/static/StaticQueryPage';

type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/tools'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const sp = (await searchParams) as SP;
  const t = getT(locale);
  const catalog = await getCatalog();
  const filtered = Object.keys(sp).length > 0;
  return {
    title: t('explorer.metaTitle'),
    description: t('explorer.metaDescription', { count: catalog.tools.length }),
    alternates: { canonical: href.tools(locale) },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function ToolsPage({ params, searchParams }: PageProps<'/[locale]/tools'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = (await searchParams) as SP;
  const t = getT(locale);
  const catalog = await getCatalog();
  if (staticSite()) {
    // Free edition: the full list is static; filters are applied in the browser.
    return (
      <StaticQueryPage kind="explorer" locale={locale} labels={{ loading: t('static.loading'), failed: t('static.failed') }}>
        <ExplorerView locale={locale} t={t} catalog={catalog} sp={{}} />
      </StaticQueryPage>
    );
  }
  const filters = parseFilters(sp, catalog, locale);
  await track({ path: href.tools(locale), pageType: 'tools', locale, searchParams: sp, props: filters.q ? { q: filters.q.slice(0, 80) } : undefined });
  return <ExplorerView locale={locale} t={t} catalog={catalog} sp={sp} />;
}
