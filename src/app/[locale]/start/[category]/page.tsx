import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { findBySlug, getCatalog, nameOf, taskSlug, taskTextOf } from '@/lib/catalog';
import { taskGuide } from '@/content/task-guides';
import { href } from '@/lib/routes';
import { alternates, robots } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export async function generateMetadata({ params }: PageProps<'/[locale]/start/[category]'>): Promise<Metadata> {
  const { locale, category } = (await params) as { locale: Locale; category: string };
  const catalog = await getCatalog();
  const cat = findBySlug(catalog.categories, decodeURIComponent(category), locale);
  if (!cat) return {};
  const t = getT(locale);
  const name = t.has(`start.cat.${cat.id}`) ? t(`start.cat.${cat.id}`) : nameOf(cat, locale).name;
  return {
    title: t('start.metaTitle2', { area: name }),
    alternates: alternates(locale, (l) => href.start(l, nameOf(cat, l).slug), Object.keys(cat.text) as Locale[]),
    robots: robots(nameOf(cat, locale).locale === locale),
  };
}

/** Step 2 of 3: pick the task, each with a one-line explanation. */
export default async function StartCategoryPage({ params }: PageProps<'/[locale]/start/[category]'>) {
  const { locale, category } = (await params) as { locale: Locale; category: string };
  const catalog = await getCatalog();
  const cat = findBySlug(catalog.categories, decodeURIComponent(category), locale);
  if (!cat) notFound();
  const slug = nameOf(cat, locale).slug;
  if (slug !== decodeURIComponent(category)) permanentRedirect(href.start(locale, slug));
  const t = getT(locale);
  await track({ path: href.start(locale, slug), pageType: 'start', locale, entityId: cat.id });
  const tasks = catalog.tasks.filter((x) => x.categoryId === cat.id);
  const area = t.has(`start.cat.${cat.id}`) ? t(`start.cat.${cat.id}`) : nameOf(cat, locale).name;
  return (
    <div className="container-page py-8">
      <Breadcrumbs t={t} items={[{ label: t('start.breadcrumb'), href: href.start(locale) }, { label: area }]} />
      <p className="mono mt-6 text-xs text-ink-3">{t('start.step', { n: 2 })}</p>
      <h1 className="mt-1 text-3xl md:text-4xl">{t('start.title2')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('start.intro2')}</p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {tasks.map((x) => {
          const text = taskTextOf(x, locale);
          const guide = taskGuide(x.id, locale);
          return (
            <li key={x.id}>
              <Link href={href.start(locale, slug, taskSlug(x, locale))} className="start-card">
                <span className="block text-lg font-semibold text-ink">{text.title}</span>
                <span className="mt-1 block text-sm text-ink-2">{guide?.what ?? text.summary}</span>
                <span className="link-accent mt-3 block text-sm font-semibold">{t('start.choose')} →</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 text-sm">
        <Link href={href.start(locale)}>← {t('start.back')}</Link>
      </p>
    </div>
  );
}
