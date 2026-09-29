/**
 * E-mail via an outbox table. Without RESEND_API_KEY messages stay in the
 * outbox with status "logged" (visible in Admin) — nothing is silently lost
 * and nothing pretends to be sent.
 */
import { and, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { emailOutbox } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { logError } from '@/lib/ops/errors';

export type EmailKind = 'confirm' | 'digest' | 'alert' | 'lead_ack' | 'other';

export async function queueEmail(msg: { to: string; subject: string; text: string; html?: string; kind: EmailKind }): Promise<string> {
  const [row] = await getDb()
    .insert(emailOutbox)
    .values({ toEmail: msg.to, subject: msg.subject.slice(0, 250), bodyText: msg.text, bodyHtml: msg.html ?? null, kind: msg.kind })
    .returning({ id: emailOutbox.id });
  return row!.id;
}

async function sendViaResend(to: string, subject: string, text: string, html: string | null): Promise<string> {
  const e = env();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: e.EMAIL_FROM ?? 'AIToolsWijzer <alerts@aitoolswijzer.nl>', to: [to], subject, text, ...(html ? { html } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { id?: string };
  return body.id ?? '';
}

/** Deliver queued messages (used by the Notifier agent and right after queueing). */
export async function flushOutbox(limit = 20): Promise<{ sent: number; failed: number; logged: number }> {
  const db = getDb();
  const stats = { sent: 0, failed: 0, logged: 0 };
  const hasProvider = Boolean(env().RESEND_API_KEY);
  const queued = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, 'queued'), lt(emailOutbox.createdAt, new Date(Date.now() + 1000))))
    .limit(limit);
  for (const m of queued) {
    if (!hasProvider) {
      await db.update(emailOutbox).set({ status: 'logged' }).where(eq(emailOutbox.id, m.id));
      stats.logged++;
      continue;
    }
    try {
      const id = await sendViaResend(m.toEmail, m.subject, m.bodyText, m.bodyHtml);
      await db.update(emailOutbox).set({ status: 'sent', providerMessageId: id, sentAt: new Date(), error: null }).where(eq(emailOutbox.id, m.id));
      stats.sent++;
    } catch (err) {
      stats.failed++;
      await db
        .update(emailOutbox)
        .set({ status: sql`CASE WHEN ${emailOutbox.createdAt} < now() - interval '24 hours' THEN 'failed' ELSE 'queued' END`, error: err instanceof Error ? err.message.slice(0, 500) : 'send failed' })
        .where(eq(emailOutbox.id, m.id));
      await logError('email', 'send failed', err);
    }
  }
  return stats;
}
