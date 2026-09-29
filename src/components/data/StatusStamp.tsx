import type { FactStatus } from '@/lib/db/schema';
import type { Translator } from '@/i18n/format';

/** Status stamp with a text label (never colour-only; docs/strategy/10 §7). */
export function StatusStamp({
  status,
  t,
  title,
  compact = false,
}: {
  status: FactStatus;
  t: Translator;
  title?: string;
  compact?: boolean;
}) {
  return (
    <span className={`stamp stamp-${status}`} title={title ?? t(`status.${status}.tooltip`)}>
      {compact ? t(`status.${status}.short`) : t(`status.${status}.label`)}
    </span>
  );
}
