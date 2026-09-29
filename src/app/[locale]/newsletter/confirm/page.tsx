import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { confirmAction } from './actions';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Confirmation needs an explicit click (POST): link scanners that prefetch
 * e-mail links must not be able to confirm on someone's behalf.
 */
export default async function ConfirmPage({ params, searchParams }: PageProps<'/[locale]/newsletter/confirm'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  if (sp.done === '1' || sp.done === '0') {
    return (
      <div className="container-page py-16">
        <h1 className="text-3xl">{sp.done === '1' ? t('subscribe.confirmedTitle') : t('subscribe.confirmFailed')}</h1>
        {sp.done === '1' && <p className="mt-3 text-ink-2">{t('subscribe.confirmedBody')}</p>}
      </div>
    );
  }
  const token = typeof sp.token === 'string' ? sp.token : '';
  return (
    <div className="container-page py-16">
      <h1 className="text-3xl">{t('subscribe.confirmTitle')}</h1>
      <form action={confirmAction} className="mt-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="btn">
          {t('subscribe.confirmButton')}
        </button>
      </form>
    </div>
  );
}
