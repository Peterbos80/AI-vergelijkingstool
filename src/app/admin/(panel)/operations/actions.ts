'use server';

import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { agentConfigs } from '@/lib/db/schema';
import { audit, requireAdmin } from '@/lib/auth/session';
import { isAgentName } from '@/agents/registry';
import { ensureAgentConfigs, runAgent } from '@/agents/runner';
import { revertAction, revertRun } from '@/agents/actions';

const UUID = /^[0-9a-f-]{36}$/i;

export async function runNowAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const agent = String(formData.get('agent') ?? '');
  if (!isAgentName(agent)) redirect('/admin/operations');
  await audit(user, 'agent_run_now', 'agent', agent);
  // Runs after the response; the page shows the result on refresh.
  after(() => runAgent(agent, { trigger: 'manual', force: true }).then(() => undefined));
  redirect('/admin/operations?flash=started');
}

export async function toggleAgentAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const agent = String(formData.get('agent') ?? '');
  const enable = formData.get('enable') === '1';
  if (!isAgentName(agent)) redirect('/admin/operations');
  const db = getDb();
  await ensureAgentConfigs(db);
  await db.update(agentConfigs).set({ enabled: enable, consecutiveFailures: enable ? 0 : undefined, updatedAt: new Date() }).where(eq(agentConfigs.agent, agent));
  await audit(user, enable ? 'agent_enabled' : 'agent_disabled', 'agent', agent);
  redirect('/admin/operations?flash=saved');
}

export async function revertActionAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const id = String(formData.get('actionId') ?? '');
  const back = String(formData.get('back') ?? '/admin/operations');
  if (!UUID.test(id) || !back.startsWith('/admin/')) redirect('/admin/operations');
  const r = await revertAction(getDb(), id, `owner:${user.email}`);
  await audit(user, 'revert_action', 'agent_action', id, { result: r });
  redirect(`${back}?flash=${r === 'not_reversible' ? 'notReversible' : r}`);
}

export async function revertRunAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const id = String(formData.get('runId') ?? '');
  if (!UUID.test(id)) redirect('/admin/operations');
  const r = await revertRun(getDb(), id, `owner:${user.email}`);
  await audit(user, 'revert_run', 'agent_run', id, r);
  redirect(`/admin/operations/runs/${id}?flash=revertedRun&r=${r.reverted}&s=${r.skipped}`);
}
