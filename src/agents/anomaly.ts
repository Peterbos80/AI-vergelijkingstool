/**
 * Anomaly guard (docs/strategy/12 §4.4): before publishing, a run compares the
 * volume of proposed changes with thresholds. Over the limit → freeze the
 * whole run (everything goes to the queue) and escalate once.
 */
import type { Settings } from '@/lib/settings/defaults';

export interface ProposedChange {
  toolId: string;
  kind: 'price' | 'status' | 'plan' | 'other';
}

export interface AnomalyVerdict {
  freeze: boolean;
  severity: 'p1' | 'p2' | null;
  reason: string | null;
  toolsChangedPct: number;
}

export function anomalyVerdict(changes: ProposedChange[], totalTools: number, s: Settings['anomaly']): AnomalyVerdict {
  const tools = new Set(changes.map((c) => c.toolId)).size;
  const pct = totalTools > 0 ? (tools / totalTools) * 100 : 0;
  const prices = changes.filter((c) => c.kind === 'price').length;
  const statuses = changes.filter((c) => c.kind === 'status').length;
  let reason: string | null = null;
  if (pct > s.maxToolsPct) reason = 'too_many_tools';
  else if (prices > s.maxPriceChanges) reason = 'too_many_price_changes';
  else if (statuses > s.maxStatusChanges) reason = 'too_many_status_changes';
  if (!reason) return { freeze: false, severity: null, reason: null, toolsChangedPct: pct };
  return { freeze: true, severity: pct > s.p1Pct ? 'p1' : 'p2', reason, toolsChangedPct: pct };
}
