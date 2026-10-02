import { isEnabledLocale, type Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatMoney } from '@/i18n/formatters';
import { getCatalog } from '@/lib/catalog';
import { getStack } from '@/lib/stacks/store';
import { clipText, Frame, OG_SIZE, og, renderOg } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'AIToolsWijzer: AI tools advice';

/** A saved stack as a receipt: the tools and the monthly total per currency. */
export default async function Image({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale: Locale = isEnabledLocale(raw) ? raw : 'en';
  const t = getT(locale);
  const stack = await getStack(id);
  if (!stack) {
    return renderOg(
      <Frame siteName={t('meta.siteName')} eyebrow={t('og.eyebrowSite')}>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 700 }}>{t('meta.tagline')}</div>
      </Frame>,
    );
  }
  const catalog = await getCatalog();
  const { result, title } = stack.snapshot;
  const lines = result.lines.slice(0, 6);
  const totals = result.totals.core.paid.map((m) => formatMoney(m.cents, m.currency, locale)).join(' + ') || formatMoney(0, 'EUR', locale);
  return renderOg(
    <Frame siteName={t('meta.siteName')} eyebrow={t('og.eyebrowStack')} footer={<div style={{ display: 'flex', fontWeight: 700, color: og.colors.ink }}>{t('og.stackTotal', { total: totals })}</div>}>
      <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, letterSpacing: -1, lineHeight: 1.05 }}>{clipText(title, 60)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 28 }}>
        {lines.map((l) => (
          <div key={l.toolId} style={{ display: 'flex', background: og.colors.card, border: `2px solid ${og.colors.line}`, borderRadius: 999, padding: '10px 22px', fontSize: 28 }}>
            {catalog.toolsById.get(l.toolId)?.name ?? '—'}
          </div>
        ))}
      </div>
    </Frame>,
  );
}
