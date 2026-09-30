import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { staticSite } from '@/lib/env';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { DoctorView } from '@/components/doctor/DoctorView';
import { StaticQueryPage } from '@/components/static/StaticQueryPage';
import { leadAction } from './actions';

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/doctor'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  return {
    title: t('doctor.metaTitle'),
    description: t('doctor.metaDescription'),
    alternates: alternates(locale, (l) => href.doctor(l)),
    robots: Object.keys(sp).length ? { index: false, follow: true } : undefined,
  };
}

export default async function DoctorPage({ params, searchParams }: PageProps<'/[locale]/doctor'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  const catalog = await getCatalog();
  if (staticSite()) {
    return (
      <>
        <noscript>
          <p className="container-page notice notice-warning mt-6">{t('static.needsJs')}</p>
        </noscript>
        <StaticQueryPage kind="doctor" locale={locale} labels={{ loading: t('static.loading'), failed: t('static.failed') }}>
          <DoctorView locale={locale} t={t} catalog={catalog} sp={{}} />
        </StaticQueryPage>
      </>
    );
  }
  await track({ path: href.doctor(locale), pageType: 'doctor', locale });
  return <DoctorView locale={locale} t={t} catalog={catalog} sp={sp} leadAction={leadAction} />;
}
