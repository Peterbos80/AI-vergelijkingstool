import { isEnabledLocale, type Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { Frame, OG_SIZE, renderOg, og } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'AIToolsWijzer';

/** Default share image for every page without its own receipt. */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isEnabledLocale(raw) ? raw : 'en';
  const t = getT(locale);
  let stats: { tools: number } | null = null;
  try {
    stats = { tools: (await getCatalog()).tools.length };
  } catch {
    stats = null;
  }
  return renderOg(
    <Frame siteName={t('meta.siteName')} eyebrow={t('og.eyebrowSite')} footer={stats ? <div style={{ display: 'flex' }}>{t('og.siteFooter', { count: stats.tools })}</div> : undefined}>
      <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{t('meta.tagline')}</div>
      <div style={{ display: 'flex', marginTop: 24, fontSize: 32, color: og.colors.ink2, maxWidth: 980 }}>{t('og.siteSub')}</div>
    </Frame>,
  );
}
