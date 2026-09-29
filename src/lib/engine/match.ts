/**
 * Match orchestration: lexical intent → (optional, gated) LLM intent →
 * constraints → clarification → stack variants.
 */
import type { Locale } from '@/i18n/config';
import type { Catalog, CatalogTask } from '@/lib/catalog/types';
import { env } from '@/lib/env';
import { budgetAnswer, nextClarification, type Clarification } from './clarify';
import { adHocTask, composeVariants, type StackResult, type Variant } from './compose';
import { detectIntent, mergeConstraints, type Constraints, type Intent } from './intent';
import { llmIntent } from './llm-intent';
import { searchTools } from './search';

export interface MatchInput {
  query: string;
  locale: Locale;
  explicit: Constraints;
  approach: Record<string, string>;
  taskOverride?: string;
  budget?: string;
  skip?: boolean;
  answered: number;
  gatingThreshold: number;
  allowLlm: boolean;
}

export interface MatchOutput {
  intent: Intent;
  task: CatalogTask | null;
  constraints: Constraints;
  clarification: Clarification | null;
  variants: Record<Variant, StackResult> | null;
  suggestions: { taskIds: string[]; toolIds: string[] };
  llmUsed: boolean;
}

export async function runMatch(input: MatchInput, catalog: Catalog): Promise<MatchOutput> {
  let intent = detectIntent(input.query, catalog, input.locale);
  let llmUsed = false;
  if (input.allowLlm && env().LLM_MATCH_ENABLED && intent.confidence < input.gatingThreshold && input.query.trim().length >= 6) {
    const llm = await llmIntent(input.query, catalog, input.locale, intent);
    if (llm) {
      intent = llm;
      llmUsed = true;
    }
  }
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
  return { intent, task, constraints, clarification, variants, suggestions, llmUsed };
}

/** Remove personal data before storing a query (e-mail, phone, URLs, long numbers). */
export function scrubQuery(q: string): string {
  return q
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, '[iban]')
    .slice(0, 300);
}
