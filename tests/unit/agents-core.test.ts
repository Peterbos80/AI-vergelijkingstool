import { describe, expect, it } from 'vitest';
import { anchorQuote, checkPlan, pricesNearPlan } from '@/agents/lib/anchor';
import { isBlockedIp, checkUrlShape, assertPublicHost } from '@/agents/fetcher/ssrf';
import { isAllowed, parseRobots } from '@/agents/fetcher/robots';
import { htmlToText } from '@/agents/fetcher/text';
import { decide, priceHardRule } from '@/agents/policy';
import { anomalyVerdict } from '@/agents/anomaly';
import { nextRun, validSchedule } from '@/agents/schedule';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';

const PAGE = htmlToText(
  `<html><head><title>Pricing</title><script>var x="$999"</script></head><body>
   <div><h3>Free</h3><p>$0 / month</p><p>10 minutes of audio</p></div>
   <div><h3>Starter</h3><p>$6 /month</p><p>30 minutes</p></div>
   <div><h3>Creator</h3><p>$22/month</p><p>or $18/month billed annually</p></div>
   <div><h3>Pro</h3><p>$99 per month</p></div></body></html>`,
  'https://example.com/pricing',
).text;

describe('evidence anchoring', () => {
  it('finds verbatim and fuzzy quotes', () => {
    expect(anchorQuote(PAGE, 'Creator $22/month').kind).toBe('verbatim');
    expect(anchorQuote(PAGE, 'Creator $22 / month or $18 per month billed annually').kind).not.toBe('verbatim');
    expect(anchorQuote(PAGE, 'Enterprise $5000').kind).toBe('none');
  });
  it('ignores script content and reads prices next to plan names', () => {
    const c = pricesNearPlan(PAGE, 'Creator');
    expect(c[0]!.cents).toBe(2200);
    expect(c.some((x) => x.cents === 99900)).toBe(false);
  });
  const PLANS = ['Free', 'Starter', 'Creator', 'Pro'];
  it('confirms known prices, detects a single changed price, and refuses ambiguity', () => {
    expect(checkPlan(PAGE, { name: 'Creator', priceCents: 2200, annualMonthlyCents: 1800, currency: 'USD', isFree: false }, PLANS).kind).toBe('confirmed');
    expect(checkPlan(PAGE, { name: 'Starter', priceCents: 500, annualMonthlyCents: null, currency: 'USD', isFree: false }, PLANS)).toMatchObject({ kind: 'changed', cents: 600 });
    expect(checkPlan(PAGE, { name: 'Free', priceCents: 0, annualMonthlyCents: null, currency: 'USD', isFree: true }, PLANS).kind).toBe('confirmed');
    expect(checkPlan(PAGE, { name: 'Business', priceCents: 5000, annualMonthlyCents: null, currency: 'USD', isFree: false }).kind).toBe('not_found');
    const twoPrices = 'Team plan: $30 per month. Team add-on: $45 per month for extra seats and $60 per month for SSO.';
    expect(checkPlan(twoPrices, { name: 'Team', priceCents: 2500, annualMonthlyCents: null, currency: 'USD', isFree: false }).kind).toBe('ambiguous');
  });
});

describe('SSRF guard', () => {
  it('blocks private, loopback, link-local, metadata and ULA addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
    for (const ip of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) expect(isBlockedIp(ip), ip).toBe(false);
  });
  it('rejects bad URL shapes', () => {
    expect(checkUrlShape('ftp://example.com')).toBeNull();
    expect(checkUrlShape('https://user:pw@example.com')).toBeNull();
    expect(checkUrlShape('https://example.com:8443/')).toBeNull();
    expect(checkUrlShape('http://localhost/')).toBeNull();
    expect(checkUrlShape('https://example.com/pricing')).not.toBeNull();
  });
  it('checks resolved addresses (DNS rebinding to private IPs is blocked)', async () => {
    await expect(assertPublicHost('evil.example', async () => ['93.184.216.34', '10.0.0.5'])).rejects.toThrow(/blocked/);
    await expect(assertPublicHost('ok.example', async () => ['93.184.216.34'])).resolves.toBeUndefined();
  });
});

