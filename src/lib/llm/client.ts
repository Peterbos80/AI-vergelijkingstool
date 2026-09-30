/**
 * Budgeted, guarded access to Claude for structured tasks (Match intent and
 * tool-text drafts/translations). Rules (docs/strategy/08 §9):
 *  - external/user content is data, delimited and never treated as instructions;
 *  - output must validate against a Zod schema (structured outputs), else null;
 *  - a hard daily spend cap (min of env and owner setting) → null = fallback;
 *  - every call is metered in `llm_usage` (visible in Admin and the weekly report).
 * Callers always have a deterministic fallback when this returns null.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { llmUsage } from '@/lib/db/schema';
import { queryRows } from '@/lib/db/sql';
import { env } from '@/lib/env';
import { loadSettings } from '@/lib/settings';
import { logError } from '@/lib/ops/errors';
import { estimateCostMicros } from './pricing';

export type LlmPurpose = 'match_intent' | 'content_draft';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) return null;
  client ??= new Anthropic({ apiKey: key, maxRetries: 1 });
  return client;
}

export function llmConfigured(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function spentTodayMicros(): Promise<number> {
  const rows = await queryRows<{ total: string | null }>(
    getDb(),
    sql`SELECT COALESCE(SUM(est_cost_micros), 0)::text AS total FROM llm_usage WHERE day = ${today()}`,
  );
  return Number(rows[0]?.total ?? 0);
}

export async function dailyBudgetMicros(): Promise<number> {
  const settings = await loadSettings(getDb());
  const usd = Math.min(env().LLM_DAILY_BUDGET_USD, settings.llm.dailyBudgetUsd);
  return Math.round(usd * 1_000_000);
}

async function record(purpose: LlmPurpose, usage: { input: number; output: number; cost: number; failed: boolean }) {
  try {
    await getDb()
      .insert(llmUsage)
      .values({
        day: today(),
        purpose,
        calls: 1,
        inputTokens: usage.input,
        outputTokens: usage.output,
        estCostMicros: usage.cost,
        failures: usage.failed ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [llmUsage.day, llmUsage.purpose],
        set: {
          calls: sql`${llmUsage.calls} + 1`,
          inputTokens: sql`${llmUsage.inputTokens} + ${usage.input}`,
          outputTokens: sql`${llmUsage.outputTokens} + ${usage.output}`,
          estCostMicros: sql`${llmUsage.estCostMicros} + ${usage.cost}`,
          failures: sql`${llmUsage.failures} + ${usage.failed ? 1 : 0}`,
        },
      });
  } catch {
    /* metering must not break the caller */
  }
}

export interface StructuredCall<S extends z.ZodType> {
  purpose: LlmPurpose;
  /** Stable instructions (cached). Must not contain user or external content. */
  system: string;
  /** Untrusted content, wrapped in delimiters by the caller. */
  user: string;
  schema: S;
  maxTokens?: number;
  timeoutMs?: number;
  effort?: 'low' | 'medium' | 'high';
}

export async function callStructured<S extends z.ZodType>(call: StructuredCall<S>): Promise<z.infer<S> | null> {
  const anthropic = getClient();
  if (!anthropic) return null;
  try {
    if ((await spentTodayMicros()) >= (await dailyBudgetMicros())) return null;
  } catch {
    return null;
  }
  const model = env().ANTHROPIC_MODEL;
  try {
    const response = await anthropic.beta.messages.parse(
      {
        model,
        max_tokens: call.maxTokens ?? 2000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: call.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: call.user }],
        output_config: { effort: call.effort ?? 'low', format: betaZodOutputFormat(call.schema) },
      },
      { timeout: call.timeoutMs ?? 12_000 },
    );
    const u = response.usage;
    const cost = estimateCostMicros(response.model ?? model, {
      input: u.input_tokens,
      output: u.output_tokens,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
    });
    const refused = response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens';
    const parsed = refused ? null : (response.parsed_output ?? null);
    await record(call.purpose, { input: u.input_tokens, output: u.output_tokens, cost, failed: parsed === null });
    return parsed as z.infer<S> | null;
  } catch (err) {
    await record(call.purpose, { input: 0, output: 0, cost: 0, failed: true });
    if (err instanceof Anthropic.RateLimitError) await logError('llm', `rate limited (${call.purpose})`);
    else if (err instanceof Anthropic.AuthenticationError) await logError('llm', 'authentication failed: check ANTHROPIC_API_KEY');
    else if (err instanceof Anthropic.APIError) await logError('llm', `API error ${err.status} (${call.purpose})`, err);
    else await logError('llm', `call failed (${call.purpose})`, err);
    return null;
  }
}

/** Escape delimiter look-alikes so untrusted text cannot close our tags. */
export function asData(tag: string, text: string): string {
  const safe = text.replace(/<\/?[a-z_]+>/gi, (m) => m.replace(/</g, '‹').replace(/>/g, '›')).slice(0, 8000);
  return `<${tag}>\n${safe}\n</${tag}>`;
}
