/**
 * Match orchestration: lexical intent → (optional, gated) LLM intent →
 * constraints → clarification → stack variants.
 */
import { createHash } from 'node:crypto';
import type { Catalog } from '@/lib/catalog/types';
import { env } from '@/lib/env';
import { detectIntent } from './intent';
import { llmIntent } from './llm-intent';
import { completeMatch, type CoreMatchInput, type CoreMatchOutput } from './match-core';
import { normalize } from './text';

/**
 * Share of LLM-eligible Matches answered by the lexical engine only. This
 * randomized holdout makes "does the LLM add value?" measurable without
 * comparing easy queries with hard ones (docs/strategy/12 §9). Assignment is
 * stable per query per week, so clarification steps stay consistent.
 */
export const LLM_HOLDOUT_PCT = 10;

export function inLlmHoldout(query: string, now: Date = new Date()): boolean {
  const week = Math.floor(now.getTime() / (7 * 86_400_000));
  return createHash('sha256').update(`${week}|${normalize(query)}`).digest().readUInt32BE(0) % 100 < LLM_HOLDOUT_PCT;
}

export interface MatchInput extends CoreMatchInput {
  gatingThreshold: number;
  allowLlm: boolean;
}

export interface MatchOutput extends CoreMatchOutput {
  llmUsed: boolean;
  /** Low lexical confidence and an LLM available. */
  llmEligible: boolean;
  /** Eligible but deliberately answered lexically (holdout group). */
  llmHoldout: boolean;
}

export async function runMatch(input: MatchInput, catalog: Catalog): Promise<MatchOutput> {
  let intent = detectIntent(input.query, catalog, input.locale);
  let llmUsed = false;
  const e = env();
  const llmEligible =
    input.allowLlm && e.LLM_MATCH_ENABLED && Boolean(e.ANTHROPIC_API_KEY) && intent.confidence < input.gatingThreshold && input.query.trim().length >= 6;
  const llmHoldout = llmEligible && inLlmHoldout(input.query);
  if (llmEligible && !llmHoldout) {
    const llm = await llmIntent(input.query, catalog, input.locale, intent);
    if (llm) {
      intent = llm;
      llmUsed = true;
    }
  }
  return { ...completeMatch(intent, input, catalog), llmUsed, llmEligible, llmHoldout };
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
