import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatMoney } from '@/i18n/formatters';
import { nameOf } from '@/lib/catalog';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import { buildMatrix, verdicts, type Cell, type Row, type VerdictReason } from '@/lib/engine/compare';
import { href } from '@/lib/routes';
import { StatusStamp } from './StatusStamp';
import { ToolMonogram } from './ToolMonogram';
import { VisitLink } from './VisitLink';

function cellText(row: Row, cell: Cell, t: Translator, locale: Locale, catalog: Catalog): string {
  const v = cell.value;
  if (v === null || v === undefined) return t('compare.unknown');
  switch (row.key) {
    case 'entry_price': {
      const p = v as { cents: number; currency: string };
      return `${formatMoney(p.cents, p.currency, locale)}${t('period.month')}`;
    }
    case 'pricing_model':
      return t(`pricingModel.${v as string}`);
    case 'platforms':
      return (v as string[]).map((p) => t(`platforms.${p}`)).join(', ');
    case 'trains_on_user_data':
      return t(`facts.values.${v as string}`);
    case 'skill_level':
      return t(`skill.${v as string}`);
    case 'capabilities':
      return (v as string[])
        .map((id) => {
          const c = catalog.capabilitiesById.get(id);
          return c ? nameOf(c, locale).name : id;
        })
        .join(', ');
    default:
      return typeof v === 'boolean' ? (v ? t('common.yes') : t('common.no')) : String(v);
  }
}

function reasonText(r: VerdictReason, t: Translator, locale: Locale, catalog: Catalog): string {
  if (r.kind === 'capability') {
    const c = catalog.capabilitiesById.get(r.capabilityId);
    return t('compare.reasons.capability', { capability: c ? nameOf(c, locale).name.toLowerCase() : r.capabilityId });
  }
  if (r.kind === 'platform') return t('compare.reasons.platform', { platform: t(`platforms.${r.platform}`) });
  return t(`compare.reasons.${r.kind}`);
}

export function CompareView({
  tools,
  catalog,
  t,
  locale,
  affiliates,
  src,
}: {
  tools: CatalogTool[];
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  affiliates: Set<string>;
  src: string;
}) {
  const rows = buildMatrix(tools);
  const v = verdicts(tools, rows);
  return (
    <>
      <div className="table-scroll mt-6">
        <table className="table-data">
          <caption className="visually-hidden">{t('compare.title')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('compare.criterion')}</th>
              {tools.map((tool) => (
                <th key={tool.id} scope="col" className="min-w-[11rem]">
                  <Link href={href.tool(locale, tool.slug)} className="flex items-center gap-2 normal-case tracking-normal text-ink no-underline">
                    <ToolMonogram name={tool.name} size={24} />
                    <span className="font-sans text-sm font-semibold">{tool.name}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.differs ? '' : 'text-ink-3'}>
                <th scope="row" className="whitespace-nowrap font-medium">
                  {t(`compare.criteria.${row.key}`)}
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.toolId} className={cell.best ? 'font-semibold text-ink' : ''}>
                    <span>{cellText(row, cell, t, locale, catalog)}</span>
                    {cell.best && (
                      <span className="ml-1 text-verified" title={t('compare.best')}>
                        ✓<span className="visually-hidden"> ({t('compare.best')})</span>
                      </span>
                    )}
                    {cell.status && cell.value !== null && (
                      <span className="ml-1.5 align-middle">
                        <StatusStamp status={cell.status} t={t} compact />
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" />
              {tools.map((tool, i) => (
                <td key={tool.id}>
                  <VisitLink slug={tool.slug} name={tool.name} t={t} locale={locale} src={src} pos={i} affiliate={affiliates.has(tool.id)} variant="small" />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <section className="mt-10" aria-labelledby="verdicts">
        <h2 id="verdicts" className="text-xl">
          {t('compare.verdictsTitle')}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {v.map((verdict) => {
            const tool = tools.find((x) => x.id === verdict.toolId)!;
            return (
              <div key={verdict.toolId} className="card p-4">
                <h3 className="font-semibold">{t('compare.chooseIf', { name: tool.name })}</h3>
                {verdict.reasons.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-2">{t('compare.noVerdict', { name: tool.name })}</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {verdict.reasons.map((r, i) => (
                      <li key={i}>→ {reasonText(r, t, locale, catalog)}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
