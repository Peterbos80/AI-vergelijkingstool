import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog, nameOf, taskSlug, taskTextOf } from '@/lib/catalog';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';

export async function generateMetadata({ params }: PageProps<'/[locale]/tasks'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  const catalog = await getCatalog();
  return {
    title: t('tasks.metaTitle'),
    description: t('tasks.metaDescription', { count: catalog.tasks.length }),
    alternates: alternates(locale, (l) => href.tasks(l)),
  };
}

export default async function TasksPage({ params }: PageProps<'/[locale]/tasks'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  const catalog = await getCatalog();
  await track({ path: href.tasks(locale), pageType: 'tasks', locale });
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('tasks.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('tasks.intro')}</p>
      <div className="mt-10 space-y-10">
        {catalog.categories.map((cat) => {
          const list = catalog.tasks.filter((x) => x.categoryId === cat.id);
          if (!list.length) return null;
          return (
            <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
              <h2 id={`cat-${cat.id}`} className="eyebrow">
                {nameOf(cat, locale).name}
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((task) => {
                  const text = taskTextOf(task, locale);
                  return (
                    <li key={task.id}>
                      <Link href={href.task(locale, taskSlug(task, locale))} className="card block h-full p-4 no-underline hover:border-ink-3">
                        <span className="font-semibold">{text.title}</span>
                        <span className="mt-1 block text-sm text-ink-2">{text.summary}</span>
                        <span className="mono mt-2 block text-xs text-ink-3">{t('home.stepsCount', { count: task.steps.length })}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
