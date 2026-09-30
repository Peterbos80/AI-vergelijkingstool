import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getDb } from '@/lib/db/client';
import { latestNews, NEWS_PEOPLE, NEWS_SOURCES, peopleCounts, type NewsItem } from '@/lib/news';
import { logError } from '@/lib/ops/errors';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { NewsList } from '@/components/news/NewsList';

export async function generateMetadata({ params }: PageProps<'/[locale]/news'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('news.metaTitle'), description: t('news.metaDescription'), alternates: alternates(locale, (l) => href.news(l)) };
}

export default async function NewsPage({ params }: PageProps<'/[locale]/news'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.news(locale), pageType: 'news', locale });
  let items: NewsItem[] = [];
  let counts = new Map<string, number>();
  try {
    [items, counts] = await Promise.all([latestNews(getDb(), { limit: 60 }), peopleCounts(getDb())]);
  } catch (err) {
    await logError('app', 'news: unavailable', err);
  }
  const articles = items.filter((n) => n.kind === 'article');
  const videos = items.filter((n) => n.kind === 'video');
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('news.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('news.intro')}</p>

      <section className="mt-8" aria-labelledby="voices">
        <h2 id="voices" className="eyebrow">
          {t('news.voices')}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {NEWS_PEOPLE.map((p) => (
            <li key={p.id}>
              <Link href={href.newsPerson(locale, p.id)} className="chip">
                {p.name}
                {(counts.get(p.id) ?? 0) > 0 && <span className="mono text-xs text-ink-3">{counts.get(p.id)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {items.length === 0 ? (
        <p className="notice mt-8">{t('news.empty')}</p>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
          <section aria-labelledby="articles">
            <h2 id="articles" className="text-xl">
              {t('news.articles')}
            </h2>
            {articles.length ? <NewsList items={articles} t={t} locale={locale} /> : <p className="mt-3 text-sm text-ink-3">{t('news.emptyArticles')}</p>}
          </section>
          <section aria-labelledby="videos">
            <h2 id="videos" className="text-xl">
              {t('news.videos')}
            </h2>
            {videos.length ? <NewsList items={videos} t={t} locale={locale} compact /> : <p className="mt-3 text-sm text-ink-3">{t('news.emptyVideos')}</p>}
          </section>
        </div>
      )}

      <section className="mt-12 border-t border-line pt-6 text-sm text-ink-3" aria-labelledby="news-sources">
        <h2 id="news-sources" className="eyebrow">
          {t('news.sourcesTitle')}
        </h2>
        <p className="mt-2 max-w-3xl">{t('news.sourcesBody')}</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {NEWS_SOURCES.map((s) => (
            <li key={s.id}>
              <a href={s.homepage} rel="nofollow noopener noreferrer" target="_blank">
                {s.name}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
