/**
 * Locale registry. `enabled` locales are routed, listed in sitemaps and shown
 * in the language switcher. Disabled locales are fully configured (messages,
 * formatting) but stay dark until translation coverage passes the gate in
 * Admin → Content (see docs/strategy/11-mvp-roadmap.md, NOT NOW #14).
 *
 * ENABLED_LOCALES (env, comma separated) overrides the defaults, e.g. for a
 * staging environment that previews German.
 */
export const LOCALES = ['nl', 'en', 'de', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'nl';
/** Locale used for x-default hreflang and as the first content fallback. */
export const FALLBACK_LOCALE: Locale = 'en';

export interface LocaleMeta {
  label: string;
  hreflang: string;
  intl: string;
  defaultEnabled: boolean;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  nl: { label: 'Nederlands', hreflang: 'nl', intl: 'nl-NL', defaultEnabled: true },
  en: { label: 'English', hreflang: 'en', intl: 'en-GB', defaultEnabled: true },
  de: { label: 'Deutsch', hreflang: 'de', intl: 'de-DE', defaultEnabled: false },
  fr: { label: 'Français', hreflang: 'fr', intl: 'fr-FR', defaultEnabled: false },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function envEnabled(): Locale[] | null {
  const raw = typeof process !== 'undefined' ? process.env.ENABLED_LOCALES : undefined;
  if (!raw) return null;
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(isLocale);
  return list.length ? list : null;
}

export function enabledLocales(): Locale[] {
  return envEnabled() ?? LOCALES.filter((l) => LOCALE_META[l].defaultEnabled);
}

export function isEnabledLocale(value: unknown): value is Locale {
  return isLocale(value) && enabledLocales().includes(value);
}

/** Content fallback chain: requested → en → nl. */
export function fallbackChain(locale: Locale): Locale[] {
  const chain: Locale[] = [locale];
  if (!chain.includes(FALLBACK_LOCALE)) chain.push(FALLBACK_LOCALE);
  if (!chain.includes(DEFAULT_LOCALE)) chain.push(DEFAULT_LOCALE);
  return chain;
}

/** Pick the best enabled locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  const enabled = enabledLocales();
  if (!acceptLanguage) return enabled.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : enabled[0]!;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag: (tag ?? '').toLowerCase(), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    const hit = enabled.find((l) => l === base);
    if (hit) return hit;
  }
  return enabled.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : enabled[0]!;
}
