import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDate, formatDayMonth } from '@/i18n/formatters';
import type { Catalog } from '@/lib/catalog/types';
import { approxEur } from './format';

/**
 * Amounts are facts: always Plex Mono (`.num`), never tabular-nums on the
 * grotesk (it widens the decimal comma). The original price stays the main
 * figure; a euro conversion is shown only with the ECB date it was made with.
 */
export function FxApprox({
  cents,
  currency,
  fx,
  t,
  locale,
  className = '',
}: {
  cents: number | null;
  currency: string | null;
  fx: Catalog['fx'];
  t: Translator;
  locale: Locale;
  className?: string;
}) {
  // Nothing to convert for a free plan (0) or a price on request (null).
  const eur = cents !== null && cents > 0 ? approxEur(cents, currency, fx.rates, locale) : null;
  if (!eur || !fx.day) return null;
  return (
    <span className={`num text-xs font-normal text-ink-3 ${className}`} title={t('common.fxNote', { date: formatDate(fx.day, locale) })}>
      {t('common.approxEurEcb', { amount: eur, date: formatDayMonth(fx.day, locale) })}
    </span>
  );
}
