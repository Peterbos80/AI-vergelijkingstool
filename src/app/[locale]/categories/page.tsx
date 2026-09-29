import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog, nameOf } from '@/lib/catalog';
import { href } from '@/lib/routes';
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
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('categories.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('categories.intro')}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.categories.map((cat) => {
          const caps = catalog.capabilities.filter((c) => c.categoryId === cat.id);
          const toolCount = catalog.tools.filter((x) => x.status !== 'shutdown' && x.capabilities.some((c) => caps.some((k) => k.id === c.id))).length;
          const n = nameOf(cat, locale);
          return (
            <li key={cat.id} className="card p-4">
              <Link href={href.category(locale, n.slug)} className="font-semibold">
                {n.name}
              </Link>
              <p className="mt-1 text-sm text-ink-2">{n.description}</p>
              <p className="mono mt-2 text-xs text-ink-3">{t('categories.toolsCount', { count: toolCount })}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {caps.map((c) => (
                  <li key={c.id}>
                    <Link href={href.capability(locale, nameOf(c, locale).slug)} className="chip min-h-0 px-2 py-0.5 text-xs">
                      {nameOf(c, locale).name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
