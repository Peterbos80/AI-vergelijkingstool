/**
 * The owner inbox / escalation helper (docs/strategy/12 §5). Deduplicates by
 * key, bundles by group key, and always records a safe default action and a
 * deadline so "doing nothing" is a defined outcome.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { reviewItems, type InboxCategory, type InboxKind, type Severity } from '@/lib/db/schema';

export interface EscalationInput {
  kind: InboxKind;
  severity: Severity;
  category: InboxCategory;
  title: string;
  reasonCode: string;
  payload: Record<string, unknown>;
  toolId?: string | null;
  dedupeKey?: string;
  groupKey?: string;
  defaultAction?: string;
  dueInHours?: number;
  impact?: { pages?: number; visits30d?: number; evCentsPerMonth?: number; evBasis?: string };
  priority?: number;
  confidence?: number | null;
  createdBy: string;
  runId?: string | null;
}

export interface Escalator {
  escalate: (input: EscalationInput) => Promise<{ id: string; created: boolean }>;
}

export async function escalate(db: Database, input: EscalationInput): Promise<{ id: string; created: boolean }> {
  if (input.groupKey) {
    const [open] = await db
      .select({ id: reviewItems.id, payload: reviewItems.payload })
      .from(reviewItems)
      .where(and(eq(reviewItems.groupKey, input.groupKey), eq(reviewItems.status, 'pending')))
      .limit(1);
    if (open) {
      const items = Array.isArray(open.payload.items) ? (open.payload.items as unknown[]) : [];
      const next = [...items, input.payload].slice(-50);
      await db
        .update(reviewItems)
        .set({ groupCount: sql`${reviewItems.groupCount} + 1`, payload: { ...open.payload, items: next }, updatedAt: new Date() })
        .where(eq(reviewItems.id, open.id));
      return { id: open.id, created: false };
    }
  }
  const dueAt = input.dueInHours !== undefined ? new Date(Date.now() + input.dueInHours * 3600_000) : null;
  const inserted = await db
    .insert(reviewItems)
    .values({
      kind: input.kind,
      severity: input.severity,
      category: input.category,
      toolId: input.toolId ?? null,
      title: input.title.slice(0, 300),
      reasonCode: input.reasonCode,
      payload: input.groupKey ? { items: [input.payload] } : input.payload,
      impact: input.impact ?? null,
      confidence: input.confidence ?? null,
      priority: input.priority ?? (input.severity === 'p1' ? 90 : input.severity === 'p2' ? 60 : 30),
      defaultAction: input.defaultAction ?? null,
      dueAt,
      groupKey: input.groupKey ?? null,
      createdBy: input.createdBy,
      runId: input.runId ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing({ target: reviewItems.dedupeKey })
    .returning({ id: reviewItems.id });
  if (inserted[0]) return { id: inserted[0].id, created: true };
  const [existing] = await db.select({ id: reviewItems.id }).from(reviewItems).where(eq(reviewItems.dedupeKey, input.dedupeKey!)).limit(1);
  return { id: existing!.id, created: false };
}

export function escalator(db: Database, defaults: { createdBy: string; runId?: string | null }): Escalator {
  return {
    escalate: (input) => escalate(db, { ...input, createdBy: input.createdBy ?? defaults.createdBy, runId: input.runId ?? defaults.runId ?? null }),
  };
}

export async function resolveItem(
  db: Database,
  id: string,
  status: 'approved' | 'rejected' | 'auto_resolved' | 'defaulted' | 'expired',
  by: string,
  note?: string,
  resolution?: string,
): Promise<void> {
  await db
    .update(reviewItems)
    .set({ status, reviewedBy: by, reviewedAt: new Date(), reviewNote: note ?? null, resolution: resolution ?? null, updatedAt: new Date() })
    .where(eq(reviewItems.id, id));
}
