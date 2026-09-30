/** Shared server context for admin pages: owner locale, translator, settings. */
import { getDb } from '@/lib/db/client';
import { getT } from '@/i18n/server';
import { loadSettings } from '@/lib/settings';

export async function adminContext() {
  const db = getDb();
  const settings = await loadSettings(db);
  const locale = settings.owner.locale;
  return { db, settings, locale, t: getT(locale) };
}

export type AdminContext = Awaited<ReturnType<typeof adminContext>>;
