/**
 * Price normalisation. Prices are stored as integer minor units (cents) in
 * the vendor's currency; conversions to EUR use ECB reference rates and are
 * always labelled as approximations in the UI.
 */
import type { BillingPeriod } from '@/lib/db/schema';

export function toCents(major: number | null | undefined): number | null {
  if (major === null || major === undefined || Number.isNaN(major)) return null;
  return Math.round(major * 100);
}

/** Monthly equivalent of a price, or null when not comparable per month. */
export function monthlyEquivalentCents(priceCents: number | null, period: BillingPeriod): number | null {
  if (priceCents === null) return null;
  switch (period) {
    case 'month':
      return priceCents;
    case 'year':
      return Math.round(priceCents / 12);
    default:
      return null;
  }
}

/**
 * ECB rates are quoted as 1 EUR = rate × QUOTE. Converting an amount in QUOTE
 * to EUR divides by the rate. Returns null when the rate is unknown.
 */
export function toEurCents(amountCents: number, currency: string, rates: ReadonlyMap<string, number>): number | null {
  const cur = currency.toUpperCase();
  if (cur === 'EUR') return amountCents;
  const rate = rates.get(cur);
  if (!rate || rate <= 0) return null;
  return Math.round(amountCents / rate);
}

export interface Priced {
  cents: number;
  currency: string;
}

/** Sum amounts per currency (no silent conversion). */
export function sumByCurrency(items: readonly Priced[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) out.set(it.currency, (out.get(it.currency) ?? 0) + it.cents);
  return out;
}
