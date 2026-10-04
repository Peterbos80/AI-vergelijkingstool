/**
 * Dates are written with fixed month names (src/i18n/formatters.ts), not with
 * the ICU of whatever runs the code: an older browser writes "29 sep. 2026"
 * where the server wrote "29 sep 2026", and React then renders that part of a
 * client component again. These are the strings the server writes.
 */
import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDayMonth } from '@/i18n/formatters';

const at = (iso: string) => new Date(iso);

describe('dates', () => {
  it('write the day, the month as it stands in a date, and the year', () => {
    expect(formatDate(at('2026-09-29T10:00:00Z'), 'nl')).toBe('29 sep 2026');
    expect(formatDate(at('2026-03-01T10:00:00Z'), 'nl')).toBe('1 mrt 2026');
    expect(formatDate(at('2026-05-04T10:00:00Z'), 'nl', 'long')).toBe('4 mei 2026');
    expect(formatDate(at('2026-09-29T10:00:00Z'), 'en')).toBe('29 Sept 2026');
    expect(formatDate(at('2026-09-29T10:00:00Z'), 'en', 'long')).toBe('29 September 2026');
    expect(formatDate(at('2026-09-29T10:00:00Z'), 'de')).toBe('29. Sept. 2026');
    expect(formatDate(at('2026-03-15T10:00:00Z'), 'de')).toBe('15. März 2026');
    expect(formatDate(at('2026-09-29T10:00:00Z'), 'fr')).toBe('29 sept. 2026');
  });

  it('count the day in Amsterdam, through summer time and back', () => {
    // 23:30 UTC on 28 Sep is 01:30 on 29 Sep in Amsterdam (summer time); on 31 Dec it is 00:30 on 1 Jan.
    expect(formatDate(at('2026-09-28T23:30:00Z'), 'nl')).toBe('29 sep 2026');
    expect(formatDate(at('2026-12-31T23:30:00Z'), 'nl')).toBe('1 jan 2027');
    expect(formatDateTime(at('2026-03-29T00:59:00Z'), 'nl')).toBe('29 mrt 2026, 01:59');
    expect(formatDateTime(at('2026-03-29T01:00:00Z'), 'nl')).toBe('29 mrt 2026, 03:00');
    expect(formatDateTime(at('2026-10-25T00:30:00Z'), 'en')).toBe('25 Oct 2026, 02:30');
    expect(formatDateTime(at('2026-10-25T01:30:00Z'), 'en')).toBe('25 Oct 2026, 02:30');
  });

  it('write a day and month, and a date with its time', () => {
    expect(formatDayMonth(at('2026-09-29T10:00:00Z'), 'nl')).toBe('29 sep');
    expect(formatDayMonth(at('2026-09-29T10:00:00Z'), 'de')).toBe('29. Sept.');
    expect(formatDateTime(at('2026-09-29T10:05:00Z'), 'nl')).toBe('29 sep 2026, 12:05');
    expect(formatDateTime(at('2026-05-03T22:30:00Z'), 'nl')).toBe('4 mei 2026, 00:30');
    expect(formatDateTime(at('2026-09-29T10:05:00Z'), 'de')).toBe('29.09.2026, 12:05');
    expect(formatDateTime(at('2026-09-29T10:05:00Z'), 'fr')).toBe('29 sept. 2026, 12:05');
  });

  it('take a date as text too, and say "—" when there is none', () => {
    expect(formatDate('2026-09-29', 'nl')).toBe('29 sep 2026');
    expect(formatDate(null, 'nl')).toBe('—');
    expect(formatDate('no date', 'nl')).toBe('—');
    expect(formatDayMonth(undefined, 'en')).toBe('—');
    expect(formatDateTime('no date', 'en')).toBe('—');
  });
});
