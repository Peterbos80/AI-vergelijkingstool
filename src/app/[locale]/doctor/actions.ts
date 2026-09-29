'use server';
import { headers } from 'next/headers';
import { isEnabledLocale, type Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, visitorHash } from '@/lib/analytics/visitor';
import { EMAIL_RE } from '@/lib/subscriptions';
import { emailEnabled } from '@/lib/env';
import { flushOutbox, queueEmail } from '@/lib/email/outbox';

export interface LeadState {
  ok: boolean;
  message: string;
}

const SIZES = new Set(['1', '2-10', '11-50', '51-250', '250+']);

export async function leadAction(_prev: LeadState | null, formData: FormData): Promise<LeadState> {
  const locale = String(formData.get('locale') ?? '');
  if (!isEnabledLocale(locale)) return { ok: false, message: '' };
  const t = getT(locale as Locale);
  if (String(formData.get('website') ?? '') !== '') return { ok: true, message: t('lead.thanks') }; // honeypot
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  const company = String(formData.get('company') ?? '').trim().slice(0, 160) || null;
  const size = String(formData.get('size') ?? '');
  const message = String(formData.get('message') ?? '').trim().slice(0, 2000) || null;
  if (!name || !EMAIL_RE.test(email) || formData.get('consent') !== '1') return { ok: false, message: t('lead.invalid') };
  const h = await headers();
  if (!(await rateLimit(`lead:${visitorHash(clientIp(h), h.get('user-agent') ?? '')}`, 5, 3600))) {
    return { ok: false, message: t('subscribe.rateLimited') };
  }
  await getDb()
    .insert(leads)
    .values({ kind: 'stack_advice', name, email, company, companySize: SIZES.has(size) ? size : null, message, locale });
  if (emailEnabled()) {
    await queueEmail({ to: email, kind: 'lead_ack', subject: t('lead.ackSubject'), text: t('lead.ackBody', { name }) });
    await flushOutbox(3);
  }
  return { ok: true, message: t('lead.thanks') };
}
