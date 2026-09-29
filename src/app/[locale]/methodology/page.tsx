import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getDb } from '@/lib/db/client';
import { loadSettings } from '@/lib/settings';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Paragraphs } from '@/components/ui/Paragraphs';
import { StatusStamp } from '@/components/data/StatusStamp';

export async function generateMetadata({ params }: PageProps<'/[locale]/methodology'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('methodology.title'), description: t('methodology.metaDescription'), alternates: alternates(locale, (l) => href.page(l, 'methodology')) };
}

export default async function MethodologyPage({ params }: PageProps<'/[locale]/methodology'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  const settings = await loadSettings(getDb());
  await track({ path: href.page(locale, 'methodology'), pageType: 'static', locale });
  return (
    <article className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('methodology.title')}</h1>
      <div className="prose-aitw mt-4">
        <p className="text-lg">{t('methodology.intro')}</p>
        <h2>{t('methodology.rankingTitle')}</h2>
        <Paragraphs text={t('methodology.rankingBody')} />
        <h2>{t('methodology.moneyTitle')}</h2>
        <p>
          {t('methodology.moneyBody')} <Link href={href.page(locale, 'disclosure')}>{t('footer.disclosure')}</Link>
        </p>
        <h2>{t('methodology.statusTitle')}</h2>
        <dl className="space-y-3">
          {(['verified', 'supported', 'community', 'unverified'] as const).map((s) => (
            <div key={s}>
              <dt>
                <StatusStamp status={s} t={t} />
              </dt>
              <dd className="mt-1">{t(`methodology.status${s[0]!.toUpperCase()}${s.slice(1)}`)}</dd>
            </div>
          ))}
        </dl>
        <h2>{t('methodology.confidenceTitle')}</h2>
        <p>{t('methodology.confidenceBody')}</p>
        <h2>{t('methodology.freshnessTitle')}</h2>
        <p>{t('methodology.freshnessBody')}</p>
        <ul>
          {(Object.keys(settings.freshness) as (keyof typeof settings.freshness)[]).map((k) => (
            <li key={k}>
              {t('methodology.freshnessRow', { kind: t(`methodology.freshnessKinds.${k}`), fresh: settings.freshness[k][0], aging: settings.freshness[k][1] })}
            </li>
          ))}
        </ul>
        <h2>{t('methodology.agentsTitle')}</h2>
        <p>{t('methodology.agentsBody')}</p>
        <h2>{t('methodology.aiTitle')}</h2>
        <p>{t('methodology.aiBody')}</p>
        <h2>{t('methodology.limitsTitle')}</h2>
        <p>{t('methodology.limitsBody')}</p>
        <h2>{t('methodology.correctionsTitle')}</h2>
        <p>
          {t('methodology.correctionsBody')} <Link href={href.page(locale, 'corrections')}>{t('footer.corrections')}</Link>
        </p>
      </div>
    </article>
  );
}
