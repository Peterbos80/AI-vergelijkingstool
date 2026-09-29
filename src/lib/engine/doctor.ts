/**
 * Stack Doctor: diagnose an existing stack (overlap, cost, risks, cheaper or
 * consolidating alternatives, gaps for a goal) and write a "recipe".
 * Deterministic; savings are estimates from entry prices and labelled so.
 */
import type { Catalog, CatalogTask, CatalogTool } from '@/lib/catalog/types';
import { toEurCents } from '@/lib/pricing/money';
import { entryPaidPlan, freePlan, type Money } from './compose';
import { similarity } from './alternatives';

export type Pain = 'cost' | 'overlap' | 'privacy' | 'too_many' | 'quality' | 'learning';
export const PAINS: Pain[] = ['cost', 'overlap', 'privacy', 'too_many', 'quality', 'learning'];

export type RiskKind = 'shutdown' | 'deprecated' | 'stale' | 'trains_on_data' | 'no_eu' | 'unknown_price' | 'unverified_price';

export interface Diagnosis {
  toolIds: string[];
  monthly: Money[];
  monthlyEurCents: number | null;
  overlaps: { capabilityId: string; toolIds: string[] }[];
  risks: { toolId: string; kind: RiskKind }[];
  savings: { toolId: string; alternativeId: string; savingCents: number; currency: string }[];
  consolidation: { toolId: string; replaces: string[] }[];
  gaps: { stepKey: string; suggestionIds: string[] }[];
  recipe: { action: 'keep' | 'replace' | 'remove' | 'add' | 'review'; toolId: string; withId?: string; reason: string }[];
  estimatedSaving: Money[];
  roasts: ('identity' | 'pricey' | 'ghost' | 'toomany' | 'frugal')[];
}

function monthlyCost(tool: CatalogTool): { cents: number; currency: string } | null {
  const paid = entryPaidPlan(tool);
  if (paid) return { cents: paid.monthlyCents!, currency: paid.currency! };
  if (freePlan(tool)) return { cents: 0, currency: 'EUR' };
  return null;
}

const TEXT_CAPS = new Set(['chat-assistant', 'long-form-writing', 'copywriting', 'email-writing', 'script-writing']);

