import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDate } from '@/i18n/formatters';
import type { Freshness } from '@/lib/db/schema';

export function StaleBanner({ freshness, checkedAt, t, locale }: { freshness: Freshness; checkedAt: Date | null; t: Translator; locale: Locale }) {
  if (freshness !== 'stale') return null;
  return (
    <p role="status" className="notice notice-warning">
      {t('freshness.staleBanner', { date: formatDate(checkedAt, locale) })}
    </p>
  );
}
