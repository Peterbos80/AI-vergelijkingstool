import { isEnabledLocale, type Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog, toolText } from '@/lib/catalog';
import { buildMatrix, parsePair } from '@/lib/engine/compare';
import { entryPriceLabel } from '@/components/data/format';
import { clipText, Frame, OG_SIZE, og, renderOg } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'AIToolsWijzer: two tools compared';

/** Fair Fight: two tools side by side with their entry prices. */
export default async function Image({ params }: { params: Promise<{ locale: string; pair: string }> }) {
  const { locale: raw, pair } = await params;
  const locale: Locale = isEnabledLocale(raw) ? raw : 'en';
  const t = getT(locale);
  const catalog = await getCatalog();
  const both = parsePair(pair, catalog);
  if (!both) {
    return renderOg(
      <Frame siteName={t('meta.siteName')} eyebrow={t('og.eyebrowSite')}>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 700 }}>{t('meta.tagline')}</div>
      </Frame>,
    );
  }
  const differences = buildMatrix(both).filter((r) => r.differs).length;
  const card = (tool: (typeof both)[number]) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: og.colors.card, border: `2px solid ${og.colors.line}`, borderRadius: 14, padding: '28px 32px' }}>
      <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, letterSpacing: -1 }}>{clipText(tool.name, 18)}</div>
      <div style={{ display: 'flex', marginTop: 10, fontSize: 26, color: og.colors.ink2 }}>{clipText(toolText(tool, locale)?.tagline ?? '', 60)}</div>
      <div style={{ display: 'flex', marginTop: 'auto', paddingTop: 20, fontFamily: 'Mono', fontSize: 26 }}>{t('og.from', { price: entryPriceLabel(tool, t, locale) })}</div>
    </div>
  );
  return renderOg(
    <Frame siteName={t('meta.siteName')} eyebrow={t('og.eyebrowFight')} footer={<div style={{ display: 'flex' }}>{t('og.differences', { count: differences })}</div>}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 28 }}>
        {card(both[0])}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 700, color: og.colors.signal }}>vs</div>
        {card(both[1])}
      </div>
    </Frame>,
  );
}
