import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { LEARN, learnText } from '@/content/learn';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';

export async function generateMetadata({ params }: PageProps<'/[locale]/learn'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('learn.metaTitle'), description: t('learn.metaDescription'), alternates: alternates(locale, (l) => href.learn(l)) };
}

/** "AI for beginners": the guides, the glossary and the step-by-step finder. */
export default async function LearnPage({ params }: PageProps<'/[locale]/learn'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.learn(locale), pageType: 'learn', locale });
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('learn.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('learn.intro')}</p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {LEARN.map((g) => {
          const x = learnText(g, locale);
          if (!x) return null;
          return (
            <li key={g.id}>
              <Link href={href.learn(locale, x.slug)} className="start-card">
                <span className="mono block text-xs text-ink-3">{t('learn.minutes', { n: g.minutes })}</span>
                <span className="mt-1 block text-lg font-semibold text-ink">{x.title}</span>
                <span className="mt-1 block text-sm text-ink-2">{x.summary}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href={href.glossary(locale)} className="start-card">
            <span className="mono block text-xs text-ink-3">A–Z</span>
            <span className="mt-1 block text-lg font-semibold text-ink">{t('glossary.title')}</span>
            <span className="mt-1 block text-sm text-ink-2">{t('glossary.teaser')}</span>
          </Link>
        </li>
        <li>
          <Link href={href.start(locale)} className="start-card">
            <span className="mono block text-xs text-ink-3">1 · 2 · 3</span>
            <span className="mt-1 block text-lg font-semibold text-ink">{t('start.breadcrumb')}</span>
            <span className="mt-1 block text-sm text-ink-2">{t('start.metaDescription')}</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
