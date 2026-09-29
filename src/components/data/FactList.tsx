import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import type { ToolDetail } from '@/lib/catalog/detail';
import { ReceiptDrawer } from './ReceiptDrawer';
import { StatusStamp } from './StatusStamp';
import { factValueLabel } from './format';

/**
 * Fact rows with value, status stamp and receipts. Unknown values are shown
 * as unknown — never guessed.
 */
export function FactList({
  keys,
  detail,
  snapshot,
  t,
  locale,
}: {
  keys: string[];
  detail: ToolDetail;
  snapshot: Record<string, unknown>;
  t: Translator;
  locale: Locale;
}) {
  return (
    <dl className="divide-y divide-line">
      {keys.map((key) => {
        const receipt = detail.facts[key];
        const value = receipt ? receipt.value : snapshot[key];
        return (
          <div key={key} className="grid grid-cols-[1fr_auto] gap-x-3 py-2.5 text-sm">
            <dt className="text-ink-2">{t(`facts.${key}`)}</dt>
            <dd className="text-right">
              <span className={value === null || value === undefined ? 'text-ink-3' : 'font-medium'}>
                {factValueLabel(key, value ?? null, t)}
              </span>{' '}
              {receipt && <StatusStamp status={receipt.status} t={t} compact />}
            </dd>
            {receipt && (
              <dd className="col-span-2">
                <ReceiptDrawer receipt={receipt} t={t} locale={locale} />
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
