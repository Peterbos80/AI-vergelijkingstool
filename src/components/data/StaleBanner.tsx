import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDate } from '@/i18n/formatters';
import type { Freshness } from '@/lib/db/schema';
import { Icon } from '@/components/ui/Icon';

export function StaleBanner({ freshness, checkedAt, t, locale }: { freshness: Freshness; checkedAt: Date | null; t: Translator; locale: Locale }) {
  if (freshness !== 'stale') return null;
  return (
    <p role="status" className="notice notice-warning flex items-start gap-2">
      <Icon name="triangle-alert" size={16} className="mt-0.5" />
      <span>{t('freshness.staleBanner', { date: formatDate(checkedAt, locale) })}</span>
    </p>
  );
}
