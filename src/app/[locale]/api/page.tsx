import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { siteUrl } from '@/lib/env';
import { track } from '@/lib/analytics/track';

export async function generateMetadata({ params }: PageProps<'/[locale]/api'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('apiPage.title'), description: t('apiPage.metaDescription'), alternates: alternates(locale, (l) => href.page(l, 'api')) };
}

export default async function ApiDocsPage({ params }: PageProps<'/[locale]/api'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.page(locale, 'api'), pageType: 'static', locale });
  const endpoints: [string, string][] = [
    [`/api/v1/tools?locale=${locale}`, t('apiPage.tools')],
    [`/api/v1/tools/elevenlabs?locale=${locale}`, t('apiPage.tool')],
    [`/api/v1/tasks?locale=${locale}`, t('apiPage.tasks')],
    [`/api/v1/changes?locale=${locale}`, t('apiPage.changes')],
  ];
  return (
    <article className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('apiPage.title')}</h1>
      <div className="prose-aitw mt-4">
        <p className="text-lg">{t('apiPage.intro')}</p>
        <h2>{t('apiPage.endpoints')}</h2>
        <ul>
          {endpoints.map(([path, desc]) => (
            <li key={path}>
              <code className="text-sm">GET {path}</code> — {desc}{' '}
              <a href={siteUrl(path)} rel="nofollow">
                ↗
              </a>
            </li>
          ))}
        </ul>
        <h2>{t('apiPage.terms')}</h2>
        <p>{t('apiPage.termsBody')}</p>
        <p>{t('apiPage.llms')}</p>
      </div>
    </article>
  );
}
