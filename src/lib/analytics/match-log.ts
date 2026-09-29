import { createHash } from 'node:crypto';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/client';
import { matchQueries } from '@/lib/db/schema';
import { scrubQuery } from '@/lib/engine/match';
import type { Intent } from '@/lib/engine/intent';
import { normalize } from '@/lib/engine/text';
import { clientIp, isBot, visitorHash } from './visitor';

/**
 * Log a Match (PII-scrubbed text, 90-day retention by the Quality agent).
 * Feeds demand analysis, "no match" detection and the Opportunity agent.
 */
export async function logMatch(input: {
  id: string;
  locale: string;
  intent: Intent;
  resultToolIds: string[];
  clarified: boolean;
  latencyMs: number;
}): Promise<void> {
  const h = await headers();
  if (h.get('next-router-prefetch') || h.get('x-aitw-synthetic')) return;
  const ua = h.get('user-agent');
  if (isBot(ua)) return;
  const row = {
    id: input.id,
    locale: input.locale,
    queryScrubbed: scrubQuery(input.intent.query),
    queryHash: createHash('sha256').update(normalize(input.intent.query)).digest('hex').slice(0, 32),
    engine: input.intent.engine,
    taskId: input.intent.taskId,
    capabilityIds: input.intent.capabilityIds,
    constraints: input.intent.constraints as Record<string, unknown>,
    confidence: Math.round(input.intent.confidence * 100),
    clarified: input.clarified,
    resultToolIds: input.resultToolIds,
    visitorHash: visitorHash(clientIp(h), ua!),
    latencyMs: input.latencyMs,
  };
  after(async () => {
    try {
      await getDb().insert(matchQueries).values(row).onConflictDoNothing();
    } catch {
      /* analytics must not break the page */
    }
  });
}
