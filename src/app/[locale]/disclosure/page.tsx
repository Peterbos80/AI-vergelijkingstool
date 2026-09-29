import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';

export async function generateMetadata({ params }: PageProps<'/[locale]/disclosure'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('disclosureInfo.title'), description: t('disclosureInfo.metaDescription'), alternates: alternates(locale, (l) => href.page(l, 'disclosure')) };
}

export default async function DisclosurePage({ params }: PageProps<'/[locale]/disclosure'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.page(locale, 'disclosure'), pageType: 'static', locale });
  const catalog = await getCatalog();
  const ids = await affiliateToolIds();
  const active = [...ids].map((id) => catalog.toolsById.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  return (
    <article className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('disclosureInfo.title')}</h1>
      <div className="prose-aitw mt-4">
        <p className="text-lg">{t('disclosureInfo.intro')}</p>
        <h2>{t('disclosureInfo.affiliateTitle')}</h2>
        <p>{t('disclosureInfo.affiliateBody')}</p>
        <h2>{t('disclosureInfo.clicksTitle')}</h2>
        <p>{t('disclosureInfo.clicksBody')}</p>
        <h2>{t('disclosureInfo.sponsoredTitle')}</h2>
        <p>{t('disclosureInfo.sponsoredBody')}</p>
        <h2>{t('disclosureInfo.neverTitle')}</h2>
        <ul>
          <li>{t('disclosureInfo.never1')}</li>
          <li>{t('disclosureInfo.never2')}</li>
          <li>{t('disclosureInfo.never3')}</li>
        </ul>
        <h2>{t('disclosureInfo.activeTitle')}</h2>
        {active.length === 0 ? (
          <p>{t('disclosureInfo.activeNone')}</p>
        ) : (
          <>
            <p>{t('disclosureInfo.activeCount', { count: active.length })}</p>
            <ul>
              {active.map((x) => (
                <li key={x.id}>
                  <Link href={href.tool(locale, x.slug)}>{x.name}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <p>
          <Link href={href.page(locale, 'methodology')}>{t('receipts.methodologyLink')}</Link>
        </p>
      </div>
    </article>
  );
}
