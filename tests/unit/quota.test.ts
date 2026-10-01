/**
 * Limit parser (src/lib/pricing/quota.ts): explicit cases from the brief, and
 * a table over every real limit text in data/tools. The table is a file
 * snapshot (__snapshots__/quota-table.txt): a new or changed limit text in the
 * data changes it, so a person reviews what the parser reads before it ships.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { annualBillingOnly, parseQuota, parseQuotaClauses, parseSeats, type QuotaClause } from '@/lib/pricing/quota';

function describeClause(c: QuotaClause): string {
  if (c.kind === 'usage_price') return `usage price ${c.price!.amount} ${c.price!.currency} per ${c.unit}${c.subject ? ` [${c.subject}]` : ''}${c.bound === 'from' ? ' (from)' : ''}`;
  if (c.kind === 'unlimited') return `unlimited${c.subject ? ` [${c.subject}]` : ''}`;
  const amount = `${c.approximate ? '≈' : ''}${c.amount}${c.max !== null ? `–${c.max}` : ''}`;
  const extra = [
    c.perUser ? 'per user' : null,
    c.bound !== 'exact' && c.bound !== 'range' ? c.bound.replace('_', ' ') : null,
    ...c.flags,
  ].filter(Boolean);
  const time =
    c.minutesPerMonth !== null
      ? ` → ${Math.round(c.minutesPerMonth * 100) / 100} min/month`
      : c.minutes !== null
        ? ` → ${c.minutes} min ${c.per === 'total' ? 'one-off' : `per ${c.per}`}, not a monthly budget`
        : '';
  return `${amount} ${c.unit} ${c.per === 'total' ? 'in total' : `per ${c.per}`}${c.subject ? ` [${c.subject}]` : ''}${extra.length ? ` (${extra.join(', ')})` : ''}${time}`;
}

interface Row {
  id: string;
  quota: string;
}

function realQuotas(): Row[] {
  const dir = path.resolve(process.cwd(), 'data/tools');
  const rows: Row[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const tool = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { slug: string; plans?: { key: string; quota?: string }[] };
    for (const p of tool.plans ?? []) if (p.quota) rows.push({ id: `${tool.slug}/${p.key}`, quota: p.quota });
  }
  return rows;
}

describe('quota parser: cases from the brief', () => {
  it('reads minutes and hours per month', () => {
    expect(parseQuota('300 minutes per month')).toMatchObject({ amount: 300, unit: 'minute', per: 'month', approximate: false, unlimited: false, minutesPerMonth: 300 });
    expect(parseQuota('9 hours per month')).toMatchObject({ amount: 9, unit: 'hour', per: 'month', minutesPerMonth: 540 });
    expect(parseQuota('1,500 minutes per month')?.minutesPerMonth).toBe(1500);
  });
  it('turns a yearly time limit into minutes per month', () => {
    const q = parseQuota('24 hours of voice generation per year, commercial rights');
    expect(q).toMatchObject({ amount: 24, unit: 'hour', per: 'year', subject: 'voice generation', minutesPerMonth: 120 });
  });
  it('reads a usage price', () => {
    expect(parseQuota('€10 per audio hour')).toMatchObject({ kind: 'usage_price', unit: 'hour', subject: 'audio', price: { amount: 10, currency: 'EUR' }, minutesPerMonth: null });
  });
  it('marks "About … per user per month" as approximate and per user', () => {
    expect(parseQuota('About 10 hours of media per user per month')).toMatchObject({
      amount: 10,
      unit: 'hour',
      per: 'month',
      approximate: true,
      perUser: true,
      subject: 'media',
      minutesPerMonth: 600,
    });
  });
  it('never turns daily, weekly or one-off limits into a monthly budget', () => {
    expect(parseQuota('Enhance Speech 1 hour per day, files up to 30 minutes')).toMatchObject({ per: 'day', minutes: 60, minutesPerMonth: null, subject: 'enhance speech' });
    expect(parseQuota('2 AI minutes per week, watermarked exports')).toMatchObject({ per: 'week', minutesPerMonth: null });
    expect(parseQuota('10 minutes of voice generation in total, no downloads')).toMatchObject({ per: 'total', minutes: 10, minutesPerMonth: null });
    expect(parseQuota('2 one-off hours')).toMatchObject({ per: 'total', minutes: 120, minutesPerMonth: null });
    expect(parseQuota('10 lifetime AI credits')).toMatchObject({ per: 'total', unit: 'credit' });
  });
  it('reads "Unlimited …" as the maker says it', () => {
    expect(parseQuota('Unlimited transcription')).toMatchObject({ kind: 'unlimited', unlimited: true, amount: null, subject: 'transcription' });
  });
  it('keeps credits as credits and leaves ambiguous text unknown', () => {
    expect(parseQuota('30,000 credits per month; instant voice cloning')).toMatchObject({ amount: 30000, unit: 'credit', per: 'month', minutesPerMonth: null });
    expect(parseQuota('600 credits, videos up to 30 minutes, voice cloning, no watermark')).toBeNull();
    expect(parseQuota('About 15 fast GPU hours')).toBeNull(); // no period
    expect(parseQuota('10–60 cloud tasks per 5-hour window')).toBeNull();
    expect(parseQuota('30 posts per month per platform')).toBeNull();
    expect(parseQuota('5× Plus limits')).toBeNull();
    expect(parseQuota('Higher limits than Free')).toBeNull();
    expect(parseQuota('')).toBeNull();
    expect(parseQuota(null)).toBeNull();
  });
  it('reads limits inside brackets, ranges and notes', () => {
    expect(parseQuota('1080p, no watermark, auto subtitles (144 hours/year)')).toMatchObject({ amount: 144, per: 'year', subject: 'auto subtitles', minutesPerMonth: 720 });
    expect(parseQuota('500–700 message credits per month')).toMatchObject({ amount: 500, max: 700, approximate: true, bound: 'range' });
    expect(parseQuota('96 hours of voice generation per year (annual plan)')?.flags).toEqual(['annual_plan']);
    expect(parseQuota('40 images per month (reported)')).toMatchObject({ approximate: true, flags: ['reported'] });
    expect(parseQuota('1M tokens per month with a daily limit')).toMatchObject({ amount: 1_000_000, flags: ['daily_limit'] });
  });
  it('returns every clause in order', () => {
    expect(parseQuotaClauses('Unlimited recordings and transcription, 5 AI summaries per month').map((c) => c.kind)).toEqual(['unlimited', 'allowance']);
  });
  it('reads seat rules and annual-only billing', () => {
    expect(parseSeats('Two-seat minimum')).toEqual({ min: 2, max: null });
    expect(parseSeats('2–150 seats')).toEqual({ min: 2, max: 150 });
    expect(parseSeats('2,000 tasks per month, up to 25 users')).toEqual({ min: null, max: 25 });
    expect(parseSeats('Priced per editor')).toBeNull();
    expect(annualBillingOnly('Annual billing only')).toBe(true);
    expect(annualBillingOnly('Annual: €59.89 per year')).toBe(false);
  });
});

describe('quota parser: every real limit text in data/tools', () => {
  const rows = realQuotas();
  it('has the limit texts of the dataset', () => {
    expect(rows.length).toBeGreaterThan(200);
  });
  it('matches the reviewed table (which parse and which do not)', async () => {
    const lines = rows.map((r) => {
      const clauses = parseQuotaClauses(r.quota);
      return `${r.id} | ${r.quota} | ${clauses.length ? clauses.map(describeClause).join(' ; ') : '— (not parsed: unknown stays unknown)'}`;
    });
    const parsed = rows.filter((r) => parseQuotaClauses(r.quota).length).length;
    const monthlyTime = rows.filter((r) => parseQuotaClauses(r.quota).some((c) => c.minutesPerMonth !== null)).length;
    const header = [
      `# Limit texts in data/tools: ${rows.length}; with at least one parsed limit: ${parsed}; not parsed: ${rows.length - parsed}; with minutes per month: ${monthlyTime}.`,
      '# plan | limit text | what the parser reads',
    ];
    await expect([...header, ...lines].join('\n') + '\n').toMatchFileSnapshot('./__snapshots__/quota-table.txt');
  });
});
