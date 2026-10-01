import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import type { ToolDetail } from '@/lib/catalog/detail';
import { Icon } from '@/components/ui/Icon';
import { ReceiptPanel } from './ReceiptDrawer';
import { ReceiptChip } from './ReceiptChip';
import { factValueLabel } from './format';

/** A value we have recorded (null, undefined and empty lists are not). */
export function hasFactValue(v: unknown): boolean {
  return v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
}

/**
 * Fact rows: label, value and a receipt chip. A row with a receipt is a
 * native <details>: the whole row (and so the chip) opens the receipt below
 * it, without JavaScript. Only recorded values are shown: a fact we have no
 * sourced value for is left out, never guessed. Keys in `technical` only
 * show in the Advanced view.
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
    <ul className="divide-y divide-line">
      {shown.map((key) => {
        const receipt = detail.facts[key];
        const value = receipt ? receipt.value : snapshot[key];
        const row = (
          <>
            <span className="fact-label">{t(`facts.${key}`)}</span>{' '}
            <span className="fact-value">{factValueLabel(key, value ?? null, t)}</span>{' '}
          </>
        );
        return (
          <li key={key} className={`text-sm ${technical.includes(key) ? 'only-advanced' : ''}`}>
            {receipt ? (
              <details className="fact">
                <summary className="fact-row">
                  {row}
                  <ReceiptChip status={receipt.status} t={t} locale={locale} sources={receipt.sources.length} date={receipt.verifiedAt ?? receipt.observedAt} />
                  <Icon name="chevron-down" size={16} className="fact-chevron" />
                </summary>
                <div className="pb-3">
                  <ReceiptPanel receipt={receipt} t={t} locale={locale} />
                </div>
              </details>
            ) : (
              <div className="fact-row">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
