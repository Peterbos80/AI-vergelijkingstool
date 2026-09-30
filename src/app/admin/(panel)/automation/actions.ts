'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { audit, requireAdmin } from '@/lib/auth/session';
import { DEFAULT_SETTINGS, loadSettings, saveSetting, type Settings, type SettingsKey } from '@/lib/settings';
import { runAgent } from '@/agents/runner';

const SECTIONS = Object.keys(DEFAULT_SETTINGS) as SettingsKey[];

/** Cross-field rules the per-key schema cannot express. */
function crossCheck(key: SettingsKey, v: Record<string, unknown>): boolean {
  if (key === 'policy') return Number(v.autoPublish) >= Number(v.autoFlag) && Number(v.autoFlag) >= Number(v.queue);
  if (key === 'llm') return Number(v.gatingMin) <= Number(v.gatingThreshold) && Number(v.gatingThreshold) <= Number(v.gatingMax);
  return true;
}

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const key = String(formData.get('section') ?? '') as SettingsKey;
  if (!SECTIONS.includes(key)) redirect('/admin/automation');
  const db = getDb();
  const current = (await loadSettings(db))[key] as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current };
  for (const [field, value] of Object.entries(current)) {
    const raw = formData.get(field);
    if (raw === null) continue;
    const text = String(raw).trim();
    if (Array.isArray(value)) {
      const parts = text.split(/[,\s]+/).filter(Boolean).map(Number);
      next[field] = parts;
    } else if (typeof value === 'number') {
      next[field] = text === '' ? NaN : Number(text.replace(',', '.'));
    } else {
      next[field] = text;
    }
  }
  if (!crossCheck(key, next)) redirect(`/admin/automation?flash=invalid#${key}`);
  try {
    await saveSetting(db, key, next as Settings[typeof key], `owner:${user.email}`);
  } catch {
    redirect(`/admin/automation?flash=invalid#${key}`);
  }
  await audit(user, 'settings_saved', 'setting', key, { before: current, after: next });
  redirect(`/admin/automation?flash=saved#${key}`);
}

export async function checkNowAction(): Promise<void> {
  const user = await requireAdmin('editor');
  await runAgent('health', { trigger: 'manual', force: true });
  await audit(user, 'health_check_now');
  redirect('/admin/automation?flash=done#dependencies');
}
