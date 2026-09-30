import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import type { ToolDetail } from '@/lib/catalog/detail';
import { ReceiptDrawer } from './ReceiptDrawer';
import { StatusStamp } from './StatusStamp';
import { factValueLabel } from './format';

/** A value we have recorded (null, undefined and empty lists are not). */
export function hasFactValue(v: unknown): boolean {
  return v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
}

/**
 * Fact rows with value, status stamp and receipts. Only recorded values are
 * shown: a fact we have no sourced value for is left out, never guessed.
 * Keys in `technical` only show in the Advanced view.
 */
export function FactList({
  keys,
  detail,
  snapshot,
  t,
  locale,
  technical = [],
}: {
  keys: string[];
  detail: ToolDetail;
  snapshot: Record<string, unknown>;
  t: Translator;
  locale: Locale;
  technical?: string[];
}) {
  const shown = keys.filter((key) => hasFactValue(detail.facts[key] ? detail.facts[key].value : snapshot[key]));
  return (
    <dl className="divide-y divide-line">
      {shown.map((key) => {
        const receipt = detail.facts[key];
        const value = receipt ? receipt.value : snapshot[key];
        return (
          <div key={key} className={`grid grid-cols-[1fr_auto] gap-x-3 py-2.5 text-sm ${technical.includes(key) ? 'only-advanced' : ''}`}>
            <dt className="text-ink-2">{t(`facts.${key}`)}</dt>
            <dd className="text-right">
              <span className="font-medium">{factValueLabel(key, value ?? null, t)}</span>{' '}
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
