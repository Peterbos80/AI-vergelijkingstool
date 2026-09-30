import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { href } from '@/lib/routes';
import type { CatalogStats } from '@/lib/catalog/types';
import { Logo } from './Logo';

export function Footer({ locale, t, stats, newsletter }: { locale: Locale; t: Translator; stats: CatalogStats | null; newsletter: boolean }) {
  const cols: { label: string; href: string }[][] = [
    [
      { label: t('nav.match'), href: href.home(locale) },
      { label: t('nav.explore'), href: href.tools(locale) },
      { label: t('footer.tasks'), href: href.tasks(locale) },
      { label: t('footer.categories'), href: href.categories(locale) },
      { label: t('start.breadcrumb'), href: href.start(locale) },
      { label: t('nav.news'), href: href.news(locale) },
      { label: t('footer.pulse'), href: href.pulse(locale) },
    ],
    [
      { label: t('footer.methodology'), href: href.page(locale, 'methodology') },
      { label: t('footer.disclosure'), href: href.page(locale, 'disclosure') },
      { label: t('footer.corrections'), href: href.page(locale, 'corrections') },
      { label: t('footer.api'), href: href.page(locale, 'api') },
    ],
    [
      ...(newsletter ? [{ label: t('footer.newsletter'), href: href.page(locale, 'newsletter') }] : []),
      { label: t('footer.about'), href: href.page(locale, 'about') },
      { label: t('footer.privacy'), href: href.page(locale, 'privacy') },
    ],
  ];
  return (
    <footer className="mt-24 border-t border-line bg-paper-2">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2 font-bold">
            <Logo /> {t('meta.siteName')}
          </div>
          <p className="mt-2 text-sm text-ink-2">{t('meta.tagline')}</p>
          <p className="mt-4 text-sm text-ink-3">{t('footer.explanation')}</p>
          {stats && stats.tools > 0 && (
            <p className="mono mt-4 text-xs text-ink-3">
              {t('footer.dataLine', {
                tools: formatNumber(stats.tools, locale),
                facts: formatNumber(stats.facts + stats.plans, locale),
                date: formatDate(stats.lastCheckAt, locale),
              })}
            </p>
          )}
        </div>
        {cols.map((col, i) => (
          <nav key={i} aria-label={t('a11y.footerNav')}>
            <ul className="space-y-2 text-sm">
              {col.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-ink-2 no-underline hover:text-ink hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
