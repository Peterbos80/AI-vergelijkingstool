import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog, taskSlug, taskTextOf } from '@/lib/catalog';
import { findLearnGuide, LEARN, learnText } from '@/content/learn';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export async function generateMetadata({ params }: PageProps<'/[locale]/learn/[slug]'>): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const g = findLearnGuide(decodeURIComponent(slug), locale);
  const x = g ? learnText(g, locale) : null;
  if (!g || !x) return {};
  return {
    title: x.title,
    description: x.summary,
    alternates: alternates(locale, (l) => href.learn(l, learnText(g, l)?.slug ?? x.slug), Object.keys(g.text) as Locale[]),
  };
}

export default async function LearnGuidePage({ params }: PageProps<'/[locale]/learn/[slug]'>) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const g = findLearnGuide(decodeURIComponent(slug), locale);
  const x = g ? learnText(g, locale) : null;
  if (!g || !x) notFound();
  if (x.slug !== decodeURIComponent(slug)) permanentRedirect(href.learn(locale, x.slug));
  const t = getT(locale);
  await track({ path: href.learn(locale, x.slug), pageType: 'learn', locale, entityId: g.id });
  const catalog = await getCatalog();
  const tasks = g.tasks.map((id) => catalog.tasksById.get(id)).filter((v): v is NonNullable<typeof v> => Boolean(v));
  const others = LEARN.filter((o) => o.id !== g.id);
  return (
    <article className="container-page py-8">
      <Breadcrumbs t={t} items={[{ label: t('learn.title'), href: href.learn(locale) }, { label: x.title }]} />
      <p className="mono mt-6 text-xs text-ink-3">{t('learn.minutes', { n: g.minutes })}</p>
      <h1 className="mt-1 text-3xl md:text-4xl">{x.title}</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">{x.summary}</p>
      <div className="prose-aitw mt-8">
        {x.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
            {s.bullets && (
              <ul>
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {tasks.length > 0 && (
        <section className="mt-10" aria-labelledby="learn-tasks">
          <h2 id="learn-tasks" className="eyebrow">
            {t('learn.tryIt')}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link href={href.task(locale, taskSlug(task, locale))} className="chip">
                  {taskTextOf(task, locale).title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav className="mt-10 border-t border-line pt-6" aria-labelledby="learn-more">
        <h2 id="learn-more" className="eyebrow">
          {t('learn.more')}
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {others.map((o) => {
            const ox = learnText(o, locale);
            return ox ? (
              <li key={o.id}>
                <Link href={href.learn(locale, ox.slug)}>{ox.title}</Link>
              </li>
            ) : null;
          })}
          <li>
            <Link href={href.glossary(locale)}>{t('glossary.title')}</Link>
          </li>
        </ul>
      </nav>
    </article>
  );
}
