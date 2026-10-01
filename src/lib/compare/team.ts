/**
 * Team costs (docs/strategy/agents/B2 §3): N users × the per-user or per-seat
 * price, monthly billing against annual billing, with the seat rules the
 * makers state ("Two-seat minimum", "2–150 seats", "Annual billing only").
 * Order: the computed yearly total in euros only. Pure; no monetisation input.
 */
import type { Catalog } from '@/lib/catalog/types';
import type { FactStatus } from '@/lib/db/schema';
import { annualBillingOnly, parseSeats } from '@/lib/pricing/quota';
import { isEuropeanCountry } from './labels';
import { eurFor, type FxData } from './usage';

/** Editorial groups: tools whose primary capability is this one and that sell per user or per seat. */
export const TEAM_GROUPS: readonly { id: string; capability: string }[] = [
  { id: 'assistants', capability: 'chat-assistant' },
  { id: 'meetings', capability: 'meeting-notes' },
  { id: 'coding', capability: 'code-assistant' },
  { id: 'presentations', capability: 'presentation-generation' },
  { id: 'video', capability: 'video-editing' },
];

export interface TeamPlan {
  tool: string;
  toolName: string;
  country: string | null;
  european: boolean;
  key: string;
  name: string;
  unit: 'per_user' | 'per_seat';
  /** Monthly billing: price per user per month; null when not offered or not public. */
  monthlyCents: number | null;
  /** Annual billing: price per user per month; null when not published. */
  annualMonthlyCents: number | null;
  currency: string;
  minSeats: number | null;
  maxSeats: number | null;
  annualOnly: boolean;
  status: FactStatus;
  observedAt: string;
  quota: string | null;
}

export interface TeamGroup {
  id: string;
  capability: string;
  plans: TeamPlan[];
}

export interface TeamData {
  groups: TeamGroup[];
  fx: FxData;
}

export function buildTeam(catalog: Catalog): TeamData {
  const currencies = new Set<string>();
  const groups: TeamGroup[] = [];
  for (const g of TEAM_GROUPS) {
    const plans: TeamPlan[] = [];
    for (const tool of catalog.tools) {
      if (tool.status === 'shutdown') continue;
      if (!tool.capabilities.some((c) => c.id === g.capability && c.strength === 'primary')) continue;
      for (const p of [...tool.plans].sort((a, b) => a.position - b.position)) {
        if (p.unit !== 'per_user' && p.unit !== 'per_seat') continue;
        if (p.isCustom || p.period === 'custom' || !p.currency) continue;
        const annualOnly = annualBillingOnly(p.quota);
        const monthly = annualOnly ? null : p.period === 'month' ? p.priceCents : p.period === 'year' ? p.monthlyCents : null;
        if (monthly === null && p.annualMonthlyCents === null) continue;
        const seats = parseSeats(p.quota);
        currencies.add(p.currency);
        plans.push({
          tool: tool.slug,
          toolName: tool.name,
          country: tool.companyCountry,
          european: isEuropeanCountry(tool.companyCountry),
          key: p.key,
          name: p.name,
          unit: p.unit,
          monthlyCents: monthly,
          annualMonthlyCents: p.annualMonthlyCents,
          currency: p.currency,
          minSeats: seats?.min ?? null,
          maxSeats: seats?.max ?? null,
          annualOnly,
          status: p.status,
          observedAt: p.observedAt.toISOString().slice(0, 10),
          quota: p.quota,
        });
      }
    }
    if (new Set(plans.map((p) => p.tool)).size >= 2) groups.push({ id: g.id, capability: g.capability, plans });
  }
  const rates: Record<string, number> = {};
  for (const cur of currencies) {
    const r = catalog.fx.rates.get(cur.toUpperCase());
    if (r) rates[cur.toUpperCase()] = r;
  }
  return { groups, fx: { day: catalog.fx.day, rates } };
}

export type Billing = 'monthly' | 'annual';

export interface TeamRow {
  plan: TeamPlan;
  /** Seats you pay for (the users, or the plan's minimum). */
  seats: number;
  /** Monthly billing, minor units of the plan's currency; null when not offered or unknown. */
  monthlyPerMonth: number | null;
  monthlyPerYear: number | null;
  /** Annual billing per year; null when the annual price is not published. */
  annualPerYear: number | null;
  /** What annual billing saves per year compared with monthly billing. */
  savingPerYear: number | null;
  /** Yearly total in euro cents for the chosen billing (the order); null when unknown or without an ECB rate. */
  eurPerYear: number | null;
}

export interface TeamResult {
  users: number;
  billing: Billing;
  /** Rows with a euro total for the chosen billing, cheapest first. */
  ranked: TeamRow[];
  /** Price for the chosen billing unknown, or no ECB rate: listed after the ranked rows. */
  unranked: TeamRow[];
  /** More users than the plan allows. */
  tooMany: TeamPlan[];
}

export function computeTeam(group: TeamGroup, fx: FxData, users: number, billing: Billing): TeamResult {
  const n = Math.max(1, Math.floor(users));
  const ranked: TeamRow[] = [];
  const unranked: TeamRow[] = [];
  const tooMany: TeamPlan[] = [];
  for (const plan of group.plans) {
    if (plan.maxSeats !== null && n > plan.maxSeats) {
      tooMany.push(plan);
      continue;
    }
    const seats = Math.max(n, plan.minSeats ?? 1);
    const monthlyPerMonth = plan.monthlyCents === null ? null : plan.monthlyCents * seats;
    const monthlyPerYear = monthlyPerMonth === null ? null : monthlyPerMonth * 12;
    const annualPerYear = plan.annualMonthlyCents === null ? null : plan.annualMonthlyCents * seats * 12;
    const savingPerYear = monthlyPerYear !== null && annualPerYear !== null ? monthlyPerYear - annualPerYear : null;
    const total = billing === 'monthly' ? monthlyPerYear : annualPerYear;
    const eurPerYear = total === null ? null : eurFor(total, plan.currency, fx);
    const row = { plan, seats, monthlyPerMonth, monthlyPerYear, annualPerYear, savingPerYear, eurPerYear };
    (eurPerYear === null ? unranked : ranked).push(row);
  }
  const name = (a: TeamRow, b: TeamRow) =>
    a.plan.toolName.localeCompare(b.plan.toolName, 'en', { sensitivity: 'base' }) || a.plan.name.localeCompare(b.plan.name, 'en');
  ranked.sort((a, b) => a.eurPerYear! - b.eurPerYear! || name(a, b));
  unranked.sort(name);
  return { users: n, billing, ranked, unranked, tooMany };
}
