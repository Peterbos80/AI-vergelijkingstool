/**
 * Double opt-in subscriptions for newsletter and Watch alerts (GDPR /
 * Telecommunicatiewet): nothing is sent except the confirmation until the
 * subscriber confirms. Tokens are random; only a hash of the confirm token
 * is stored.
 */
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { subscribers, watches } from '@/lib/db/schema';
import { token } from '@/lib/ids';
import { hashToken } from '@/lib/stacks/store';
import { siteUrl } from '@/lib/env';
import { queueEmail, flushOutbox } from '@/lib/email/outbox';
import { getT } from '@/i18n/server';
import type { Locale } from '@/i18n/config';

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export async function subscribe(input: {
  email: string;
  locale: Locale;
  source: 'newsletter' | 'stack_watch' | 'tool_watch';
  newsletter: boolean;
  consentText: string;
  stackId?: string;
  toolId?: string;
}): Promise<'confirm_sent' | 'already_confirmed'> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select().from(subscribers).where(eq(subscribers.email, email)).limit(1);
  let subscriberId: string;
  let confirmToken: string | null = null;
  if (existing && existing.status === 'confirmed') {
    subscriberId = existing.id;
    if (input.newsletter && !existing.newsletter) await db.update(subscribers).set({ newsletter: true }).where(eq(subscribers.id, existing.id));
  } else {
    confirmToken = token(24);
    if (existing) {
      subscriberId = existing.id;
      await db
        .update(subscribers)
        .set({
          status: 'pending',
          confirmTokenHash: hashToken(confirmToken),
          consentText: input.consentText,
          consentAt: new Date(),
          locale: input.locale,
          newsletter: existing.newsletter || input.newsletter,
          unsubscribedAt: null,
        })
        .where(eq(subscribers.id, existing.id));
    } else {
      const [row] = await db
        .insert(subscribers)
        .values({
          email,
          locale: input.locale,
          status: 'pending',
          confirmTokenHash: hashToken(confirmToken),
          unsubscribeToken: token(24),
          consentText: input.consentText,
          source: input.source,
          newsletter: input.newsletter,
        })
        .returning({ id: subscribers.id });
      subscriberId = row!.id;
    }
  }
  if (input.stackId || input.toolId) {
    const conds = [eq(watches.subscriberId, subscriberId)];
    if (input.stackId) conds.push(eq(watches.stackId, input.stackId));
    if (input.toolId) conds.push(eq(watches.toolId, input.toolId));
    const [w] = await db.select().from(watches).where(and(...conds)).limit(1);
    if (!w) await db.insert(watches).values({ subscriberId, stackId: input.stackId ?? null, toolId: input.toolId ?? null });
  }
  if (!confirmToken) return 'already_confirmed';
  const t = getT(input.locale);
  const link = siteUrl(`/${input.locale}/newsletter/confirm?token=${confirmToken}`);
  await queueEmail({
    to: email,
    kind: 'confirm',
    subject: t('subscribe.emailSubject'),
    text: t('subscribe.emailBody', { link }),
  });
  await flushOutbox(5);
  return 'confirm_sent';
}

export async function confirmSubscription(confirmToken: string): Promise<boolean> {
  if (!/^[\w-]{20,64}$/.test(confirmToken)) return false;
  const db = getDb();
  const [row] = await db.select().from(subscribers).where(eq(subscribers.confirmTokenHash, hashToken(confirmToken))).limit(1);
  if (!row) return false;
  await db
    .update(subscribers)
    .set({ status: 'confirmed', confirmedAt: new Date(), confirmTokenHash: null })
    .where(eq(subscribers.id, row.id));
  return true;
}

export async function unsubscribe(unsubscribeToken: string): Promise<boolean> {
  if (!/^[\w-]{20,64}$/.test(unsubscribeToken)) return false;
  const db = getDb();
  const [row] = await db.select().from(subscribers).where(eq(subscribers.unsubscribeToken, unsubscribeToken)).limit(1);
  if (!row) return false;
  await db.update(subscribers).set({ status: 'unsubscribed', unsubscribedAt: new Date(), newsletter: false }).where(eq(subscribers.id, row.id));
  await db.delete(watches).where(eq(watches.subscriberId, row.id));
  return true;
}
