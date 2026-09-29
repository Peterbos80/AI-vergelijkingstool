import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { legalDetails } from '@/lib/env';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';

export async function generateMetadata({ params }: PageProps<'/[locale]/about'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('about.title'), description: t('about.metaDescription'), alternates: alternates(locale, (l) => href.page(l, 'about')) };
}

export default async function AboutPage({ params }: PageProps<'/[locale]/about'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.page(locale, 'about'), pageType: 'static', locale });
  const legal = legalDetails();
  const rows = [
    ['legalName', legal.name],
    ['legalKvk', legal.kvk],
    ['legalAddress', legal.address],
    ['legalEmail', legal.email],
  ].filter(([, v]) => Boolean(v)) as [string, string][];
  return (
    <article className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('about.title')}</h1>
      <div className="prose-aitw mt-4">
        <p className="text-lg">{t('about.intro')}</p>
        <h2>{t('about.howTitle')}</h2>
        <p>
          {t('about.howBody')} <Link href={href.page(locale, 'methodology')}>{t('receipts.methodologyLink')}</Link>
        </p>
        <h2>{t('about.contactTitle')}</h2>
        {rows.length > 0 && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{t(`about.${k}`)}</dt>
                <dd>{k === 'legalEmail' ? <a href={`mailto:${v}`}>{v}</a> : v}</dd>
              </div>
            ))}
          </dl>
        )}
        <p>
          {t('about.contactFallback')} <Link href={href.page(locale, 'corrections')}>{t('footer.corrections')}</Link> ·{' '}
          <Link href={href.doctor(locale)}>{t('nav.doctor')}</Link>
        </p>
      </div>
    </article>
  );
}
