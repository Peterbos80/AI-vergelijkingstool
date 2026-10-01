import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { nameOf, toolText, toolWorld } from '@/lib/catalog/helpers';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import { href } from '@/lib/routes';
import { FreshnessDial } from './FreshnessDial';
import { FxApprox } from './Price';
import { ReceiptChip } from './ReceiptChip';
import { ToolMark } from './ToolMark';
import { entryPriceLabel } from './format';

/**
 * Compact tool row (no card walls; docs/strategy/10 §3). A grid: monogram,
 * text and the price column; below 640px the price column moves under the
 * text, so a row never makes the page wider than the screen.
 */
export function ToolRow({
  tool,
  catalog,
  t,
  locale,
  compareFormId,
  extra,
}: {
  tool: CatalogTool;
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  compareFormId?: string;
  extra?: React.ReactNode;
}) {
  const text = toolText(tool, locale);
  const primary = tool.capabilities.filter((c) => c.strength === 'primary').slice(0, 3);
  return (
    <li className="tool-row">
      <ToolMark tool={tool} world={toolWorld(tool, catalog)} size={40} />
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link href={href.tool(locale, tool.slug)} className="font-semibold no-underline hover:underline">
            {tool.name}
          </Link>
          {tool.status !== 'active' && tool.status !== 'unknown' && <span className="text-xs font-medium text-ink-3">{t(`toolStatus.${tool.status}`)}</span>}
          <span className="text-sm text-ink-2">{text?.tagline}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          {primary.map((c) => {
            const cap = catalog.capabilitiesById.get(c.id);
            return cap ? (
              <Link key={c.id} href={href.capability(locale, nameOf(cap, locale).slug)} className="no-underline hover:underline">
                {nameOf(cap, locale).name}
              </Link>
            ) : null;
          })}
        </div>
        {extra}
      </div>
      <div className="tool-row-meta">
        <span className="num text-sm font-medium">{entryPriceLabel(tool, t, locale)}</span>
        <FxApprox cents={tool.entryPriceCents} currency={tool.entryPriceCurrency} fx={catalog.fx} t={t} locale={locale} />
        {tool.hasFreeTier && tool.entryPriceCents !== null && <span className="text-xs text-verified">{t('tool.freePlan')}</span>}
        <span className="flex items-center gap-1.5">
          {tool.pricingStatus && (
            <ReceiptChip status={tool.pricingStatus} t={t} locale={locale} date={tool.priceCheckedAt} href={href.toolPricing(locale, tool.slug)} />
          )}
          <FreshnessDial freshness={tool.freshness} t={t} />
        </span>
        {compareFormId && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" name="tools" value={tool.slug} form={compareFormId} className="h-4 w-4 accent-[var(--ink)]" />
            {t('tool.addToCompare')}
          </label>
        )}
      </div>
    </li>
  );
}
