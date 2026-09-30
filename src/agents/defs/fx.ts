/** FX agent: daily ECB euro reference rates (public XML, no key). */
import { XMLParser } from 'fast-xml-parser';
import { fxRates } from '@/lib/db/schema';
import type { AgentDefinition } from '../types';

export const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

export function parseEcb(xml: string): { day: string; rates: { quote: string; rate: number }[] } | null {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' }).parse(xml) as Record<string, unknown>;
  const envelope = (doc['gesmes:Envelope'] ?? doc.Envelope) as Record<string, unknown> | undefined;
  const outer = envelope?.Cube as { Cube?: { time?: string; Cube?: { currency: string; rate: string }[] | { currency: string; rate: string } } } | undefined;
  const day = outer?.Cube?.time;
  const list = outer?.Cube?.Cube;
  if (!day || !list) return null;
  const arr = Array.isArray(list) ? list : [list];
  const rates = arr
    .map((c) => ({ quote: String(c.currency), rate: Number(c.rate) }))
    .filter((r) => /^[A-Z]{3}$/.test(r.quote) && Number.isFinite(r.rate) && r.rate > 0);
  return rates.length ? { day, rates } : null;
}

export const fxAgent: AgentDefinition = {
  name: 'fx',
  description: 'Loads daily ECB reference rates for indicative euro conversions.',
  schedule: 'daily:16:40',
  autonomy: 'auto',
  maxItems: 1,
  timeoutMs: 60_000,
  async run(ctx) {
    const res = await ctx.fetcher.get(ECB_URL, { accept: 'xml' });
    if (!res.ok) return { status: 'failed', summary: `ECB fetch failed: ${res.errorKind} ${res.error ?? ''}` };
    const parsed = parseEcb(res.body);
    if (!parsed) return { status: 'failed', summary: 'ECB XML not understood' };
    const inserted = await ctx.db
      .insert(fxRates)
      .values(parsed.rates.map((r) => ({ day: parsed.day, quote: r.quote, rate: String(r.rate), sourceUrl: ECB_URL })))
      .onConflictDoNothing()
      .returning({ q: fxRates.quote });
    ctx.stat('rates', inserted.length);
    return { status: 'success', summary: `${parsed.day}: ${inserted.length} new rates`, dataChanged: inserted.length > 0 };
  },
};
