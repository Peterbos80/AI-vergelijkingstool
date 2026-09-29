import Link from 'next/link';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, isEnabledLocale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { href } from '@/lib/routes';

export default async function NotFound() {
  const path = (await headers()).get('x-pathname') ?? '';
  const first = path.split('/')[1];
  const locale = isEnabledLocale(first) ? first : DEFAULT_LOCALE;
  const t = getT(locale);
  return (
    <div className="container-page py-24">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-3xl md:text-4xl">{t('errors.notFoundTitle')}</h1>
      <p className="mt-3 max-w-xl text-ink-2">{t('errors.notFoundBody')}</p>
      <Link href={href.home(locale)} className="btn mt-8">
        {t('errors.notFoundCta')}
      </Link>
    </div>
  );
}
