/**
 * Task page section "Wat krijg je echt gratis?": per tool of the task the
 * free plan with its limit text, and the facts we hold with a source
 * (watermark, commercial use; a credit card once recorded). Unknown shows a
 * dash with the word "unknown", never "no" (docs/strategy/agents/B2 §4).
 */
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import type { Catalog, CatalogTask } from '@/lib/catalog/types';
import { freeCheck, type FreeCheckRow } from '@/lib/compare/free';
import { href } from '@/lib/routes';
import { LabelChip } from './LabelChip';

function Unknown({ t }: { t: Translator }) {
  return (
    <span className="text-ink-3" data-unknown="1">
      <span aria-hidden="true">– </span>
      <span className="text-xs">{t('freeCheck.unknown')}</span>
    </span>
  );
}

function Fact({ value, applies, t }: { value: boolean | null; applies: boolean; t: Translator }) {
  if (!applies) return <span className="text-ink-3">{t('freeCheck.notApplicable')}</span>;
  if (value === null) return <Unknown t={t} />;
  return <span>{value ? t('freeCheck.yes') : t('freeCheck.no')}</span>;
}

function FreePlan({ row, t }: { row: FreeCheckRow; t: Translator }) {
  if (row.free === 'no') return <span>{t('freeCheck.noFreePlan')}</span>;
  if (row.free === 'unknown') return <Unknown t={t} />;
  return (
    <span>
      <span className="font-semibold">{row.plan?.name ?? t('freeCheck.freePlan')}</span>
      {row.limit ? (
        <>
          <span className="mono block text-xs text-ink-2">“{row.limit}”</span>
          {row.limitPer && <span className="block text-xs text-ink-3">{t(`freeCheck.per.${row.limitPer}`)}</span>}
        </>
      ) : (
        <span className="block text-xs">
          {t('freeCheck.limit')}: <Unknown t={t} />
        </span>
      )}
    </span>
  );
}

function ToolHead({ row, t, locale }: { row: FreeCheckRow; t: Translator; locale: Locale }) {
  return (
    <>
      <Link href={href.tool(locale, row.tool.slug)} className="font-semibold">
        {row.tool.name}
      </Link>
      {(row.trulyFree || row.european) && (
        <span className="mt-1 flex flex-wrap gap-1.5">
          {row.trulyFree && <LabelChip label="truly_free" text={t('freeCheck.labelTrulyFree')} href={`${href.tool(locale, row.tool.slug)}#facts`} />}
          {row.european && <LabelChip label="european" text={t('costs.labelEuropean')} href={`${href.costs(locale)}#label-european`} />}
        </span>
      )}
    </>
  );
}

export function FreeCheck({ task, catalog, t, locale }: { task: CatalogTask; catalog: Catalog; t: Translator; locale: Locale }) {
  const rows = freeCheck(catalog, task);
  if (!rows.length) return null;
  const showCard = rows.some((r) => r.creditCard !== null);
  const anyTrulyFree = rows.some((r) => r.trulyFree);
  const facts = (row: FreeCheckRow) => [
    { key: 'watermark', label: t('freeCheck.colWatermark'), value: row.watermark },
    { key: 'commercial', label: t('freeCheck.colCommercial'), value: row.commercialUse },
    ...(showCard ? [{ key: 'card', label: t('freeCheck.colCard'), value: row.creditCard }] : []),
  ];
  return (
    // "onbekend" is intended here (the e2e check for stray "unknown" values skips [data-unknown-ok]).
    <section className="mt-12" aria-labelledby="free-check" data-unknown-ok="1">
      <h2 id="free-check" className="text-xl">
        {t('freeCheck.title')}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">{t('freeCheck.intro')}</p>
      {/* Phones: one card per tool. */}
      <ul className="mt-4 space-y-2 sm:hidden" aria-label={t('freeCheck.caption')}>
        {rows.map((row) => (
          <li key={row.tool.id} className="card p-3" data-tool={row.tool.slug}>
            <p>
              <ToolHead row={row} t={t} locale={locale} />
            </p>
            <p className="mt-2 text-sm">
              <FreePlan row={row} t={t} />
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {facts(row).map((f) => (
                <div key={f.key}>
                  <dt className="text-xs text-ink-3">{f.label}</dt>
                  <dd>
                    <Fact value={f.value} applies={row.free !== 'no'} t={t} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="table-scroll mt-4 hidden sm:block">
        <table className="table-data">
          <caption className="visually-hidden">{t('freeCheck.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('freeCheck.colTool')}</th>
              <th scope="col">{t('freeCheck.colPlan')}</th>
              <th scope="col">{t('freeCheck.colWatermark')}</th>
              <th scope="col">{t('freeCheck.colCommercial')}</th>
              {showCard && <th scope="col">{t('freeCheck.colCard')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tool.id} data-tool={row.tool.slug}>
                <th scope="row" className="min-w-40 whitespace-normal bg-transparent align-top text-left font-sans text-sm font-normal normal-case tracking-normal text-ink">
                  <ToolHead row={row} t={t} locale={locale} />
                </th>
                <td className="min-w-48">
                  <FreePlan row={row} t={t} />
                </td>
                {facts(row).map((f) => (
                  <td key={f.key}>
                    <Fact value={f.value} applies={row.free !== 'no'} t={t} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-ink-3">
        <li>{t('freeCheck.legend')}</li>
        {!showCard && <li>{t('freeCheck.cardNotRecorded')}</li>}
        <li>
          {anyTrulyFree ? t('freeCheck.trulyFreeExplained') : t('freeCheck.trulyFreeNone')}{' '}
          <Link href={`${href.costs(locale)}#label-truly-free`}>{t('freeCheck.labelsLink')}</Link>
        </li>
      </ul>
    </section>
  );
}
