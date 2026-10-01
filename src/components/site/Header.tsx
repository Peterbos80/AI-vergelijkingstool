import Link from 'next/link';
import { enabledLocales, LOCALE_META, type Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { href, switchLocalePath } from '@/lib/routes';
import { LevelTabs } from '@/components/level/LevelTabs';
import { Logo } from './Logo';
import { SearchDialog } from './SearchDialog';
import { SiteMenu } from './SiteMenu';

/**
 * Site header: logo, five navigation items, search, the view level and the
 * language. Below 1024px: logo, search and a full-screen menu. Nothing in it
 * may make the page wider than the viewport (tests/e2e/layout.spec.ts).
 */
export function Header({ locale, t, pathname, pulseCount = 0 }: { locale: Locale; t: Translator; pathname: string; pulseCount?: number }) {
  const under = (...paths: string[]) => paths.some((p) => pathname === `/${locale}/${p}` || pathname.startsWith(`/${locale}/${p}/`));
  const links = [
    { key: 'explore', href: href.tools(locale), label: t('nav.explore'), active: under('tools', 'categories', 'capabilities', 'tasks') },
    { key: 'compare', href: href.compare(locale), label: t('nav.compare'), active: under('compare', 'costs') },
    { key: 'doctor', href: href.doctor(locale), label: t('nav.doctor'), active: under('doctor') },
    { key: 'pulse', href: href.pulse(locale), label: t('nav.pulse'), active: under('pulse', 'news'), count: pulseCount },
    { key: 'learn', href: href.learn(locale), label: t('nav.learn'), active: under('learn', 'glossary', 'start') },
  ];
  const more = [
    { href: href.home(locale), label: t('nav.match') },
    { href: href.tasks(locale), label: t('nav.tasks') },
    { href: href.costs(locale), label: t('nav.costs') },
    { href: href.start(locale), label: t('start.breadcrumb') },
    { href: href.news(locale), label: t('nav.news') },
    { href: href.glossary(locale), label: t('glossary.title') },
  ];
  // Changes of the last 30 days next to Pulse (hidden at 0); the number changes daily, so it is marked dynamic.
  const count = (n: number | undefined) =>
    n ? (
      <span className="nav-count" data-dynamic="" title={t('nav.pulseCount', { count: n })}>
        <span aria-hidden="true">{n}</span>
        <span className="visually-hidden">{t('nav.pulseCount', { count: n })}</span>
      </span>
    ) : null;
  const locales = enabledLocales();
  const levelLabels = { group: t('hub.levelGroup'), basisHint: t('hub.levelBasisHint'), advancedHint: t('hub.levelAdvancedHint') };

  return (
    <header className="site-header">
      <div className="container-page site-header-bar">
        <Link href={href.home(locale)} className="site-logo" aria-label={t('meta.siteName')}>
          <Logo />
          <span>{t('meta.siteName')}</span>
        </Link>

        <nav aria-label={t('a11y.mainNav')} className="site-nav">
          <ul>
            {links.map((l) => (
              <li key={l.key}>
                <Link href={l.href} aria-current={l.active ? 'page' : undefined} className="site-nav-link">
                  {l.label}
                  {count(l.count)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-tools">
          <SearchDialog
            action={href.tools(locale)}
            labels={{ button: t('nav.search'), label: t('nav.searchLabel'), placeholder: t('nav.search'), submit: t('nav.searchSubmit'), close: t('common.close') }}
          />
          <div className="site-level">
            <LevelTabs compact labels={{ ...levelLabels, basis: t('hub.levelBasisShort'), advanced: t('hub.levelAdvancedShort') }} />
          </div>
          {locales.length > 1 && (
            <nav aria-label={t('a11y.languageSwitcher')} className="site-lang">
              <ul>
                {locales.map((l) => (
                  <li key={l}>
                    <Link
                      href={switchLocalePath(pathname, l)}
                      hrefLang={LOCALE_META[l].hreflang}
                      lang={l}
                      aria-current={l === locale ? 'true' : undefined}
                      title={LOCALE_META[l].label}
                      prefetch={false}
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <SiteMenu
            labels={{ menu: t('nav.menu'), open: t('a11y.openMenu'), close: t('a11y.closeMenu') }}
            brand={
              <Link href={href.home(locale)} className="site-logo" aria-label={t('meta.siteName')}>
                <Logo />
                <span>{t('meta.siteName')}</span>
              </Link>
            }
          >
            <nav aria-label={t('a11y.mainNav')}>
              <ul className="site-menu-list">
                {links.map((l) => (
                  <li key={l.key}>
                    <Link href={l.href} aria-current={l.active ? 'page' : undefined} className="site-menu-link">
                      {l.label}
                      {count(l.count)}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="eyebrow mt-8">{t('common.more')}</p>
              <ul className="site-menu-list site-menu-list-more">
                {more.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} aria-current={pathname === l.href ? 'page' : undefined} className="site-menu-link">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="site-menu-section">
              <p className="eyebrow">{t('hub.levelGroup')}</p>
              <div className="mt-2">
                <LevelTabs labels={{ ...levelLabels, basis: t('hub.levelBasis'), advanced: t('hub.levelAdvanced') }} />
              </div>
            </div>
            {locales.length > 1 && (
              <nav aria-label={t('a11y.languageSwitcher')} className="site-menu-section">
                <p className="eyebrow">{t('a11y.languageSwitcher')}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {locales.map((l) => (
                    <li key={l}>
                      <Link
                        href={switchLocalePath(pathname, l)}
                        hrefLang={LOCALE_META[l].hreflang}
                        lang={l}
                        aria-current={l === locale ? 'true' : undefined}
                        className={`chip ${l === locale ? 'chip-active' : ''}`}
                        prefetch={false}
                      >
                        {LOCALE_META[l].label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <search className="site-menu-section">
              <form action={href.tools(locale)} method="get">
                <label htmlFor="menu-search" className="eyebrow block">
                  {t('nav.searchLabel')}
                </label>
                <div className="mt-2 flex gap-2">
                  <input id="menu-search" name="q" type="search" placeholder={t('nav.search')} autoComplete="off" enterKeyHint="search" className="input" />
                  <button type="submit" className="btn">
                    {t('nav.searchSubmit')}
                  </button>
                </div>
              </form>
            </search>
          </SiteMenu>
        </div>
      </div>
    </header>
  );
}
