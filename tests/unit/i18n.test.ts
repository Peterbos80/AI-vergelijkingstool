import { describe, expect, it } from 'vitest';
import { formatMessage, flattenKeys } from '@/i18n/format';
import { negotiateLocale, fallbackChain } from '@/i18n/config';
import { MESSAGES } from '@/i18n/server';

describe('formatMessage', () => {
  it('interpolates and pluralises', () => {
    const tpl = '{count, plural, =0 {geen tools} one {# tool} other {# tools}}';
    expect(formatMessage(tpl, { count: 0 }, 'nl-NL')).toBe('geen tools');
    expect(formatMessage(tpl, { count: 1 }, 'nl-NL')).toBe('1 tool');
    expect(formatMessage(tpl, { count: 12 }, 'nl-NL')).toBe('12 tools');
    expect(formatMessage('Hallo {name}', { name: 'Ada' })).toBe('Hallo Ada');
  });
});

describe('locales', () => {
  it('negotiates from Accept-Language with nl as default', () => {
    expect(negotiateLocale('en-US,en;q=0.9')).toBe('en');
    expect(negotiateLocale('de-DE,de;q=0.9')).toBe('nl');
    expect(negotiateLocale(null)).toBe('nl');
  });
  it('falls back requested → en → nl', () => {
    expect(fallbackChain('de')).toEqual(['de', 'en', 'nl']);
  });
  it('nl and en message catalogs have identical keys (no hardcoded gaps)', () => {
    const nl = new Set(flattenKeys(MESSAGES.nl));
    const en = new Set(flattenKeys(MESSAGES.en));
    expect([...nl].filter((k) => !en.has(k))).toEqual([]);
    expect([...en].filter((k) => !nl.has(k))).toEqual([]);
  });
});
