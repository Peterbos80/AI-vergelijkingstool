import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { legalDetails } from '@/lib/env';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';

/**
 * The page our crawler's user agent points to ("+https://…/bot"): what the bot
 * reads, how it behaves and how a site owner blocks it (docs/DATA_SOURCES.md).
 */
export async function generateMetadata({ params }: PageProps<'/[locale]/bot'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('bot.title'), description: t('bot.metaDescription'), alternates: alternates(locale, (l) => href.page(l, 'bot')) };
}

export default async function BotPage({ params }: PageProps<'/[locale]/bot'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.page(locale, 'bot'), pageType: 'static', locale });
  const email = legalDetails().email;
  return (
    <article className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('bot.title')}</h1>
      <div className="prose-aitw mt-4">
        <p className="text-lg">{t('bot.intro')}</p>
        <h2>{t('bot.whatTitle')}</h2>
        <ul>
          <li>{t('bot.what1')}</li>
          <li>{t('bot.what2')}</li>
          <li>{t('bot.what3')}</li>
          <li>{t('bot.what4')}</li>
        </ul>
        <h2>{t('bot.howTitle')}</h2>
        <ul>
          <li>{t('bot.how1')}</li>
          <li>{t('bot.how2')}</li>
          <li>{t('bot.how3')}</li>
          <li>{t('bot.how4')}</li>
        </ul>
        <h2>{t('bot.storeTitle')}</h2>
        <p>{t('bot.storeBody')}</p>
        <h2>{t('bot.blockTitle')}</h2>
        <p>{t('bot.blockBody')}</p>
        <pre data-testid="bot-robots">{'User-agent: AIToolsWijzerBot\nDisallow: /'}</pre>
        <h2>{t('bot.contactTitle')}</h2>
        <p>
          {email && (
            <>
              {t('bot.contactEmail', { email })}{' '}
            </>
          )}
          <Link href={href.page(locale, 'corrections')}>{t('bot.contactCorrections')}</Link>
        </p>
      </div>
    </article>
  );
}
