/**
 * Audit agent (docs/strategy/12 §5.6): measures whether autonomy deserves
 * trust. Monthly it draws a random sample of automated decisions for the
 * owner to judge (P2, ~12–25 min). Once judged, it computes precision per
 * confidence band with a Wilson lower bound; a band below target produces an
 * autonomy proposal. Proposals are never applied automatically.
 */
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { agentActions, reviewItems } from '@/lib/db/schema';
import type { AgentDefinition } from '../types';

/** Automated actions that change what visitors see (auditable). */
export const AUDITABLE = ['price_published', 'plan_verified', 'website_status', 'event_published', 'video_added', 'affiliate_link_deactivated'] as const;
export const PRECISION_TARGET = 0.95;

export type Verdict = 'correct' | 'incorrect' | 'unsure';

export interface AuditSampleItem {
  actionId: string;
  action: string;
  toolId: string | null;
  confidence: number | null;
  decision: string;
  sourceUrl: string | null;
  at: string;
  verdict?: Verdict;
}

/** Wilson score interval lower bound (95%). */
export function wilsonLower(successes: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (centre - margin) / denom);
}

export function band(confidence: number | null): '95+' | '80-94' | '<80' {
  if (confidence === null) return '<80';
  return confidence >= 95 ? '95+' : confidence >= 80 ? '80-94' : '<80';
}

export function precisionByBand(items: AuditSampleItem[]): { band: string; n: number; correct: number; precision: number; lower: number }[] {
  const judged = items.filter((i) => i.verdict === 'correct' || i.verdict === 'incorrect');
  const bands = new Map<string, { n: number; correct: number }>();
  for (const i of judged) {
    const b = band(i.confidence);
    const cur = bands.get(b) ?? { n: 0, correct: 0 };
    cur.n++;
    if (i.verdict === 'correct') cur.correct++;
    bands.set(b, cur);
  }
  return [...bands.entries()].map(([b, v]) => ({ band: b, n: v.n, correct: v.correct, precision: v.correct / v.n, lower: wilsonLower(v.correct, v.n) }));
}

export const auditAgent: AgentDefinition = {
  name: 'audit',
  description: 'Monthly random sample of automated decisions for owner review; precision per confidence band with Wilson lower bound.',
  schedule: 'monthly:01:08:00',
  autonomy: 'auto',
  maxItems: 50,
  timeoutMs: 60_000,
  async run(ctx) {
    const { db, settings } = ctx;
    const now = ctx.now();
    // 1. Evaluate audits the owner has judged since the last run.
    const judged = await db
      .select()
      .from(reviewItems)
      .where(and(eq(reviewItems.kind, 'audit_sample'), inArray(reviewItems.status, ['approved']), sql`NOT (${reviewItems.payload} ? 'evaluated')`));
    let proposals = 0;
    for (const item of judged) {
      const sample = (item.payload.sample ?? []) as AuditSampleItem[];
      const bands = precisionByBand(sample);
      await db
        .update(reviewItems)
        .set({ payload: sql`${reviewItems.payload} || ${JSON.stringify({ evaluated: now.toISOString(), bands })}::jsonb` })
        .where(eq(reviewItems.id, item.id));
      for (const b of bands.filter((x) => x.n >= 10 && x.lower < PRECISION_TARGET && x.band !== '<80')) {
        await ctx.inbox.escalate({
          kind: 'autonomy_proposal',
          severity: 'p2',
          category: 'data',
          title: `Precision in band ${b.band} is ${(b.precision * 100).toFixed(0)}% (lower bound ${(b.lower * 100).toFixed(0)}% < ${PRECISION_TARGET * 100}%): raise the auto-publish threshold?`,
          reasonCode: 'precision_below_target',
          payload: { band: b.band, n: b.n, correct: b.correct, precision: b.precision, lower: b.lower, currentPolicy: settings.policy },
          defaultAction: 'keep_current_value',
          dueInHours: settings.autonomy.slaDays * 24,
          dedupeKey: `autonomy:precision:${b.band}:${item.id}`,
          createdBy: 'agent:audit',
        });
        proposals++;
      }
    }

    // 2. Draw this month's sample (skip if the previous one is still open).
    const [open] = await db.select({ id: reviewItems.id }).from(reviewItems).where(and(eq(reviewItems.kind, 'audit_sample'), eq(reviewItems.status, 'pending'))).limit(1);
    if (open) return { status: 'success', summary: `previous audit still open · ${proposals} proposals` };
    const since = new Date(now.getTime() - 31 * 86_400_000);
    const rows = await db
      .select()
      .from(agentActions)
      .where(and(gte(agentActions.createdAt, since), lt(agentActions.createdAt, now), inArray(agentActions.action, [...AUDITABLE]), isNull(agentActions.revertedAt)))
      .orderBy(sql`random()`)
      .limit(settings.autonomy.auditSampleSize);
    if (!rows.length) return { status: 'success', summary: `no automated decisions to audit · ${proposals} proposals` };
    const sample: AuditSampleItem[] = rows.map((a) => ({
      actionId: a.id,
      action: a.action,
      toolId: a.toolId,
      confidence: a.confidence,
      decision: a.decision,
      sourceUrl: a.sourceUrl,
      at: a.createdAt.toISOString(),
    }));
    await ctx.inbox.escalate({
      kind: 'audit_sample',
      severity: 'p2',
      category: 'data',
      title: `Monthly audit: judge ${sample.length} automated decisions (~${Math.max(10, Math.round(sample.length * 1.2))} min)`,
      reasonCode: 'monthly_audit',
      payload: { sample, month: now.toISOString().slice(0, 7) },
      defaultAction: 'expire_p3',
      dueInHours: 14 * 24,
      dedupeKey: `audit:${now.toISOString().slice(0, 7)}`,
      createdBy: 'agent:audit',
    });
    ctx.stat('sampled', sample.length);
    ctx.stat('proposals', proposals);
    return { status: 'success', summary: `audit sample of ${sample.length} created · ${proposals} proposals` };
  },
};
