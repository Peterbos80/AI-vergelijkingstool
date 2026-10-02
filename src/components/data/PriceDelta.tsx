import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatMoney } from '@/i18n/formatters';
import { Icon } from '@/components/ui/Icon';

interface Money {
  priceCents: number;
  currency: string;
}

function money(v: unknown): Money | null {
  if (!v || typeof v !== 'object') return null;
  const { priceCents, currency } = v as Record<string, unknown>;
  return typeof priceCents === 'number' && Number.isFinite(priceCents) && priceCents >= 0 && typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)
    ? { priceCents, currency }
    : null;
}

/**
 * The price change of a Pulse event: the old price struck through, an arrow,
 * the new price and the change in percent, coloured by direction (never the
 * only signal: the words "was" and "nu" are there for screen readers too).
 * Renders nothing unless both prices are known in the same currency.
 */
export function PriceDelta({ oldValue, newValue, t, locale }: { oldValue: unknown; newValue: unknown; t: Translator; locale: Locale }) {
  const before = money(oldValue);
  const after = money(newValue);
  if (!before || !after || before.currency !== after.currency || before.priceCents === after.priceCents) return null;
  const pct = before.priceCents > 0 ? Math.round(((after.priceCents - before.priceCents) / before.priceCents) * 100) : null;
  const dir = after.priceCents > before.priceCents ? 'up' : 'down';
  return (
    <p className="price-delta" data-dir={dir}>
      <span className="visually-hidden">{t('pulse.was')}</span>
      <s className="num">{formatMoney(before.priceCents, before.currency, locale)}</s>
      <Icon name="arrow-right" size={14} />
      <span className="visually-hidden">{t('pulse.now')}</span>
      <span className="num price-delta-new">{formatMoney(after.priceCents, after.currency, locale)}</span>
      {pct !== null && pct !== 0 && (
        <span className="price-delta-pct">
          {pct > 0 ? '+' : '−'}
          {Math.abs(pct)}%
        </span>
      )}
    </p>
  );
}
