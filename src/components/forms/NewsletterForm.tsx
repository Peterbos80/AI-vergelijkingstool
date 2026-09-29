import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { newsletterAction } from '@/app/[locale]/newsletter/actions';
import { NewsletterFormClient } from './NewsletterFormClient';

export function NewsletterForm({ locale, t }: { locale: Locale; t: Translator }) {
  return (
    <NewsletterFormClient
      action={newsletterAction}
      locale={locale}
      labels={{ email: t('subscribe.email'), consent: t('newsletter.consent'), submit: t('subscribe.submit') }}
    />
  );
}
