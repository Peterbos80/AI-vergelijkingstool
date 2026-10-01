import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDate } from '@/i18n/formatters';
import type { Receipt } from '@/lib/catalog/detail';
import { StatusStamp } from './StatusStamp';
import { Icon } from '@/components/ui/Icon';

/**
 * The receipts drawer: status, confidence, method, dates, verbatim evidence and
 * sources for one value. Native <details>, so it works without JavaScript.
 */
export function ReceiptDrawer({
  receipt,
  t,
  locale,
  label,
}: {
  receipt: Receipt | undefined;
  t: Translator;
  locale: Locale;
  label?: string;
}) {
  if (!receipt) return null;
  return (
    <details className="group mt-1 text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-ink-3 hover:text-ink">
        <Icon name="chevron-right" size={14} className="transition-transform group-open:rotate-90" />
        {label ?? t('receipts.open')}
      </summary>
      <div className="receipt mt-2 p-4 pt-5 text-xs leading-relaxed">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          <dt className="text-ink-3">{t('receipts.status')}</dt>
          <dd>
            <StatusStamp status={receipt.status} t={t} />
          </dd>
          <dt className="text-ink-3">{t('receipts.confidence')}</dt>
          <dd>{t('receipts.confidenceValue', { value: receipt.confidence })}</dd>
          <dt className="text-ink-3">{t('receipts.method')}</dt>
          <dd>{t(`method.${receipt.method}`)}</dd>
          <dt className="text-ink-3">{t('receipts.observed')}</dt>
          <dd>{formatDate(receipt.observedAt, locale)}</dd>
          <dt className="text-ink-3">{t('receipts.verified')}</dt>
          <dd>{receipt.verifiedAt ? formatDate(receipt.verifiedAt, locale) : t('receipts.notVerified')}</dd>
        </dl>
        {receipt.evidence && (
          <>
            <p className="mt-3 text-ink-3">{t('receipts.evidence')}</p>
            <blockquote className="mt-1 border-l-2 border-line pl-3 text-ink-2">{receipt.evidence}</blockquote>
          </>
        )}
        {receipt.note && <p className="mt-2 text-ink-3">{receipt.note}</p>}
        <p className="mt-3 text-ink-3">{t('receipts.sources')}</p>
        {receipt.sources.length === 0 ? (
          <p>{t('receipts.noSources')}</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {receipt.sources.map((s) => (
              <li key={s.id} className="break-words">
                <span className="text-ink-3">[{t(`sourceType.${s.type}`)}]</span>{' '}
                <a href={s.url} rel="nofollow noopener noreferrer" target="_blank" className="underline">
                  {s.title ?? s.publisher ?? s.domain}
                </a>{' '}
                <span className="text-ink-3">({s.domain})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
