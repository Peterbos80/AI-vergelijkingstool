import type { Metadata } from 'next';
import { enabledLocales, FALLBACK_LOCALE, LOCALE_META, type Locale } from '@/i18n/config';

/**
 * hreflang alternates for a page that exists in the given locales
 * (docs/strategy/05 §7: only locales where the page is indexable; x-default → en).
 */
export function alternates(
  locale: Locale,
  pathFor: (l: Locale) => string,
  availableIn: Locale[] = enabledLocales(),
): Metadata['alternates'] {
  const live = availableIn.filter((l) => enabledLocales().includes(l));
  const languages: Record<string, string> = {};
  for (const l of live) languages[LOCALE_META[l].hreflang] = pathFor(l);
  if (live.includes(FALLBACK_LOCALE)) languages['x-default'] = pathFor(FALLBACK_LOCALE);
  return { canonical: pathFor(locale), languages };
}

export function robots(indexable: boolean): Metadata['robots'] {
  return indexable ? { index: true, follow: true } : { index: false, follow: true };
}

/** Trim to a meta description length on a word boundary. */
export function clip(text: string, max = 158): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
