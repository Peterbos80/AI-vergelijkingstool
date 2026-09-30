import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { grotesk, plexMono } from '../fonts';
import { isEnabledLocale, LOCALE_META, type Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { EVENT_ICON, eventTitle } from '@/lib/catalog/events';
import { href } from '@/lib/routes';
import { emailEnabled, siteUrl } from '@/lib/env';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { PulseTicker, type TickerItem } from '@/components/site/PulseTicker';
import { logError } from '@/lib/ops/errors';
import { LEVEL_SCRIPT } from '@/lib/levels';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isEnabledLocale(locale)) return {};
  const t = getT(locale);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t('meta.defaultTitle'), template: t('meta.titleTemplate', { title: '%s' }) },
    description: t('meta.defaultDescription'),
    applicationName: t('meta.siteName'),
    openGraph: { siteName: t('meta.siteName'), locale: LOCALE_META[locale].intl.replace('-', '_'), type: 'website' },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0c' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale: raw } = await params;
  if (!isEnabledLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = getT(locale);
  const h = await headers();
  const pathname = h.get('x-pathname') ?? `/${locale}`;
  const nonce = h.get('x-nonce') ?? undefined;

  let tickerItems: TickerItem[] = [];
  let stats = null;
  try {
    const catalog = await getCatalog();
    stats = catalog.stats;
    tickerItems = catalog.events
      .filter((e) => e.significance >= 50)
      .slice(0, 12)
      .map((e) => {
        const tool = e.toolId ? catalog.toolsById.get(e.toolId) : undefined;
        return {
          id: e.id,
          icon: EVENT_ICON[e.kind],
          text: tool ? `${tool.name} — ${eventTitle(e, locale)}` : eventTitle(e, locale),
          href: tool ? href.tool(locale, tool.slug) : href.pulse(locale),
        };
      });
  } catch (err) {
    await logError('app', 'layout: catalog unavailable', err);
  }

  return (
    // data-level is set before paint by LEVEL_SCRIPT (the visitor's view level), so React must not complain about it.
    <html lang={locale} className={`${grotesk.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: LEVEL_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <a href="#main" className="skip-link">
          {t('a11y.skipToContent')}
        </a>
        <Header locale={locale} t={t} pathname={pathname} />
        <PulseTicker
          items={tickerItems}
          allHref={href.pulse(locale)}
          labels={{ region: t('ticker.label'), pause: t('ticker.pause'), play: t('ticker.play'), all: t('ticker.all') }}
        />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer locale={locale} t={t} stats={stats} newsletter={emailEnabled()} />
      </body>
    </html>
  );
}
