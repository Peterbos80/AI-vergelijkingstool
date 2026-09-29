/**
 * Clarifying questions: at most one per round and two rounds in total
 * (docs/strategy/10 §5). Every question has a "skip" and answers are kept in
 * the URL, so refresh, back and sharing work without JavaScript.
 */
import type { Catalog } from '@/lib/catalog/types';
import type { Intent } from './intent';

export type Clarification =
  | { kind: 'approach'; stepKey: string; options: string[] }
  | { kind: 'budget'; options: ('free' | '25' | '100' | 'any')[] }
  | { kind: 'task'; options: string[] };

export interface ClarifyState {
  /** Number of questions already answered or skipped. */
  answered: number;
  budgetAnswered: boolean;
  skipAll: boolean;
}

export const MAX_ROUNDS = 2;

export function nextClarification(intent: Intent, catalog: Catalog, state: ClarifyState): Clarification | null {
  if (state.skipAll || state.answered >= MAX_ROUNDS) return null;
  if (!intent.taskId) {
    if (intent.capabilityIds.length) return null; // ad-hoc stack from capabilities
    const options = intent.taskCandidates.map((c) => c.id).filter((id) => catalog.tasksById.has(id));
    return options.length >= 2 ? { kind: 'task', options } : null;
  }
  const task = catalog.tasksById.get(intent.taskId);
  if (!task) return null;
  for (const step of task.steps.filter((s) => s.required && s.capabilityIds.length > 1)) {
    if (intent.constraints.approach?.[step.key]) continue;
    const mentioned = step.capabilityIds.filter((c) => intent.capabilityIds.includes(c));
    if (mentioned.length === 1) continue; // the query already says which approach
    return { kind: 'approach', stepKey: step.key, options: step.capabilityIds };
  }
  const c = intent.constraints;
  if (!state.budgetAnswered && c.budgetMonthlyCents === undefined && !c.freeOnly) {
    return { kind: 'budget', options: ['free', '25', '100', 'any'] };
  }
  return null;
}

/** Apply a budget answer to constraints. */
export function budgetAnswer(value: string | undefined): { budgetMonthlyCents?: number; budgetCurrency?: 'EUR'; freeOnly?: boolean } {
  switch (value) {
    case 'free':
      return { freeOnly: true, budgetMonthlyCents: 0, budgetCurrency: 'EUR' };
    case '25':
      return { budgetMonthlyCents: 2500, budgetCurrency: 'EUR' };
    case '100':
      return { budgetMonthlyCents: 10000, budgetCurrency: 'EUR' };
    default:
      return {};
  }
}
