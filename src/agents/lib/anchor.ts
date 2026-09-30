/**
 * Evidence anchoring (docs/strategy/08 §7): find a quote verbatim (or nearly)
 * on a fetched page, and read prices next to plan names. Conservative by
 * design: ambiguous pages produce no change, only "re-anchoring needed".
 */
import { normalizeText } from '../fetcher/text';

export type AnchorResult = { kind: 'verbatim' | 'fuzzy' | 'none'; snippet: string | null };

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9$€£.,/]+/).filter(Boolean);
}

const flat = (s: string) => normalizeText(s).replace(/\s+/g, ' ').toLowerCase();

export function anchorQuote(pageText: string, quote: string): AnchorResult {
  const page = flat(pageText);
  const q = flat(quote);
  if (!q) return { kind: 'none', snippet: null };
  const idx = page.indexOf(q);
  if (idx >= 0) return { kind: 'verbatim', snippet: page.slice(Math.max(0, idx - 20), idx + q.length + 20) };
  // Fuzzy: sliding window over page words with ≥ 90% token overlap.
  const qw = words(q);
  const pw = words(page);
  if (qw.length < 3) return { kind: 'none', snippet: null };
  const need = new Map<string, number>();
  for (const w of qw) need.set(w, (need.get(w) ?? 0) + 1);
  for (let i = 0; i + qw.length <= pw.length; i++) {
    const have = new Map<string, number>();
    for (const w of pw.slice(i, i + qw.length)) have.set(w, (have.get(w) ?? 0) + 1);
    let hit = 0;
    for (const [w, n] of need) hit += Math.min(n, have.get(w) ?? 0);
    if (hit / qw.length >= 0.9) return { kind: 'fuzzy', snippet: pw.slice(i, i + qw.length).join(' ') };
  }
  return { kind: 'none', snippet: null };
}

export interface PriceCandidate {
  cents: number;
  currency: 'USD' | 'EUR' | 'GBP';
  snippet: string;
  distance: number;
  perYear: boolean;
}

const MONEY = /(?:(US\$|\$|€|£)\s?(\d{1,5}(?:[.,]\d{1,2})?))|(?:(\d{1,5}(?:[.,]\d{1,2})?)\s?(€|EUR|USD|GBP|£))/g;

function toCents(raw: string): number {
  // "1,234" (thousands) vs "12,50" (decimals)
  const s = /,\d{2}$/.test(raw) ? raw.replace('.', '').replace(',', '.') : raw.replace(/,/g, '');
  return Math.round(Number(s) * 100);
}

function currencyOf(sym: string): PriceCandidate['currency'] {
  if (sym.includes('€') || sym === 'EUR') return 'EUR';
  if (sym.includes('£') || sym === 'GBP') return 'GBP';
  return 'USD';
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nameRe(name: string, flags = ''): RegExp {
  return new RegExp(`(^|[^a-z0-9])${escapeRe(name.toLowerCase())}(?=$|[^a-z0-9])`, flags);
}

/**
 * Prices appearing shortly after each occurrence of the plan name. The window
 * stops at the next occurrence of another plan's name, so a neighbouring
 * plan's price is never attributed to this one.
 */
export function pricesNearPlan(pageText: string, planName: string, otherPlans: string[] = [], window = 220): PriceCandidate[] {
  const text = normalizeText(pageText);
  const re = nameRe(planName, 'g');
  const lower = text.toLowerCase();
  const out: PriceCandidate[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower))) {
    const at = m.index + m[1]!.length;
    const from = Math.max(0, at - 5);
    let to = Math.min(text.length, at + planName.length + window);
    for (const other of otherPlans) {
      if (other.toLowerCase() === planName.toLowerCase()) continue;
      const o = nameRe(other, 'g');
      o.lastIndex = at + planName.length;
      const hit = o.exec(lower);
      if (hit && hit.index + hit[1]!.length < to) to = hit.index + hit[1]!.length;
    }
    const chunk = text.slice(from, to);
    for (const mm of chunk.matchAll(MONEY)) {
      const sym = mm[1] ?? mm[4] ?? '$';
      const num = mm[2] ?? mm[3] ?? '0';
      const pos = from + (mm.index ?? 0);
      const after = text.slice(pos, pos + 40).toLowerCase();
      out.push({
        cents: toCents(num),
        currency: currencyOf(sym),
        snippet: text.slice(Math.max(0, at - 10), Math.min(text.length, pos + 40)).replace(/\s+/g, ' '),
        distance: Math.abs(pos - at),
        perYear: /\/\s?(yr|year)|per year|annually|\/jaar|per jaar/.test(after) && !/billed annually/.test(after),
      });
    }
  }
  return out.sort((a, b) => a.distance - b.distance);
}

export type PlanCheck =
  | { kind: 'confirmed'; snippet: string }
  | { kind: 'changed'; cents: number; currency: PriceCandidate['currency']; snippet: string }
  | { kind: 'ambiguous'; candidates: number[] }
  | { kind: 'not_found' };

/**
 * Check one plan against a pricing page.
 *  confirmed  the known price (or its annual-monthly price) is next to the plan name;
 *  changed    exactly one different monthly price is next to the plan name;
 *  ambiguous  several different prices → no automatic change;
 *  not_found  the plan name is not on the page (template change → re-anchor).
 */
export function checkPlan(
  pageText: string,
  plan: { name: string; priceCents: number | null; annualMonthlyCents: number | null; currency: string | null; isFree: boolean },
  otherPlans: string[] = [],
): PlanCheck {
  const cands = pricesNearPlan(pageText, plan.name, otherPlans);
  const nameFound = nameRe(plan.name).test(normalizeText(pageText).toLowerCase());
  if (!nameFound) return { kind: 'not_found' };
  if (plan.isFree || plan.priceCents === 0) {
    const near = normalizeText(pageText).toLowerCase();
    const i = near.search(nameRe(plan.name));
    const win = near.slice(Math.max(0, i - 40), i + 200);
    if (/(free|gratis|\$0|€0|0\s?€)/.test(win)) return { kind: 'confirmed', snippet: win.slice(0, 160) };
  }
  const known = [plan.priceCents, plan.annualMonthlyCents].filter((x): x is number => x !== null);
  const sameCurrency = cands.filter((c) => !plan.currency || c.currency === plan.currency);
  const hit = sameCurrency.find((c) => known.includes(c.cents));
  if (hit) return { kind: 'confirmed', snippet: hit.snippet };
  const monthly = sameCurrency.filter((c) => !c.perYear && c.distance < 180);
  const distinct = [...new Set(monthly.map((c) => c.cents))];
  if (distinct.length === 1 && monthly[0]) return { kind: 'changed', cents: distinct[0]!, currency: monthly[0].currency, snippet: monthly[0].snippet };
  if (distinct.length > 1) return { kind: 'ambiguous', candidates: distinct };
  return { kind: 'not_found' };
}
