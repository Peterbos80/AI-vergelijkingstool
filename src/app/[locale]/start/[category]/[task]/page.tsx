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
import { TaskGuideCard } from '@/components/start/TaskGuideCard';

export async function generateMetadata({ params }: PageProps<'/[locale]/start/[category]/[task]'>): Promise<Metadata> {
  const { locale, category, task } = (await params) as { locale: Locale; category: string; task: string };
  const catalog = await getCatalog();
  const cat = findBySlug(catalog.categories, decodeURIComponent(category), locale);
  const x = findBySlug(catalog.tasks, decodeURIComponent(task), locale);
  if (!cat || !x || x.categoryId !== cat.id) return {};
  const t = getT(locale);
  const text = taskTextOf(x, locale);
  return {
    title: t('start.metaTitle3', { task: text.title }),
    description: taskGuide(x.id, locale)?.what ?? text.summary ?? undefined,
    alternates: alternates(locale, (l) => href.start(l, nameOf(cat, l).slug, taskSlug(x, l)), Object.keys(x.text) as Locale[]),
    // The task page is the canonical, indexable version of this content.
    robots: robots(false),
  };
}

/** Step 3 of 3: the plain-language guide, then two questions that lead to a personal stack. */
export default async function StartTaskPage({ params }: PageProps<'/[locale]/start/[category]/[task]'>) {
  const { locale, category, task } = (await params) as { locale: Locale; category: string; task: string };
  const catalog = await getCatalog();
  const cat = findBySlug(catalog.categories, decodeURIComponent(category), locale);
  const x = findBySlug(catalog.tasks, decodeURIComponent(task), locale);
  if (!cat || !x || x.categoryId !== cat.id) notFound();
  const catSlug = nameOf(cat, locale).slug;
  const tSlug = taskSlug(x, locale);
  if (catSlug !== decodeURIComponent(category) || tSlug !== decodeURIComponent(task)) permanentRedirect(href.start(locale, catSlug, tSlug));
  const t = getT(locale);
  await track({ path: href.start(locale, catSlug, tSlug), pageType: 'start', locale, entityId: x.id });
  const text = taskTextOf(x, locale);
  const guide = taskGuide(x.id, locale);
  const area = t.has(`start.cat.${cat.id}`) ? t(`start.cat.${cat.id}`) : nameOf(cat, locale).name;
  return (
    <div className="container-page py-8">
      <Breadcrumbs
        t={t}
        items={[
          { label: t('start.breadcrumb'), href: href.start(locale) },
          { label: area, href: href.start(locale, catSlug) },
          { label: text.title },
        ]}
      />
      <p className="mono mt-6 text-xs text-ink-3">{t('start.step', { n: 3 })}</p>
      <h1 className="mt-1 text-3xl md:text-4xl">{text.title}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('start.intro3')}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        {guide ? <TaskGuideCard guide={guide} t={t} /> : <p className="text-ink-2">{text.summary}</p>}
        <form method="get" action={href.match(locale)} className="card h-fit p-5">
          <input type="hidden" name="q" value={text.title} />
          <input type="hidden" name="task" value={x.id} />
          <fieldset>
            <legend className="font-semibold">{t('start.budgetQ')}</legend>
            {(['free', '25', 'any'] as const).map((b, i) => (
              <label key={b} className="mt-2 flex items-center gap-2 text-sm">
                <input type="radio" name="b" value={b} defaultChecked={i === 0} className="h-4 w-4 accent-[var(--accent)]" />
                {t(`start.budget.${b}`)}
              </label>
            ))}
          </fieldset>
          <fieldset className="mt-5">
            <legend className="font-semibold">{t('start.levelQ')}</legend>
            {(['beginner', 'intermediate', 'advanced'] as const).map((l, i) => (
              <label key={l} className="mt-2 flex items-center gap-2 text-sm">
                <input type="radio" name="lvl" value={l} defaultChecked={i === 0} className="h-4 w-4 accent-[var(--accent)]" />
                {t(`start.level.${l}`)}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn mt-6 w-full">
            {t('start.submit')} →
          </button>
          <p className="mt-3 text-xs text-ink-3">{t('start.submitNote')}</p>
        </form>
      </div>
      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href={href.start(locale, catSlug)}>← {t('start.back')}</Link>
        <Link href={href.task(locale, tSlug)}>{t('start.fullTask')} →</Link>
      </p>
    </div>
  );
}
