'use server';
import { redirect } from 'next/navigation';
import { isEnabledLocale } from '@/i18n/config';
import { confirmSubscription, unsubscribe } from '@/lib/subscriptions';

export async function confirmAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'nl');
  const ok = await confirmSubscription(String(formData.get('token') ?? ''));
  redirect(`/${isEnabledLocale(locale) ? locale : 'nl'}/newsletter/confirm?done=${ok ? '1' : '0'}`);
}

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'nl');
  const ok = await unsubscribe(String(formData.get('token') ?? ''));
  redirect(`/${isEnabledLocale(locale) ? locale : 'nl'}/newsletter/unsubscribe?done=${ok ? '1' : '0'}`);
}