export function diagnose(catalog: Catalog, toolIds: string[], pains: Pain[], task: CatalogTask | null): Diagnosis {
  const tools = [...new Set(toolIds)].map((id) => catalog.toolsById.get(id)).filter((x): x is CatalogTool => Boolean(x)).slice(0, 12);
  const ids = tools.map((t) => t.id);

  // Cost
  const byCur = new Map<string, number>();
  for (const t of tools) {
    const c = monthlyCost(t);
    if (c && c.cents > 0) byCur.set(c.currency, (byCur.get(c.currency) ?? 0) + c.cents);
  }
  const monthly = [...byCur.entries()].map(([currency, cents]) => ({ currency, cents }));
  let eur: number | null = 0;
  for (const m of monthly) {
    const e = toEurCents(m.cents, m.currency, catalog.fx.rates);
    eur = e === null || eur === null ? null : eur + e;
  }

  // Overlaps: primary capabilities shared by ≥ 2 tools.
  const capMap = new Map<string, string[]>();
  for (const t of tools)
    for (const c of t.capabilities.filter((x) => x.strength === 'primary')) capMap.set(c.id, [...(capMap.get(c.id) ?? []), t.id]);
  const overlaps = [...capMap.entries()].filter(([, list]) => list.length >= 2).map(([capabilityId, list]) => ({ capabilityId, toolIds: list }));

  // Risks
  const risks: Diagnosis['risks'] = [];
  for (const t of tools) {
    if (t.status === 'shutdown') risks.push({ toolId: t.id, kind: 'shutdown' });
    else if (t.status === 'deprecated') risks.push({ toolId: t.id, kind: 'deprecated' });
    if (t.freshness === 'stale') risks.push({ toolId: t.id, kind: 'stale' });
    if (t.pricingStatus === null && !t.hasFreeTier) risks.push({ toolId: t.id, kind: 'unknown_price' });
    else if (t.pricingStatus === 'unverified') risks.push({ toolId: t.id, kind: 'unverified_price' });
    if (pains.includes('privacy')) {
      if (t.trainsOnUserData === 'yes') risks.push({ toolId: t.id, kind: 'trains_on_data' });
      if (t.euDataResidency === false) risks.push({ toolId: t.id, kind: 'no_eu' });
    }
  }

  // Cheaper alternatives with strong overlap (same currency comparison only).
  const savings: Diagnosis['savings'] = [];
  for (const t of tools) {
    const mine = monthlyCost(t);
    if (!mine || mine.cents === 0) continue;
    let best: { alt: CatalogTool; saving: number } | null = null;
    for (const alt of catalog.tools) {
      if (alt.id === t.id || ids.includes(alt.id) || alt.status === 'shutdown' || alt.status === 'deprecated') continue;
      if (similarity(t, alt) < 0.5) continue;
      const theirs = monthlyCost(alt);
      if (!theirs || theirs.currency !== mine.currency) continue;
      const saving = mine.cents - theirs.cents;
      if (saving <= 0) continue;
      if (pains.includes('quality') && alt.confidence < t.confidence) continue;
      if (!best || saving > best.saving) best = { alt, saving };
    }
    if (best) savings.push({ toolId: t.id, alternativeId: best.alt.id, savingCents: best.saving, currency: mine.currency });
  }

  // Consolidation: one catalog tool covering the primary capabilities of ≥ 2 of the user's tools.
  const consolidation: Diagnosis['consolidation'] = [];
  if (tools.length >= 2) {
    const candidates = catalog.tools.filter((x) => x.status !== 'shutdown' && x.status !== 'deprecated');
    let best: { tool: CatalogTool; replaces: string[] } | null = null;
    for (const c of candidates) {
      const replaces = tools
        .filter((t) => t.id !== c.id)
        .filter((t) => {
          const prim = t.capabilities.filter((x) => x.strength === 'primary').map((x) => x.id);
          return prim.length > 0 && prim.every((p) => c.capabilities.some((x) => x.id === p));
        })
        .map((t) => t.id);
      if (replaces.length >= 2 && (!best || replaces.length > best.replaces.length)) best = { tool: c, replaces };
    }
    if (best) consolidation.push({ toolId: best.tool.id, replaces: best.replaces });
  }

  // Gaps for a goal
  const gaps: Diagnosis['gaps'] = [];
  if (task) {
    for (const step of task.steps.filter((s) => s.required)) {
      const covered = tools.some((t) => t.capabilities.some((c) => step.capabilityIds.includes(c.id)));
      if (covered) continue;
      const suggestionIds = catalog.tools
        .filter((t) => t.status !== 'shutdown' && t.capabilities.some((c) => c.strength === 'primary' && step.capabilityIds.includes(c.id)))
        .sort((a, b) => b.confidence - a.confidence || (a.entryPriceCents ?? 0) - (b.entryPriceCents ?? 0))
        .slice(0, 3)
        .map((t) => t.id);
      gaps.push({ stepKey: step.key, suggestionIds });
    }
  }

  // Recipe
  const recipe: Diagnosis['recipe'] = [];
  const handled = new Set<string>();
  for (const r of risks.filter((x) => x.kind === 'shutdown' || x.kind === 'deprecated')) {
    const alt = tools.length ? catalog.toolsById.get(catalog.toolsById.get(r.toolId)?.alternatives[0]?.id ?? '') : undefined;
    recipe.push({ action: 'replace', toolId: r.toolId, withId: alt?.id, reason: r.kind });
    handled.add(r.toolId);
  }
  for (const o of overlaps) {
    const [keep, ...rest] = [...o.toolIds].sort((a, b) => (catalog.toolsById.get(b)!.confidence ?? 0) - (catalog.toolsById.get(a)!.confidence ?? 0));
    for (const r of rest) {
      if (handled.has(r)) continue;
      if (pains.includes('overlap') || pains.includes('too_many') || pains.includes('cost')) {
        recipe.push({ action: 'remove', toolId: r, withId: keep, reason: 'overlap' });
        handled.add(r);
      }
    }
  }
  for (const s of savings) {
    if (handled.has(s.toolId)) continue;
    if (pains.includes('cost') || pains.length === 0) {
      recipe.push({ action: 'replace', toolId: s.toolId, withId: s.alternativeId, reason: 'cheaper' });
      handled.add(s.toolId);
    }
  }
  for (const r of risks.filter((x) => x.kind === 'trains_on_data' || x.kind === 'no_eu')) {
    if (handled.has(r.toolId)) continue;
    recipe.push({ action: 'review', toolId: r.toolId, reason: r.kind });
    handled.add(r.toolId);
  }
  for (const g of gaps) if (g.suggestionIds[0]) recipe.push({ action: 'add', toolId: g.suggestionIds[0], reason: `gap:${g.stepKey}` });
  for (const t of tools) if (!handled.has(t.id)) recipe.push({ action: 'keep', toolId: t.id, reason: 'fine' });

  // Estimated saving from removals and replacements (entry prices; an estimate).
  const saveMap = new Map<string, number>();
  for (const r of recipe) {
    const mine = catalog.toolsById.get(r.toolId);
    if (!mine) continue;
    const cost = monthlyCost(mine);
    if (!cost || cost.cents === 0) continue;
    if (r.action === 'remove') saveMap.set(cost.currency, (saveMap.get(cost.currency) ?? 0) + cost.cents);
    if (r.action === 'replace' && r.reason === 'cheaper') {
      const s = savings.find((x) => x.toolId === r.toolId);
      if (s) saveMap.set(s.currency, (saveMap.get(s.currency) ?? 0) + s.savingCents);
    }
  }

  // Humour: fixed templates, triggered by facts about the user's own stack.
  const roasts: Diagnosis['roasts'] = [];
  const textTools = tools.filter((t) => t.capabilities.some((c) => c.strength === 'primary' && TEXT_CAPS.has(c.id)));
  if (textTools.length >= 3) roasts.push('identity');
  if (eur !== null && eur > 15_000) roasts.push('pricey');
  if (tools.some((t) => t.status === 'shutdown')) roasts.push('ghost');
  if (tools.length >= 7) roasts.push('toomany');
  if (tools.length >= 2 && monthly.length === 0) roasts.push('frugal');

  return {
    toolIds: ids,
    monthly,
    monthlyEurCents: monthly.length ? eur : 0,
    overlaps,
    risks,
    savings,
    consolidation,
    gaps,
    recipe,
    estimatedSaving: [...saveMap.entries()].map(([currency, cents]) => ({ currency, cents })),
    roasts,
  };
}
