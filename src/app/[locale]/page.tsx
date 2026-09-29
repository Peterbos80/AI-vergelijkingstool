import { getT } from '@/i18n/server';
import type { Locale } from '@/i18n/config';

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  const t = getT(locale as Locale);
  return (
    <div className="container-page py-16">
      <h1 className="text-4xl">{t('meta.tagline')}</h1>
    </div>
  );
}
