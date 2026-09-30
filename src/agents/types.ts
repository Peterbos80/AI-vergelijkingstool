/**
 * Agent framework types (docs/strategy/08 §2, docs/strategy/12 §4).
 */
import type { Database } from '@/lib/db/client';
import type { Settings } from '@/lib/settings/defaults';
import type { Fetcher } from './fetcher/types';
import type { ActionLogger } from './actions';
import type { Escalator } from '@/lib/ops/inbox';

export type AgentName =
  | 'discovery'
  | 'verification'
  | 'pricing'
  | 'change-detection'
  | 'news'
  | 'broken-link'
  | 'duplicate'
  | 'quality'
  | 'escalation'
  | 'social'
  | 'video'
  | 'content'
  | 'opportunity'
  | 'recommendation'
  | 'monetization'
  | 'notifier'
  | 'fx'
  | 'health'
  | 'reporter'
  | 'audit';

export type Autonomy = 'auto' | 'queue_only' | 'off';

export interface AgentContext {
  db: Database;
  now: () => Date;
  runId: string;
  agent: AgentName;
  trigger: 'schedule' | 'manual' | 'api' | 'cli' | 'test';
  settings: Settings;
  autonomy: Autonomy;
  config: Record<string, unknown>;
  fetcher: Fetcher;
  log: ActionLogger;
  inbox: Escalator;
  signal: AbortSignal;
  limits: { maxItems: number };
  /** Increment a run statistic (shown in Admin → Operations and the report). */
  stat: (key: string, by?: number) => void;
}

export interface AgentResult {
  status: 'success' | 'partial' | 'failed' | 'skipped';
  summary: string;
  /** Published data changed → bump data_version so caches refresh. */
  dataChanged?: boolean;
}

export interface AgentDefinition {
  name: AgentName;
  description: string;
  /** "every:15m" | "every:6h" | "daily:03:10" | "weekly:1:07:00" | "monthly:1:08:00" (Europe/Amsterdam) */
  schedule: string;
  autonomy: Autonomy;
  /** Max items per run and time budget. */
  maxItems: number;
  timeoutMs: number;
  /** Integrations this agent needs (dependency register keys). */
  requires?: string[];
  run: (ctx: AgentContext) => Promise<AgentResult>;
}
