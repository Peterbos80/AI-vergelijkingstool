'use server';
import { headers } from 'next/headers';
import { isEnabledLocale, type Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, visitorHash } from '@/lib/analytics/visitor';
import { EMAIL_RE, subscribe } from '@/lib/subscriptions';
import { emailEnabled } from '@/lib/env';

export interface NewsletterState {
  ok: boolean;
  message: string;
}

export async function newsletterAction(_prev: NewsletterState | null, formData: FormData): Promise<NewsletterState> {
  const locale = String(formData.get('locale') ?? '');
  if (!isEnabledLocale(locale) || !emailEnabled()) return { ok: false, message: '' };
  const t = getT(locale as Locale);
  const email = String(formData.get('email') ?? '').trim();
  if (!EMAIL_RE.test(email) || formData.get('consent') !== '1') return { ok: false, message: t('subscribe.invalid') };
  // Honeypot: bots fill every field.
  if (String(formData.get('website') ?? '') !== '') return { ok: true, message: t('subscribe.sent') };
  const h = await headers();
  if (!(await rateLimit(`sub:${visitorHash(clientIp(h), h.get('user-agent') ?? '')}`, 10, 3600))) {
    return { ok: false, message: t('subscribe.rateLimited') };
  }
  const res = await subscribe({ email, locale: locale as Locale, source: 'newsletter', newsletter: true, consentText: t('newsletter.consent') });
  return { ok: true, message: res === 'confirm_sent' ? t('subscribe.sent') : t('subscribe.alreadyConfirmed') };
}
