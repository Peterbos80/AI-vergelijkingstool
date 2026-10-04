import { LOCALE_META, type Locale } from './config';

const intl = (locale: Locale) => LOCALE_META[locale].intl;

/** Format an amount in minor units (cents). */
export function formatMoney(
  cents: number | null | undefined,
  currency: string | null | undefined,
  locale: Locale,
  opts: { compact?: boolean } = {},
): string {
  if (cents === null || cents === undefined || !currency) return '—';
  const value = cents / 100;
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat(intl(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: opts.compact ? 0 : fractionDigits,
    maximumFractionDigits: opts.compact ? 0 : 2,
  }).format(value);
}

export function formatNumber(n: number, locale: Locale, maxFractionDigits = 0): string {
  return new Intl.NumberFormat(intl(locale), { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function formatPercent(fraction: number, locale: Locale): string {
  return new Intl.NumberFormat(intl(locale), { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

/**
 * Month names as they stand in a date, fixed here instead of taken from Intl:
 * every browser ships its own ICU, and an older one writes "29 sep. 2026"
 * where the server wrote "29 sep 2026". In a client component React then
 * finds other text than the server sent and renders that part again (React
 * error #418 in the WebKit of iOS 17, 3 Oct 2026). These are the names
 * Node 22 writes, so the server's output does not change.
 */
const MONTHS: Record<Locale, { short: readonly string[]; long: readonly string[] }> = {
  nl: {
    short: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
    long: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
  },
  en: {
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'],
    long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
  de: {
    short: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
    long: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  },
  fr: {
    short: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    long: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
};

const AMSTERDAM = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

/** The calendar day and time of a moment in Amsterdam: digits only, the same in every ICU. */
function inAmsterdam(date: Date | string | null | undefined): { y: number; m: number; d: number; hh: number; mm: number } | null {
  if (!date) return null;
  const at = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(at.getTime())) return null;
  const parts = AMSTERDAM.formatToParts(at);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { y: n('year'), m: n('month'), d: n('day'), hh: n('hour') % 24, mm: n('minute') };
}

/** "29 sep" / "29 Sept" / "29. Sept." / "29 sept.": the day and month as they stand in a date. */
function dayAndMonth(t: { m: number; d: number }, locale: Locale, style: 'short' | 'long'): string {
  const month = MONTHS[locale][style][t.m - 1];
  return locale === 'de' ? `${t.d}. ${month}` : `${t.d} ${month}`;
}

export function formatDate(date: Date | string | null | undefined, locale: Locale, style: 'short' | 'long' = 'short'): string {
  const t = inAmsterdam(date);
  return t ? `${dayAndMonth(t, locale, style)} ${t.y}` : '—';
}

/** Day and month only ("29 sep"), for dense rows where the year is evident. */
export function formatDayMonth(date: Date | string | null | undefined, locale: Locale): string {
  const t = inAmsterdam(date);
  return t ? dayAndMonth(t, locale, 'short') : '—';
}

export function formatDateTime(date: Date | string | null | undefined, locale: Locale): string {
  const t = inAmsterdam(date);
  if (!t) return '—';
  const two = (n: number) => String(n).padStart(2, '0');
  const time = `${two(t.hh)}:${two(t.mm)}`;
  // German writes a date with a time as numbers ("29.09.2026, 12:05").
  return locale === 'de' ? `${two(t.d)}.${two(t.m)}.${t.y}, ${time}` : `${formatDate(date, locale)}, ${time}`;
}

/** "3 days ago" / "3 dagen geleden". */
export function formatRelative(date: Date | string | null | undefined, locale: Locale, now = new Date()): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(intl(locale), { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}
