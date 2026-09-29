'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { isEnabledLocale, type Locale } from '@/i18n/config';
import { getDb } from '@/lib/db/client';
import { stacks } from '@/lib/db/schema';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, visitorHash } from '@/lib/analytics/visitor';
import { EMAIL_RE, subscribe } from '@/lib/subscriptions';
import { getT } from '@/i18n/server';
import { getStack, hashToken, MY_STACKS_COOKIE, parseMyStacks, serializeMyStacks } from '@/lib/stacks/store';

export interface FormState {
  ok: boolean;
  message: string;
}

export async function watchStackAction(_prev: FormState | null, formData: FormData): Promise<FormState> {
  const locale = String(formData.get('locale') ?? '');
  if (!isEnabledLocale(locale)) return { ok: false, message: 'invalid locale' };
  const t = getT(locale as Locale);
  const email = String(formData.get('email') ?? '').trim();
  const consent = formData.get('consent') === '1';
  const newsletter = formData.get('newsletter') === '1';
  const stackPublicId = String(formData.get('stack') ?? '');
  if (!EMAIL_RE.test(email) || !consent) return { ok: false, message: t('subscribe.invalid') };
  const h = await headers();
  if (!(await rateLimit(`sub:${visitorHash(clientIp(h), h.get('user-agent') ?? '')}`, 10, 3600))) {
    return { ok: false, message: t('subscribe.rateLimited') };
  }
  const stack = await getStack(stackPublicId);
  if (!stack) return { ok: false, message: t('stackPage.notFound') };
  const res = await subscribe({
    email,
    locale: locale as Locale,
    source: 'stack_watch',
    newsletter,
    consentText: [t('subscribe.consent'), newsletter ? t('subscribe.consentNewsletter') : ''].filter(Boolean).join(' '),
    stackId: stack.id,
  });
  return { ok: true, message: res === 'confirm_sent' ? t('subscribe.sent') : t('subscribe.alreadyConfirmed') };
}

export async function deleteStackAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'nl');
  const id = String(formData.get('stack') ?? '');
  const jar = await cookies();
  const mine = parseMyStacks(jar.get(MY_STACKS_COOKIE)?.value);
  const entry = mine.find((x) => x.id === id);
  const stack = await getStack(id);
  if (entry && stack && stack.editTokenHash === hashToken(entry.token)) {
    await getDb().delete(stacks).where(eq(stacks.id, stack.id));
    jar.set(MY_STACKS_COOKIE, serializeMyStacks(mine.filter((x) => x.id !== id)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect(`/${isEnabledLocale(locale) ? locale : 'nl'}/my-stack`);
}
