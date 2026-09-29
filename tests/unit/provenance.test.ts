import { describe, expect, it } from 'vitest';
import { clampStatus, computeConfidence, countIndependent, maxStatus, sourceDomain } from '@/lib/provenance/confidence';
import { freshnessOf, toolFreshness } from '@/lib/provenance/freshness';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';

const now = new Date('2026-09-29T12:00:00Z');

describe('computeConfidence', () => {
  it('scores an anchored official source highly', () => {
    const c = computeConfidence({ sourceTypes: ['official'], anchor: 'verbatim', observedAt: now, now, method: 'agent' });
    expect(c).toBe(95);
  });
  it('penalises unanchored web-search evidence', () => {
    const c = computeConfidence({
      sourceTypes: ['official', 'secondary', 'secondary'],
      anchor: 'none',
      observedAt: now,
      now,
      method: 'web_search',
      independentSources: 3,
    });
    // 0.95 × 0.6 × 1 × 0.9 + 0.08 = 0.593
    expect(c).toBe(59);
  });
  it('decays with age', () => {
    const old = new Date(now.getTime() - 100 * 86_400_000);
    const c = computeConfidence({ sourceTypes: ['official'], anchor: 'verbatim', observedAt: old, now, method: 'agent' });
    expect(c).toBe(76);
  });
  it('caps confidence when a sanity check fails', () => {
    const c = computeConfidence({
      sourceTypes: ['official'],
      anchor: 'verbatim',
      observedAt: now,
      now,
      method: 'agent',
      sanityFailed: true,
    });
    expect(c).toBe(40);
  });
  it('returns 0 without sources', () => {
    expect(computeConfidence({ sourceTypes: [], anchor: 'verbatim', observedAt: now, now, method: 'agent' })).toBe(0);
  });
});

describe('status ceiling', () => {
  it('never allows VERIFIED without verbatim anchoring on an official source', () => {
    expect(maxStatus({ sourceTypes: ['official'], anchor: 'none', confidence: 99 })).toBe('supported');
    expect(maxStatus({ sourceTypes: ['secondary', 'media'], anchor: 'verbatim', confidence: 99 })).toBe('supported');
    expect(maxStatus({ sourceTypes: ['official'], anchor: 'verbatim', confidence: 95 })).toBe('verified');
  });
  it('treats a single secondary source as unverified and social-only as community', () => {
    expect(maxStatus({ sourceTypes: ['secondary'], anchor: 'none', confidence: 40 })).toBe('unverified');
    expect(maxStatus({ sourceTypes: ['social', 'community'], anchor: 'none', confidence: 30 })).toBe('community');
  });
  it('clamps claimed statuses down, never up', () => {
    expect(clampStatus('verified', 'supported')).toBe('supported');
    expect(clampStatus('unverified', 'verified')).toBe('unverified');
  });
  it('counts independent sources by registrable domain', () => {
    expect(sourceDomain('https://www.example.co.uk/a')).toBe('example.co.uk');
    expect(countIndependent(['https://a.com/x', 'https://blog.a.com/y', 'https://b.io'])).toBe(2);
  });
});

describe('freshness', () => {
  const rules = DEFAULT_SETTINGS.freshness;
  it('classifies price age using the configured limits', () => {
    expect(freshnessOf(new Date(now.getTime() - 3 * 86_400_000), 'price', rules, now)).toBe('fresh');
    expect(freshnessOf(new Date(now.getTime() - 20 * 86_400_000), 'price', rules, now)).toBe('aging');
    expect(freshnessOf(new Date(now.getTime() - 60 * 86_400_000), 'price', rules, now)).toBe('stale');
    expect(freshnessOf(null, 'price', rules, now)).toBe('unknown');
  });
  it('takes the worst of price and website, ignoring unchecked websites', () => {
    expect(toolFreshness('fresh', 'stale')).toBe('stale');
    expect(toolFreshness('aging', 'unknown')).toBe('aging');
    expect(toolFreshness('unknown', 'fresh')).toBe('unknown');
  });
});
