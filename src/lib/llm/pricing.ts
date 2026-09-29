/**
 * Per-token list prices (USD per million tokens) used to estimate spend for
 * the daily budget and the weekly report. Unknown models use the most
 * expensive known rate, so the budget errs on the safe side.
 */
export interface ModelRate {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

const FALLBACK: ModelRate = MODEL_RATES['claude-fable-5-1']!;

export function estimateCostMicros(
  model: string,
  usage: { input: number; output: number; cacheRead?: number; cacheWrite?: number },
): number {
  const r = MODEL_RATES[model] ?? FALLBACK;
  const usd =
    (usage.input * r.input + usage.output * r.output + (usage.cacheRead ?? 0) * r.cacheRead + (usage.cacheWrite ?? 0) * r.cacheWrite) /
    1_000_000;
  return Math.round(usd * 1_000_000);
}
