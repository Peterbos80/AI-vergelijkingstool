/**
 * Scores intent detection on an understanding set (understanding-eval.ts).
 * Shared by `npm run eval:understanding` and the engine tests, so both judge
 * by the same rules.
 */
import type { Catalog } from '@/lib/catalog/types';
import { nextClarification } from './clarify';
import { detectIntent } from './intent';
import type { UnderstandingCase } from './understanding-eval';

export interface UnderstandingMiss {
  c: UnderstandingCase;
  got: string | null;
  score: number;
  candidates: { id: string; score: number }[];
  /** Not answered directly, but a "did you mean" question offers the right task. */
  resolved: boolean;
}

export interface UnderstandingScore {
  n: number;
  /** The task Match picks is right. */
  top1: number;
  /** The right task is among the first three candidates. */
  top3: number;
  /** Right task, or a question that offers it: what the visitor experiences. */
  resolved: number;
  /** A task was picked and it was wrong. */
  wrong: number;
  misses: UnderstandingMiss[];
}

export function measureUnderstanding(cases: UnderstandingCase[], catalog: Catalog): UnderstandingScore {
  let top1 = 0;
  let top3 = 0;
  let resolved = 0;
  let wrong = 0;
  const misses: UnderstandingMiss[] = [];
  for (const c of cases) {
    const intent = detectIntent(c.q, catalog, c.locale);
    const ok1 = intent.taskId !== null && c.tasks.includes(intent.taskId);
    const first3 = [intent.taskId, ...intent.taskCandidates.map((x) => x.id)].filter((x): x is string => Boolean(x)).slice(0, 3);
    const question = intent.taskId ? null : nextClarification(intent, catalog, { answered: 0, budgetAnswered: false, skipAll: false });
    const okResolved = ok1 || (question?.kind === 'task' && question.options.some((id) => c.tasks.includes(id)));
    if (ok1) top1++;
    if (first3.some((id) => c.tasks.includes(id))) top3++;
    if (okResolved) resolved++;
    if (intent.taskId && !ok1) wrong++;
    if (!ok1) misses.push({ c, got: intent.taskId, score: intent.taskScore, candidates: intent.taskCandidates, resolved: okResolved });
  }
  const n = Math.max(1, cases.length);
  return { n: cases.length, top1: top1 / n, top3: top3 / n, resolved: resolved / n, wrong: wrong / n, misses };
}
