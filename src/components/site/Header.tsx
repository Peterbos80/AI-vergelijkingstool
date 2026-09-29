import Link from 'next/link';
import { enabledLocales, LOCALE_META, type Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { href, switchLocalePath } from '@/lib/routes';
import { Logo } from './Logo';

export function Header({ locale, t, pathname }: { locale: Locale; t: Translator; pathname: string }) {
  const links = [
    { href: href.home(locale), label: t('nav.match'), active: pathname === `/${locale}` || pathname.startsWith(`/${locale}/match`) },
    { href: href.tools(locale), label: t('nav.explore'), active: pathname.startsWith(`/${locale}/tools`) },
    { href: href.compare(locale), label: t('nav.compare'), active: pathname.startsWith(`/${locale}/compare`) },
    { href: href.doctor(locale), label: t('nav.doctor'), active: pathname.startsWith(`/${locale}/doctor`) },
    { href: href.pulse(locale), label: t('nav.pulse'), active: pathname.startsWith(`/${locale}/pulse`) },
  ];
  const locales = enabledLocales();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="container-page flex h-14 items-center gap-4">
        <Link href={href.home(locale)} className="flex items-center gap-2 no-underline" aria-label={t('meta.siteName')}>
          <Logo />
          <span className="font-bold tracking-tight">{t('meta.siteName')}</span>
        </Link>
        <nav aria-label={t('a11y.mainNav')} className="ml-2 hidden md:block">
          <ul className="flex items-center gap-1 text-[0.9375rem]">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={l.active ? 'page' : undefined}
                  className={`rounded-md px-2.5 py-1.5 no-underline hover:bg-paper-2 ${l.active ? 'font-semibold text-ink' : 'text-ink-2'}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <form action={href.tools(locale)} method="get" role="search" className="hidden lg:block">
            <label htmlFor="header-search" className="visually-hidden">
              {t('nav.searchLabel')}
            </label>
            <input
              id="header-search"
              name="q"
              type="search"
              placeholder={t('nav.search')}
              className="input h-9 min-h-0 w-56 py-1 text-sm"
              autoComplete="off"
            />
          </form>
          {locales.length > 1 && (
            <nav aria-label={t('a11y.languageSwitcher')}>
              <ul className="flex items-center gap-0.5 font-mono text-xs">
                {locales.map((l) => (
                  <li key={l}>
                    <Link
                      href={switchLocalePath(pathname, l)}
                      hrefLang={LOCALE_META[l].hreflang}
                      lang={l}
                      aria-current={l === locale ? 'true' : undefined}
                      title={LOCALE_META[l].label}
                      className={`rounded px-1.5 py-1 uppercase no-underline ${l === locale ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2'}`}
                      prefetch={false}
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <details className="relative md:hidden">
            <summary className="btn btn-ghost btn-sm list-none" aria-label={t('a11y.openMenu')}>
              {t('nav.menu')}
            </summary>
            <nav
              aria-label={t('a11y.mainNav')}
              className="card absolute right-0 top-11 z-50 w-56 p-2 shadow-lg"
            >
              <ul className="flex flex-col">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={l.active ? 'page' : undefined}
                      className="block rounded-md px-3 py-2 no-underline hover:bg-paper-2"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href={href.tasks(locale)} className="block rounded-md px-3 py-2 no-underline hover:bg-paper-2">
                    {t('nav.tasks')}
                  </Link>
                </li>
              </ul>
              <form action={href.tools(locale)} method="get" role="search" className="mt-2 border-t border-line pt-2">
                <label htmlFor="mobile-search" className="visually-hidden">
                  {t('nav.searchLabel')}
                </label>
                <input id="mobile-search" name="q" type="search" placeholder={t('nav.search')} className="input text-sm" />
              </form>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
