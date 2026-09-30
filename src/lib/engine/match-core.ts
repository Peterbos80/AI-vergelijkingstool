/**
 * The pure part of Match: from an intent to constraints, clarification, stack
 * variants and suggestions. No LLM, no environment, no Node APIs, so the
 * static edition can run it in the browser (components/match/MatchClient).
 */
import type { Locale } from '@/i18n/config';
import type { Catalog, CatalogTask } from '@/lib/catalog/types';
import { budgetAnswer, nextClarification, type Clarification } from './clarify';
import { adHocTask, composeVariants, type StackResult, type Variant } from './compose';
import { detectIntent, mergeConstraints, type Constraints, type Intent } from './intent';
import { searchTools } from './search';

export interface CoreMatchInput {
  query: string;
  locale: Locale;
  explicit: Constraints;
  approach: Record<string, string>;
  taskOverride?: string;
  budget?: string;
  skip?: boolean;
  answered: number;
}

export interface CoreMatchOutput {
  intent: Intent;
  task: CatalogTask | null;
  constraints: Constraints;
  clarification: Clarification | null;
  variants: Record<Variant, StackResult> | null;
  suggestions: { taskIds: string[]; toolIds: string[] };
}

/** Everything after intent detection (lexical or LLM). */
export function completeMatch(detected: Intent, input: CoreMatchInput, catalog: Catalog): CoreMatchOutput {
  let intent = detected;
  if (input.taskOverride && catalog.tasksById.has(input.taskOverride)) {
    intent = { ...intent, taskId: input.taskOverride, confidence: Math.max(intent.confidence, 0.9) };
  }
  const constraints = mergeConstraints(intent.constraints, {
    ...input.explicit,
    ...budgetAnswer(input.budget),
    approach: { ...(intent.constraints.approach ?? {}), ...input.approach },
  });
  intent = { ...intent, constraints };

  const task = intent.taskId
    ? (catalog.tasksById.get(intent.taskId) ?? null)
    : intent.capabilityIds.length
      ? adHocTask(intent.capabilityIds.slice(0, 5))
      : null;
  const clarification = nextClarification(intent, catalog, {
    answered: input.answered,
    budgetAnswered: input.budget !== undefined,
    skipAll: Boolean(input.skip),
  });
  const variants = task ? composeVariants(catalog, task, constraints) : null;
  const suggestions = {
    taskIds: intent.taskCandidates.map((c) => c.id).slice(0, 4),
    toolIds: task ? [] : searchTools(catalog, { q: input.query }, input.locale).slice(0, 5).map((h) => h.tool.id),
  };
  return { intent, task, constraints, clarification, variants, suggestions };
}

/** Lexical-only Match (the static edition, and the fallback when no LLM is used). */
export function lexicalMatch(input: CoreMatchInput, catalog: Catalog): CoreMatchOutput {
  return completeMatch(detectIntent(input.query, catalog, input.locale), input, catalog);
}