describe('robots.txt', () => {
  const txt = 'User-agent: *\nDisallow: /private\nAllow: /private/public$\n\nUser-agent: AIToolsWijzerBot\nDisallow: /no-bots\n';
  it('uses the specific group for our bot and longest-match rules', () => {
    const ours = parseRobots(txt, 'AIToolsWijzerBot/1.0 (+https://aitoolswijzer.nl/bot)');
    expect(isAllowed(ours, '/no-bots/page')).toBe(false);
    expect(isAllowed(ours, '/private')).toBe(true); // specific group replaces *
    const other = parseRobots(txt, 'OtherBot');
    expect(isAllowed(other, '/private/x')).toBe(false);
    expect(isAllowed(other, '/private/public')).toBe(true);
    expect(isAllowed(other, '/pricing')).toBe(true);
  });
});

describe('policy and anomaly guard', () => {
  const p = DEFAULT_SETTINGS.policy;
  it('maps confidence bands and risk classes to decisions', () => {
    expect(decide({ confidence: 97, risk: 'R1', autonomy: 'auto' }, p).decision).toBe('auto_published');
    expect(decide({ confidence: 85, risk: 'R1', autonomy: 'auto' }, p).decision).toBe('auto_published_flagged');
    expect(decide({ confidence: 85, risk: 'R2', autonomy: 'auto' }, p).decision).toBe('queued');
    expect(decide({ confidence: 70, risk: 'R1', autonomy: 'auto' }, p).decision).toBe('queued');
    expect(decide({ confidence: 40, risk: 'R1', autonomy: 'auto' }, p).decision).toBe('needs_human');
    expect(decide({ confidence: 99, risk: 'R3', autonomy: 'auto' }, p).decision).toBe('needs_human');
    expect(decide({ confidence: 99, risk: 'R1', autonomy: 'queue_only' }, p).decision).toBe('queued');
    expect(decide({ confidence: 99, risk: 'R1', autonomy: 'auto', hardRule: 'x' }, p).decision).toBe('needs_human');
  });
  it('applies price hard rules', () => {
    expect(priceHardRule(2000, 3100, p)).toBe('price_increase_over_limit');
    expect(priceHardRule(2000, 2500, p)).toBeNull();
    expect(priceHardRule(2000, 500, p)).toBe('price_decrease_over_limit');
    expect(priceHardRule(0, 900, p)).toBe('free_to_paid');
  });
  it('freezes runs with anomalous change volumes', () => {
    const s = DEFAULT_SETTINGS.anomaly;
    expect(anomalyVerdict([{ toolId: 'a', kind: 'price' }], 100, s).freeze).toBe(false);
    const many = Array.from({ length: 30 }, (_, i) => ({ toolId: `t${i}`, kind: 'price' as const }));
    const v = anomalyVerdict(many, 100, s);
    expect(v.freeze).toBe(true);
    expect(v.severity).toBe('p1');
  });
});

describe('schedules (Europe/Amsterdam)', () => {
  it('computes the next run', () => {
    expect(validSchedule('daily:03:10')).toBe(true);
    expect(validSchedule('hourly')).toBe(false);
    const base = new Date('2026-09-29T12:00:00Z'); // 14:00 in Amsterdam (CEST)
    expect(nextRun('every:15m', base).toISOString()).toBe('2026-09-29T12:15:00.000Z');
    expect(nextRun('daily:03:10', base).toISOString()).toBe('2026-09-30T01:10:00.000Z');
    expect(nextRun('weekly:1:07:00', base).toISOString()).toBe('2026-10-05T05:00:00.000Z');
    expect(nextRun('daily:03:10', new Date('2026-12-01T12:00:00Z')).toISOString()).toBe('2026-12-02T02:10:00.000Z'); // CET
  });
});
