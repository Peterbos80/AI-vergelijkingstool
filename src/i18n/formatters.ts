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

export function formatDate(date: Date | string | null | undefined, locale: Locale, style: 'short' | 'long' = 'short'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intl(locale), {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam',
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined, locale: Locale): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(intl(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Amsterdam',
  }).format(d);
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
