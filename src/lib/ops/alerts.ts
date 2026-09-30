/**
 * P1 alerts by e-mail (docs/strategy/12 §5). The owner is an exception
 * handler, so an item that needs action today must reach them without opening
 * Admin. One e-mail per new P1 item, at most MAX_ALERTS_PER_DAY; anything
 * beyond that stays in Admin and the weekly report. The notifier agent
 * delivers the outbox every 15 minutes.
 */
import { and, count, eq, gt } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { emailOutbox } from '@/lib/db/schema';
import { emailEnabled, env, siteUrl } from '@/lib/env';
import { queueEmail } from '@/lib/email/outbox';
import { getT } from '@/i18n/server';
import { loadSettings } from '@/lib/settings';
import { ifNothing, kindLabel, reasonText } from '@/lib/admin/labels';

export const MAX_ALERTS_PER_DAY = 10;

export interface AlertItem {
  id: string;
  kind: string;
  title: string;
  reasonCode: string | null;
  defaultAction: string | null;
  dueAt: Date | null;
}

/** Queue the alert e-mail for a new P1 item. Returns false when not sent (no owner address, no e-mail, daily cap). */
export async function alertOwner(db: Database, item: AlertItem, now: Date): Promise<boolean> {
  const to = env().OWNER_EMAIL;
  if (!to || !emailEnabled()) return false;
  const [sent] = await db
    .select({ n: count() })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.kind, 'alert'), gt(emailOutbox.createdAt, new Date(now.getTime() - 86_400_000))));
  if ((sent?.n ?? 0) >= MAX_ALERTS_PER_DAY) return false;
  const locale = (await loadSettings(db)).owner.locale;
  const t = getT(locale);
  const kind = kindLabel(t, item.kind);
  const text = [
    t('admin.alert.intro'),
    '',
    `${kind}: ${reasonText(t, item.reasonCode, item.title)}`,
    ifNothing(t, locale, item.defaultAction, item.dueAt),
    '',
    `${t('admin.alert.open')}: ${siteUrl(`/admin/inbox/${item.id}`)}`,
    '',
    t('admin.alert.footer', { max: MAX_ALERTS_PER_DAY }),
  ].join('\n');
  await queueEmail({ to, subject: t('admin.alert.subject', { kind }), text, kind: 'alert' }, db);
  return true;
}
