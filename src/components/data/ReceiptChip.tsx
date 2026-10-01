import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDayMonth } from '@/i18n/formatters';
import type { FactStatus } from '@/lib/db/schema';
import { Icon, type IconName } from '@/components/ui/Icon';

/** One glyph per evidence status (components/ui/Icon). */
export const STATUS_GLYPH: Record<FactStatus, IconName> = {
  verified: 'badge-check',
  supported: 'files',
  community: 'users',
  unverified: 'circle-dashed',
};

/** "Onderbouwd · 2 bronnen · 29 sep": the parts we know, never abbreviated. */
export function receiptChipName({
  status,
  t,
  locale,
  sources,
  date,
}: {
  status: FactStatus;
  t: Translator;
  locale: Locale;
  sources?: number;
  date?: Date | null;
}): string {
  const parts = [t(`status.${status}.label`)];
  if (sources !== undefined) parts.push(t('receipts.sourceCount', { count: sources }));
  if (date) parts.push(formatDayMonth(date, locale));
  return parts.join(' · ');
}

/**
 * The compact receipt chip for dense rows and tables (Compare, tool rows,
 * fact lists): the status glyph in a 24px box on the status tint, with the
 * full status, source count and date as its name. With `href` it leads to
 * the sources. The loud rubber stamp (StatusStamp) stays in the receipts
 * drawer and on receipts.
 */
export function ReceiptChip({
  status,
  t,
  locale,
  sources,
  date,
  href,
}: {
  status: FactStatus;
  t: Translator;
  locale: Locale;
  sources?: number;
  date?: Date | null;
  href?: string;
}) {
  const name = receiptChipName({ status, t, locale, sources, date });
  const content = (
    <>
      <Icon name={STATUS_GLYPH[status]} size={16} />
      <span className="visually-hidden">{name}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`rchip rchip-${status}`} title={`${name} · ${t('receipts.open')}`} prefetch={false}>
        {content}
      </Link>
    );
  }
  return (
    <span className={`rchip rchip-${status}`} title={name}>
      {content}
    </span>
  );
}
