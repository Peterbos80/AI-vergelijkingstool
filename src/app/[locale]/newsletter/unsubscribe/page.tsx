import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { unsubscribeAction } from '../confirm/actions';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function UnsubscribePage({ params, searchParams }: PageProps<'/[locale]/newsletter/unsubscribe'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  if (sp.done === '1' || sp.done === '0') {
    return (
      <div className="container-page py-16">
        <h1 className="text-3xl">{sp.done === '1' ? t('subscribe.unsubscribedTitle') : t('subscribe.unsubscribeFailed')}</h1>
        {sp.done === '1' && <p className="mt-3 text-ink-2">{t('subscribe.unsubscribedBody')}</p>}
      </div>
    );
  }
  const token = typeof sp.token === 'string' ? sp.token : '';
  return (
    <div className="container-page py-16">
      <h1 className="text-3xl">{t('subscribe.unsubscribeTitle')}</h1>
      <form action={unsubscribeAction} className="mt-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="btn">
          {t('subscribe.unsubscribeButton')}
        </button>
      </form>
    </div>
  );
}
