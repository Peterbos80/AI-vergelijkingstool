import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { legalDetails, staticSite } from '@/lib/env';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('privacy.title'), description: t('privacy.metaDescription'), alternates: alternates(locale, (l) => href.page(l, 'privacy')) };
}

const SECTIONS = ['analytics', 'match', 'cookie', 'email', 'leads', 'video', 'rights'];
/** Sections that also apply to the static edition. */
const STATIC_SECTIONS = ['video', 'rights'];

export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.page(locale, 'privacy'), pageType: 'static', locale });
  const legal = legalDetails();
  return (
    <article className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('privacy.title')}</h1>
      <div className="prose-aitw mt-4">
        <p className="text-lg">{t('privacy.intro')}</p>
        {staticSite() ? (
          <>
            {/* Free edition: static hosting, no analytics, no cookies, no forms; Match runs in the browser. */}
            <section>
              <h2>{t('static.privacyHostingTitle')}</h2>
              <p>{t('static.privacyHosting')}</p>
            </section>
            <section>
              <h2>{t('static.privacyBrowserTitle')}</h2>
              <p>{t('static.privacyBrowser')}</p>
            </section>
            {STATIC_SECTIONS.map((s) => (
              <section key={s}>
                <h2>{t(`privacy.sections.${s}.title`)}</h2>
                <p>{t(`privacy.sections.${s}.body`)}</p>
              </section>
            ))}
          </>
        ) : (
          SECTIONS.map((s) => (
            <section key={s}>
              <h2>{t(`privacy.sections.${s}.title`)}</h2>
              <p>{t(`privacy.sections.${s}.body`)}</p>
            </section>
          ))
        )}
        {(legal.name || legal.email) && (
          <>
            <h2>{t('privacy.controller')}</h2>
            <p>
              {[legal.name, legal.address].filter(Boolean).join(', ')}
              {legal.email && (
                <>
                  {' '}
                  · <a href={`mailto:${legal.email}`}>{legal.email}</a>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </article>
  );
}
