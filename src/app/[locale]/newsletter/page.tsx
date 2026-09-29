import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { emailEnabled } from '@/lib/env';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { NewsletterForm } from '@/components/forms/NewsletterForm';

export async function generateMetadata({ params }: PageProps<'/[locale]/newsletter'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return {
    title: t('newsletter.metaTitle'),
    description: t('newsletter.metaDescription'),
    alternates: alternates(locale, (l) => href.page(l, 'newsletter')),
    robots: emailEnabled() ? undefined : { index: false, follow: true },
  };
}

export default async function NewsletterPage({ params }: PageProps<'/[locale]/newsletter'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.page(locale, 'newsletter'), pageType: 'static', locale });
  return (
    <div className="container-page grid gap-10 py-12 md:grid-cols-2">
      <div>
        <h1 className="text-3xl md:text-4xl">{t('newsletter.title')}</h1>
        <p className="mt-3 text-ink-2">{t('newsletter.intro')}</p>
        <h2 className="eyebrow mt-6">{t('newsletter.what')}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>→ {t('newsletter.what1')}</li>
          <li>→ {t('newsletter.what2')}</li>
          <li>→ {t('newsletter.what3')}</li>
        </ul>
      </div>
      <div className="card p-6">
        {emailEnabled() ? <NewsletterForm locale={locale} t={t} /> : <p className="text-ink-2">{t('newsletter.unavailable')}</p>}
        <p className="mt-4 text-xs text-ink-3">
          {t('newsletter.privacy')} <Link href={href.page(locale, 'privacy')}>{t('footer.privacy')}</Link>
        </p>
      </div>
    </div>
  );
}
