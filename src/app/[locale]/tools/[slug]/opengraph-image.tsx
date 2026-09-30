import { isEnabledLocale, type Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate } from '@/i18n/formatters';
import { getCatalog, toolText } from '@/lib/catalog';
import { entryPriceLabel, planPriceLabel } from '@/components/data/format';
import { clipText, Frame, OG_SIZE, og, renderOg, Stamp } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'AIToolsWijzer receipt';

/** Tool "receipt": entry price with its evidence status and the date it was checked. */
export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isEnabledLocale(raw) ? raw : 'en';
  const t = getT(locale);
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(slug);
  if (!tool) {
    return renderOg(
      <Frame siteName={t('meta.siteName')} eyebrow={t('og.eyebrowSite')}>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 700 }}>{t('meta.tagline')}</div>
      </Frame>,
    );
  }
  const text = toolText(tool, locale);
  const plans = tool.plans.filter((p) => !p.isCustom).slice(0, 4);
  return renderOg(
    <Frame
      siteName={t('meta.siteName')}
      eyebrow={t('og.eyebrowTool', { date: formatDate(tool.priceCheckedAt ?? tool.lastCheckedAt, locale) })}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexGrow: 1 }}>
          <div style={{ display: 'flex', fontWeight: 700, color: og.colors.ink }}>{t('og.from', { price: entryPriceLabel(tool, t, locale) })}</div>
          {tool.pricingStatus && <Stamp status={tool.pricingStatus} label={t(`status.${tool.pricingStatus}.label`)} />}
          <div style={{ display: 'flex', marginLeft: 'auto', fontFamily: 'Mono', fontSize: 20, color: og.colors.ink3 }}>{t('og.sources')}</div>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, maxWidth: plans.length ? 640 : 1072 }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{clipText(tool.name, 24)}</div>
          {text?.tagline && <div style={{ display: 'flex', marginTop: 20, fontSize: 34, color: og.colors.ink2, lineHeight: 1.25 }}>{clipText(text.tagline, 90)}</div>}
        </div>
        {plans.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', width: 380, background: og.colors.card, border: `2px solid ${og.colors.line}`, borderRadius: 14, padding: '18px 24px' }}>
            {plans.map((p, i) => (
              <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderTop: i ? `2px dashed ${og.colors.line}` : 'none', fontSize: 26 }}>
                <div style={{ display: 'flex', fontWeight: 700 }}>{clipText(p.name, 16)}</div>
                <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 24 }}>{planPriceLabel(p, t, locale)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Frame>,
  );
}
