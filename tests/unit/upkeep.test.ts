/**
 * Keeping tools current: finding a tool's official pricing page, and the
 * new-tool policy (setting, environment override, hard maximum).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pricingLinkOf } from '@/agents/lib/tool-sources';
import { newToolPolicy, SCOUT_LIMITS } from '@/agents/lib/scout/config';
import { DEFAULT_SETTINGS, mergeSetting } from '@/lib/settings/defaults';

const page = (links: [string, string][]) => ({ links: links.map(([href, text]) => ({ href, text })) });

describe('official pricing page on the home page', () => {
  it('takes a pricing path on the same site, preferring the path over the link text', () => {
    expect(pricingLinkOf(page([['https://www.acme.ai/plans-and-more', 'Pricing'], ['https://www.acme.ai/pricing?utm_source=nav#top', 'See plans']]), 'https://acme.ai/')).toBe('https://www.acme.ai/pricing');
    expect(pricingLinkOf(page([['https://app.acme.ai/billing', 'Prijzen']]), 'https://acme.ai/')).toBe('https://app.acme.ai/billing');
    expect(pricingLinkOf(page([['https://www.acme.ai/nl/prijzen/', 'Bekijk']]), 'https://acme.ai/')).toBe('https://www.acme.ai/nl/prijzen/');
  });
  it('never takes another site, plain http, or an unrelated link', () => {
    expect(pricingLinkOf(page([['https://reseller.example/pricing', 'Pricing']]), 'https://acme.ai/')).toBeNull();
    expect(pricingLinkOf(page([['http://acme.ai/pricing', 'Pricing']]), 'https://acme.ai/')).toBeNull();
    expect(pricingLinkOf(page([['https://acme.ai/blog/pricing-is-hard-for-startups', 'Our blog']]), 'https://acme.ai/')).toBeNull();
    expect(pricingLinkOf(page([['https://acme.ai/about', 'About']]), 'https://acme.ai/')).toBeNull();
  });
});

describe('new-tool policy', () => {
  afterEach(() => {
    delete process.env.NEW_TOOL_MODE;
    delete process.env.NEW_TOOLS_PER_DAY;
  });
  it('defaults to 10 tools a day; the setting allows at most 25', () => {
    expect(DEFAULT_SETTINGS.policy.newToolsPerDay).toBe(10);
    expect(mergeSetting('policy', { newToolsPerDay: 25 }).newToolsPerDay).toBe(25);
    expect(mergeSetting('policy', { newToolsPerDay: 26 }).newToolsPerDay).toBe(10); // invalid → default
    expect(mergeSetting('policy', { newToolMode: 'quarantine' }).newToolMode).toBe('quarantine');
    expect(SCOUT_LIMITS.anomalyPerDay).toBe(25);
  });
  it('lets the environment override the setting, and ignores invalid values', () => {
    expect(newToolPolicy(DEFAULT_SETTINGS)).toEqual({ mode: 'queue', perDay: 10, from: { mode: 'setting', perDay: 'setting' } });
    process.env.NEW_TOOL_MODE = 'quarantine';
    process.env.NEW_TOOLS_PER_DAY = '12';
    expect(newToolPolicy(DEFAULT_SETTINGS)).toEqual({ mode: 'quarantine', perDay: 12, from: { mode: 'env', perDay: 'env' } });
    process.env.NEW_TOOLS_PER_DAY = '400';
    expect(newToolPolicy(DEFAULT_SETTINGS).perDay).toBe(25);
    process.env.NEW_TOOL_MODE = 'publish-everything';
    process.env.NEW_TOOLS_PER_DAY = 'many';
    expect(newToolPolicy(DEFAULT_SETTINGS)).toMatchObject({ mode: 'queue', perDay: 10 });
  });
});
