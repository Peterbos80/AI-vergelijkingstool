import { describe, expect, it } from 'vitest';
import { clientIp } from '@/lib/analytics/visitor';
import { bearer, safeEqual } from '@/lib/security/secrets';

describe('client address for rate limits', () => {
  const h = (xff?: string, realIp?: string) => new Headers({ ...(xff ? { 'x-forwarded-for': xff } : {}), ...(realIp ? { 'x-real-ip': realIp } : {}) });

  it('ignores addresses a client prepends to X-Forwarded-For', () => {
    expect(clientIp(h('6.6.6.6, 203.0.113.9'), 1)).toBe('203.0.113.9');
    expect(clientIp(h('1.1.1.1, 2.2.2.2, 203.0.113.9'), 1)).toBe('203.0.113.9');
  });
  it('counts trusted proxy hops from the right', () => {
    expect(clientIp(h('6.6.6.6, 198.51.100.7, 203.0.113.9'), 2)).toBe('198.51.100.7');
    expect(clientIp(h('198.51.100.7'), 3)).toBe('198.51.100.7');
  });
  it('falls back to x-real-ip, then a fixed bucket', () => {
    expect(clientIp(h(undefined, '192.0.2.1'), 1)).toBe('192.0.2.1');
    expect(clientIp(h(), 1)).toBe('0.0.0.0');
  });
});

describe('secret comparison', () => {
  it('compares in constant time and parses bearer tokens', () => {
    expect(safeEqual('a-long-secret-value', 'a-long-secret-value')).toBe(true);
    expect(safeEqual('a-long-secret-value', 'a-long-secret-valuf')).toBe(false);
    expect(safeEqual('short', 'a-long-secret-value')).toBe(false);
    expect(bearer('Bearer abc.def')).toBe('abc.def');
    expect(bearer('Basic abc')).toBeNull();
    expect(bearer(null)).toBeNull();
  });
});
