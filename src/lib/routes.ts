/**
 * Localised URL builders. Route segments are English in every locale;
 * taxonomy slugs are localised (docs/strategy/05 §7).
 */
import type { Locale } from '@/i18n/config';

type Query = Record<string, string | number | boolean | null | undefined | string[]>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === '' || v === false) continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else sp.set(k, v === true ? '1' : String(v));
  }
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

export const href = {
  home: (l: Locale) => `/${l}`,
  match: (l: Locale, q?: Query) => withQuery(`/${l}/match`, q),
  tools: (l: Locale, q?: Query) => withQuery(`/${l}/tools`, q),
  tool: (l: Locale, slug: string) => `/${l}/tools/${slug}`,
  toolPricing: (l: Locale, slug: string) => `/${l}/tools/${slug}/pricing`,
  toolAlternatives: (l: Locale, slug: string) => `/${l}/tools/${slug}/alternatives`,
  compare: (l: Locale, slugs?: string[]) => withQuery(`/${l}/compare`, slugs?.length ? { tools: slugs } : undefined),
  fairFight: (l: Locale, a: string, b: string) => {
    const [x, y] = [a, b].sort();
    return `/${l}/compare/${x}-vs-${y}`;
  },
  tasks: (l: Locale) => `/${l}/tasks`,
  task: (l: Locale, slug: string) => `/${l}/tasks/${slug}`,
  categories: (l: Locale) => `/${l}/categories`,
  category: (l: Locale, slug: string) => `/${l}/categories/${slug}`,
  capability: (l: Locale, slug: string) => `/${l}/capabilities/${slug}`,
  doctor: (l: Locale, q?: Query) => withQuery(`/${l}/doctor`, q),
  stack: (l: Locale, id: string) => `/${l}/stack/${id}`,
  myStack: (l: Locale) => `/${l}/my-stack`,
  pulse: (l: Locale, q?: Query) => withQuery(`/${l}/pulse`, q),
  news: (l: Locale) => `/${l}/news`,
  newsPerson: (l: Locale, person: string) => `/${l}/news/${person}`,
  start: (l: Locale, category?: string, task?: string) => [`/${l}/start`, category, task].filter(Boolean).join('/'),
  page: (
    l: Locale,
    page: 'methodology' | 'disclosure' | 'corrections' | 'newsletter' | 'about' | 'privacy' | 'api' | 'bot',
  ) => `/${l}/${page}`,
  go: (slug: string, q?: { src?: string; pos?: number; mq?: string; l?: Locale }) => withQuery(`/go/${slug}`, q),
};

/** Replace the locale prefix of a path (language switcher). */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split('/');
  if (parts.length > 1) parts[1] = to;
  const out = parts.join('/');
  return out === '' ? `/${to}` : out;
}
