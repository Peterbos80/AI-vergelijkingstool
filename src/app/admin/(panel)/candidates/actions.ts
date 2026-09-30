'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { reviewItems, toolCandidates } from '@/lib/db/schema';
import { audit, requireAdmin } from '@/lib/auth/session';
import { promoteCandidate } from '@/lib/admin/candidates';
import { resolveItem } from '@/lib/ops/inbox';

const UUID = /^[0-9a-f-]{36}$/i;

async function closeInboxItem(candidateId: string, status: 'approved' | 'rejected', by: string) {
  const db = getDb();
  const [c] = await db.select().from(toolCandidates).where(eq(toolCandidates.id, candidateId));
  if (!c) return;
  const [item] = await db.select().from(reviewItems).where(eq(reviewItems.dedupeKey, `new_tool:${c.domain}`));
  if (item && item.status === 'pending') await resolveItem(db, item.id, status, by);
}

export async function promoteAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const id = String(formData.get('candidateId') ?? '');
  if (!UUID.test(id)) redirect('/admin/candidates');
  await closeInboxItem(id, 'approved', `owner:${user.email}`);
  const r = await promoteCandidate(getDb(), id);
  await audit(user, 'candidate_promoted', 'tool_candidate', id, { toolId: r?.toolId });
  redirect(r ? `/admin/tools/${r.toolId}?flash=draftCreated` : '/admin/candidates?flash=already');
}

export async function rejectCandidateAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const id = String(formData.get('candidateId') ?? '');
  if (!UUID.test(id)) redirect('/admin/candidates');
  await closeInboxItem(id, 'rejected', `owner:${user.email}`);
  await getDb().update(toolCandidates).set({ status: 'rejected', notes: 'rejected by owner' }).where(eq(toolCandidates.id, id));
  await audit(user, 'candidate_rejected', 'tool_candidate', id);
  redirect('/admin/candidates?flash=done');
}
