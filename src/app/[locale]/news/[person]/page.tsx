import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getDb } from '@/lib/db/client';
import { latestNews, NEWS_PEOPLE, newsPerson, personRole, type NewsItem } from '@/lib/news';
import { logError } from '@/lib/ops/errors';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { NewsList } from '@/components/news/NewsList';

export async function generateMetadata({ params }: PageProps<'/[locale]/news/[person]'>): Promise<Metadata> {
  const { locale, person } = (await params) as { locale: Locale; person: string };
  const p = newsPerson(person);
  if (!p) return {};
  const t = getT(locale);
  return {
    title: t('news.personMetaTitle', { name: p.name }),
    description: t('news.personMetaDescription', { name: p.name, role: personRole(p, locale) }),
    alternates: alternates(locale, (l) => href.newsPerson(l, p.id)),
  };
}

export default async function NewsPersonPage({ params }: PageProps<'/[locale]/news/[person]'>) {
  const { locale, person } = (await params) as { locale: Locale; person: string };
  const p = newsPerson(person);
  if (!p) notFound();
  const t = getT(locale);
  await track({ path: href.newsPerson(locale, p.id), pageType: 'news', locale });
  let items: NewsItem[] = [];
  try {
    items = await latestNews(getDb(), { limit: 50, person: p.id });
  } catch (err) {
    await logError('app', 'news person: unavailable', err);
  }
  const others = NEWS_PEOPLE.filter((x) => x.id !== p.id);
  return (
    <div className="container-page py-8">
      <Breadcrumbs t={t} items={[{ label: t('news.title'), href: href.news(locale) }, { label: p.name }]} />
      <h1 className="mt-6 text-3xl md:text-4xl">{p.name}</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">{personRole(p, locale)}</p>
      <section className="mt-8" aria-labelledby="person-news">
        <h2 id="person-news" className="text-xl">
          {t('news.personLatest', { name: p.name })}
        </h2>
        {items.length ? <NewsList items={items} t={t} locale={locale} /> : <p className="notice mt-3">{t('news.personEmpty', { name: p.name })}</p>}
      </section>
      <nav className="mt-12" aria-labelledby="other-voices">
        <h2 id="other-voices" className="eyebrow">
          {t('news.otherVoices')}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {others.map((x) => (
            <li key={x.id}>
              <Link href={href.newsPerson(locale, x.id)} className="chip">
                {x.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
