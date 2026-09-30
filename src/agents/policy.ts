/**
 * Decision policy (docs/strategy/08 §5 + docs/strategy/12 §4.2–4.3):
 * risk class × confidence band × hard rules → decision.
 */
import type { Decision } from '@/lib/db/schema';
import type { Settings } from '@/lib/settings/defaults';
import type { Autonomy } from './types';

/** R0 internal · R1 public, factual, reversible · R2 reputation/impact-sensitive · R3 legal/financial/security. */
export type RiskClass = 'R0' | 'R1' | 'R2' | 'R3';

export interface DecisionInput {
  confidence: number;
  risk: RiskClass;
  autonomy: Autonomy;
  /** A hard rule fired (e.g. price jump > 50%); the reason is recorded. */
  hardRule?: string | null;
}

export interface DecisionOutput {
  decision: Decision;
  reason: string;
}

export function decide(input: DecisionInput, policy: Settings['policy']): DecisionOutput {
  if (input.autonomy === 'off') return { decision: 'info', reason: 'agent_off' };
  if (input.risk === 'R3') return { decision: 'needs_human', reason: 'risk_R3' };
  if (input.hardRule) return { decision: 'needs_human', reason: input.hardRule };
  if (input.risk === 'R0') return { decision: 'auto_published', reason: 'risk_R0' };
  if (input.autonomy === 'queue_only') return { decision: 'queued', reason: 'autonomy_queue_only' };
  const c = input.confidence;
  if (c >= policy.autoPublish && input.risk === 'R1') return { decision: 'auto_published', reason: 'band_auto' };
  if (c >= policy.autoFlag) return { decision: input.risk === 'R2' ? 'queued' : 'auto_published_flagged', reason: 'band_flag' };
  if (c >= policy.queue) return { decision: 'queued', reason: 'band_queue' };
  return { decision: 'needs_human', reason: 'band_low' };
}

/** Hard rule for price changes (relative change in the same currency). */
export function priceHardRule(oldCents: number | null, newCents: number | null, policy: Settings['policy']): string | null {
  if (oldCents === null || newCents === null) return null;
  if (oldCents === 0 && newCents > 0) return 'free_to_paid';
  if (oldCents === 0) return null;
  const pct = ((newCents - oldCents) / oldCents) * 100;
  if (pct > policy.priceIncreasePct) return 'price_increase_over_limit';
  if (-pct > policy.priceDecreasePct) return 'price_decrease_over_limit';
  return null;
}

export function sanityCheckPrice(cents: number | null): boolean {
  return cents === null || (Number.isFinite(cents) && cents >= 0 && cents < 10_000_000);
}
