'use server';

import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { agentConfigs, reviewItems } from '@/lib/db/schema';
import { audit, can, requireAdmin } from '@/lib/auth/session';
import { applyDecision } from '@/lib/admin/decisions';
import { revertAction } from '@/agents/actions';
import { runAgent } from '@/agents/runner';
import { resolveItem } from '@/lib/ops/inbox';
import type { AuditSampleItem, Verdict } from '@/agents/defs/audit';

const UUID = /^[0-9a-f-]{36}$/i;
const OWNER_ONLY = new Set(['commercial', 'legal', 'security']);

async function loadItem(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!UUID.test(id)) redirect('/admin/inbox');
  const [item] = await getDb().select().from(reviewItems).where(eq(reviewItems.id, id));
  if (!item) redirect('/admin/inbox');
  return item;
}

export async function decideAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const item = await loadItem(formData);
  if ((OWNER_ONLY.has(item.category) || item.kind === 'autonomy_proposal') && !can(user, 'owner')) redirect(`/admin/inbox/${item.id}?flash=forbidden`);
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000) || null;
  const db = getDb();
  if (decision === 'snooze') {
    await db.update(reviewItems).set({ snoozedUntil: new Date(Date.now() + 7 * 86_400_000), updatedAt: new Date() }).where(eq(reviewItems.id, item.id));
    await audit(user, 'inbox_snooze', 'review_item', item.id);
    redirect('/admin/inbox?flash=done');
  }
  if (decision === 'default') {
    // Let the escalation agent apply the documented safe default right away.
    await db.update(reviewItems).set({ dueAt: new Date(Date.now() - 1000), snoozedUntil: null, updatedAt: new Date() }).where(eq(reviewItems.id, item.id));
    await audit(user, 'inbox_default_now', 'review_item', item.id);
    after(() => runAgent('escalation', { trigger: 'manual', force: true }).then(() => undefined));
    redirect('/admin/inbox?flash=done');
  }
  if (decision !== 'approve' && decision !== 'reject') redirect(`/admin/inbox/${item.id}`);
  const r = await applyDecision(db, item, decision, user, note);
  await audit(user, `inbox_${decision}`, 'review_item', item.id, { kind: item.kind, reason: item.reasonCode });
  if (!r.ok) redirect(`/admin/inbox/${item.id}?flash=conflict`);
  redirect(r.redirectTo ?? '/admin/inbox?flash=done');
}

export async function auditVerdictsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const item = await loadItem(formData);
  if (item.kind !== 'audit_sample' || item.status !== 'pending') redirect(`/admin/inbox/${item.id}`);
  const sample = ((item.payload.sample ?? []) as AuditSampleItem[]).map((s) => {
    const v = String(formData.get(`verdict_${s.actionId}`) ?? '');
    return ['correct', 'incorrect', 'unsure'].includes(v) ? { ...s, verdict: v as Verdict } : s;
  });
  const db = getDb();
  await db.update(reviewItems).set({ payload: { ...item.payload, sample }, updatedAt: new Date() }).where(eq(reviewItems.id, item.id));
  const complete = sample.every((s) => s.verdict);
  if (complete) await resolveItem(db, item.id, 'approved', `owner:${user.email}`, 'audit judged');
  await audit(user, 'audit_judged', 'review_item', item.id, { judged: sample.filter((s) => s.verdict).length });
  redirect(complete ? '/admin/inbox?flash=saved' : `/admin/inbox/${item.id}?flash=saved`);
}

export async function revertFromInboxAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const actionId = String(formData.get('actionId') ?? '');
  const back = String(formData.get('back') ?? '/admin/inbox');
  if (!UUID.test(actionId) || !back.startsWith('/admin/')) redirect('/admin/inbox');
  const r = await revertAction(getDb(), actionId, `owner:${user.email}`);
  await audit(user, 'revert_action', 'agent_action', actionId, { result: r });
  redirect(`${back}?flash=${r === 'not_reversible' ? 'notReversible' : r}`);
}

export async function reenableAgentAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const item = await loadItem(formData);
  const agent = String(item.payload.agent ?? '');
  if (agent) await getDb().update(agentConfigs).set({ enabled: true, consecutiveFailures: 0, updatedAt: new Date() }).where(eq(agentConfigs.agent, agent));
  await resolveItem(getDb(), item.id, 'approved', `owner:${user.email}`, 're-enabled');
  await audit(user, 'agent_reenabled', 'agent', agent);
  redirect('/admin/inbox?flash=done');
}
