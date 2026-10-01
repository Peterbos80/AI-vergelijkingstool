import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatMoney } from '@/i18n/formatters';
import { nameOf, toolWorld } from '@/lib/catalog/helpers';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import { buildMatrix, verdicts, type Cell, type CriterionKey, type Row, type VerdictReason } from '@/lib/engine/compare';
import { href } from '@/lib/routes';
import { ReceiptChip } from './ReceiptChip';
import { ToolMark } from './ToolMark';
import { VisitLink } from './VisitLink';
import { FxApprox } from './Price';
import { Icon } from '@/components/ui/Icon';

function cellText(row: Row, cell: Cell, t: Translator, locale: Locale, catalog: Catalog): string {
  const v = cell.value;
  if (v === null || v === undefined) return '–';
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

/** Fact behind a criterion, for the receipt chip's date and link (prices live on the pricing page). */
const FACT_OF: Partial<Record<CriterionKey, string>> = {
  free_plan: 'has_free_tier',
  free_trial: 'has_free_trial',
  platforms: 'platforms',
  api: 'api_available',
  open_source: 'open_source',
  self_hostable: 'self_hostable',
  eu_data_residency: 'eu_data_residency',
  gdpr_dpa: 'gdpr_dpa',
  supports_dutch: 'supports_dutch',
  trains_on_user_data: 'trains_on_user_data',
  watermark_free_tier: 'watermark_free_tier',
  commercial_use_free_tier: 'commercial_use_free_tier',
};
const EU_CRITERIA = new Set<CriterionKey>(['eu_data_residency', 'gdpr_dpa', 'supports_dutch', 'trains_on_user_data']);

function evidence(row: Row, tool: CatalogTool, locale: Locale): { date: Date | null; href: string } {
  if (row.key === 'entry_price' || row.key === 'pricing_model') return { date: tool.priceCheckedAt, href: href.toolPricing(locale, tool.slug) };
  const key = FACT_OF[row.key];
  const fact = key ? tool.facts[key] : undefined;
  return { date: fact ? (fact.verifiedAt ?? fact.observedAt) : null, href: `${href.tool(locale, tool.slug)}#${EU_CRITERIA.has(row.key) ? 'eu-lens' : 'facts'}` };
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
  // A criterion no tool has sourced data for is left out; single gaps show a dash.
  const rows = buildMatrix(tools).filter((r) => r.cells.some((c) => c.value !== null && c.value !== undefined));
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
                    <ToolMark tool={tool} world={toolWorld(tool, catalog)} size={24} />
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
                {row.cells.map((cell) => {
                  const tool = tools.find((x) => x.id === cell.toolId)!;
                  return (
                    <td key={cell.toolId} className={cell.best ? 'font-semibold text-ink' : ''}>
                      {cell.value === null || cell.value === undefined ? (
                        <span className="text-ink-3" aria-label={t('compare.noData')} title={t('compare.noData')}>
                          –
                        </span>
                      ) : (
                        <span className={row.key === 'entry_price' ? 'num' : undefined}>{cellText(row, cell, t, locale, catalog)}</span>
                      )}
                      {cell.best && (
                        <span className="ml-1 inline-flex align-middle text-verified" title={t('compare.best')}>
                          <Icon name="check" size={16} />
                          <span className="visually-hidden"> ({t('compare.best')})</span>
                        </span>
                      )}
                      {cell.status && cell.value !== null && (
                        <span className="ml-1.5">
                          <ReceiptChip status={cell.status} t={t} locale={locale} {...evidence(row, tool, locale)} />
                        </span>
                      )}
                      {row.key === 'entry_price' && cell.value !== null && (
                        <FxApprox
                          cents={(cell.value as { cents: number }).cents}
                          currency={(cell.value as { currency: string }).currency}
                          fx={catalog.fx}
                          t={t}
                          locale={locale}
                          className="block"
                        />
                      )}
                    </td>
                  );
                })}
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
