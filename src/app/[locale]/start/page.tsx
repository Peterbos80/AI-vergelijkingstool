import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog, nameOf, taskTextOf } from '@/lib/catalog';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { CATEGORY_EMOJI } from '@/components/start/emoji';

export async function generateMetadata({ params }: PageProps<'/[locale]/start'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('start.metaTitle'), description: t('start.metaDescription'), alternates: alternates(locale, (l) => href.start(l)) };
}

/** Step 1 of 3: pick an area, in plain words, with examples. */
export default async function StartPage({ params }: PageProps<'/[locale]/start'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  const catalog = await getCatalog();
  await track({ path: href.start(locale), pageType: 'start', locale });
  const cats = catalog.categories.filter((c) => catalog.tasks.some((x) => x.categoryId === c.id));
  return (
    <div className="container-page py-10">
      <p className="mono text-xs text-ink-3">{t('start.step', { n: 1 })}</p>
      <h1 className="mt-1 text-3xl md:text-4xl">{t('start.title1')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('start.intro1')}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => {
          const examples = catalog.tasks.filter((x) => x.categoryId === c.id).slice(0, 3);
          return (
            <li key={c.id}>
              <Link href={href.start(locale, nameOf(c, locale).slug)} className="start-card">
                <span className="text-2xl" aria-hidden="true">
                  {CATEGORY_EMOJI[c.id] ?? '✨'}
                </span>
                <span className="mt-2 block text-lg font-semibold text-ink">{t.has(`start.cat.${c.id}`) ? t(`start.cat.${c.id}`) : nameOf(c, locale).name}</span>
                <span className="mt-1 block text-sm text-ink-3">{examples.map((x) => taskTextOf(x, locale).title).join(' · ')}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 text-sm text-ink-2">
        {t('start.orType')} <Link href={href.home(locale)}>{t('start.orTypeLink')}</Link>
      </p>
    </div>
  );
}
