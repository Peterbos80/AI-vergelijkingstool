import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog, nameOf } from '@/lib/catalog';
import { worldSummaries } from '@/lib/catalog/worlds';
import { href } from '@/lib/routes';
import { WorldCard } from '@/components/worlds/WorldCard';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';

export async function generateMetadata({ params }: PageProps<'/[locale]/categories'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('categories.metaTitle'), description: t('categories.metaDescription'), alternates: alternates(locale, (l) => href.categories(l)) };
}

export default async function CategoriesPage({ params }: PageProps<'/[locale]/categories'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  const catalog = await getCatalog();
  await track({ path: href.categories(locale), pageType: 'categories', locale });
  const worlds = worldSummaries(catalog, t, locale);
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('categories.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('categories.intro')}</p>
      <ul className="world-grid mt-8">
        {worlds.map((w) => (
          <li key={w.id}>
            <WorldCard world={w} count={t('home.toolsCount', { count: w.toolCount })} topLabel={t('home.worldTop')} />
          </li>
        ))}
      </ul>

      <section className="mt-16" aria-labelledby="all-functions">
        <h2 id="all-functions" className="section-title">
          {t('categories.worldFunctions')}
        </h2>
        <div className="functions-index">
          {catalog.categories.map((cat) => {
            const caps = catalog.capabilities.filter((c) => c.categoryId === cat.id);
            const n = nameOf(cat, locale);
            return (
              <div key={cat.id} data-world={cat.id}>
                <h3 className="functions-group-title">
                  <span className="prompt-dot" aria-hidden="true" />
                  <Link href={href.category(locale, n.slug)}>{n.name}</Link>
                </h3>
                <ul className="functions-list">
                  {caps.map((c) => (
                    <li key={c.id}>
                      <Link href={href.capability(locale, nameOf(c, locale).slug)} className="chip min-h-0 px-2.5 py-1 text-xs">
                        {nameOf(c, locale).name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
