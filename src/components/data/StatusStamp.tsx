import type { FactStatus } from '@/lib/db/schema';
import type { Translator } from '@/i18n/format';

/**
 * The rubber stamp: status as a full word, never abbreviated or colour-only
 * (docs/strategy/10 §7). Used in the receipts drawer and on receipts; dense
 * rows and tables use the quieter ReceiptChip.
 */
export function StatusStamp({ status, t, title }: { status: FactStatus; t: Translator; title?: string }) {
  return (
    <span className={`stamp stamp-${status}`} title={title ?? t(`status.${status}.tooltip`)}>
      {t(`status.${status}.label`)}
    </span>
  );
}
