/**
 * Golden-set evaluation as a pure function over a catalog: used by the engine
 * tests and by the Recommendation agent's nightly regression guard, so both
 * judge the engine by exactly the same rules.
 */
import type { Catalog } from '@/lib/catalog/types';
import { nextClarification } from './clarify';
import { composeVariants } from './compose';
import { GOLDEN, type GoldenCase } from './golden';
import { detectIntent } from './intent';

export interface GoldenResult {
  id: string;
  ok: boolean;
  failures: string[];
}

export function evaluateCase(c: GoldenCase, catalog: Catalog): GoldenResult {
  const failures: string[] = [];
  const intent = detectIntent(c.query, catalog, c.locale);
  if (c.expect?.noMatch) {
    if (intent.taskId !== null) failures.push(`expected no task, got ${intent.taskId}`);
    if (intent.capabilityIds.length) failures.push(`expected no capabilities, got ${intent.capabilityIds.join(',')}`);
    return { id: c.id, ok: failures.length === 0, failures };
  }
  if (!c.tasks.includes(intent.taskId ?? '')) failures.push(`task ${intent.taskId ?? 'none'} not in [${c.tasks.join(', ')}]`);
  const e = c.expect ?? {};
  if (e.level && intent.constraints.level !== e.level) failures.push(`level ${intent.constraints.level ?? 'none'} ≠ ${e.level}`);
  if (e.freeOnly && intent.constraints.freeOnly !== true) failures.push('freeOnly not detected');
  if (e.budgetCents && intent.constraints.budgetMonthlyCents !== e.budgetCents) failures.push(`budget ${intent.constraints.budgetMonthlyCents ?? 'none'} ≠ ${e.budgetCents}`);
  if (e.dutch && intent.constraints.dutch !== true) failures.push('dutch not detected');
  if (e.local && intent.constraints.local !== true) failures.push('local not detected');
  if (e.clarifyApproach) {
    const q = nextClarification(intent, catalog, { answered: 0, budgetAnswered: false, skipAll: false });
    if (q?.kind !== 'approach') failures.push(`clarification ${q?.kind ?? 'none'} ≠ approach`);
  }
  const task = intent.taskId ? catalog.tasksById.get(intent.taskId) : undefined;
  if (!task) return { id: c.id, ok: false, failures: failures.length ? failures : ['no task'] };
  const variants = composeVariants(catalog, task, intent.constraints);
  for (const [name, r] of Object.entries(variants)) {
    for (const s of r.steps.filter((x) => x.required)) if (!s.toolId) failures.push(`${name}: required step ${s.key} has no tool`);
    for (const l of r.lines) {
      const tool = catalog.toolsById.get(l.toolId);
      if (!tool || ['shutdown', 'deprecated', 'waitlist'].includes(tool.status)) failures.push(`${name}: unusable tool ${tool?.slug ?? l.toolId}`);
    }
    if (e.freeOnly) for (const l of r.lines.filter((x) => !x.optional)) if (l.paidCents !== 0) failures.push(`${name}: paid tool ${catalog.toolsById.get(l.toolId)?.slug} in a free-only stack`);
  }
  // The budget variant is never more expensive than the recommended one (same currency).
  for (const m of variants.budget.totals.core.paid) {
    const r = variants.recommended.totals.core.paid.find((x) => x.currency === m.currency);
    if (r && m.cents > r.cents) failures.push(`budget variant (${m.cents} ${m.currency}) above recommended (${r.cents})`);
  }
  return { id: c.id, ok: failures.length === 0, failures };
}

export function evaluateGolden(catalog: Catalog, cases: GoldenCase[] = GOLDEN): GoldenResult[] {
  return cases.map((c) => {
    try {
      return evaluateCase(c, catalog);
    } catch (e) {
      return { id: c.id, ok: false, failures: [`error: ${e instanceof Error ? e.message : String(e)}`] };
    }
  });
}
