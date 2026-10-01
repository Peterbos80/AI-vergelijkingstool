import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { nameOf, toolText, toolWorld } from '@/lib/catalog/helpers';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import { href } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { FxApprox } from './Price';
import { STATUS_GLYPH, receiptChipName } from './ReceiptChip';
import { ToolMark } from './ToolMark';
import { entryPriceLabel } from './format';

/**
 * A tool in a list (no card walls; docs/strategy/10 §3): mark, name with its
 * tagline and main functions, the price column with its receipt ("Onderbouwd
 * · 29 sep", a link to the price sources), then the compare toggle. The
 * whole row opens the tool (the name's link stretches over it); the
 * functions, the receipt and the toggle sit above that link. Below 640px the
 * price and the toggle move under the text, so a row never makes the page
 * wider than the screen.
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
  const world = toolWorld(tool, catalog);
  const primary = tool.capabilities.filter((c) => c.strength === 'primary').slice(0, 3);
  return (
    <li className="tool-row" data-world={world === 'home' ? undefined : world}>
      <ToolMark tool={tool} world={world} size={44} />
      <div className="tool-row-text">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link href={href.tool(locale, tool.slug)} className="tool-row-link">
            {tool.name}
          </Link>
          {tool.status !== 'active' && tool.status !== 'unknown' && <span className="text-xs font-medium text-ink-3">{t(`toolStatus.${tool.status}`)}</span>}
        </p>
        {text?.tagline && <p className="tool-row-tagline">{text.tagline}</p>}
        {primary.length > 0 && (
          <p className="tool-row-caps">
            {primary.map((c) => {
              const cap = catalog.capabilitiesById.get(c.id);
              return cap ? (
                <Link key={c.id} href={href.capability(locale, nameOf(cap, locale).slug)} className="tool-row-cap">
                  {nameOf(cap, locale).name}
                </Link>
              ) : null;
            })}
          </p>
        )}
        {extra}
      </div>
      <div className="tool-row-price">
        <span className="num tool-row-amount">{entryPriceLabel(tool, t, locale)}</span>
        <FxApprox cents={tool.entryPriceCents} currency={tool.entryPriceCurrency} fx={catalog.fx} t={t} locale={locale} />
        {tool.hasFreeTier && tool.entryPriceCents !== null && <span className="free-pill">{t('tool.freePlan')}</span>}
        {tool.pricingStatus && (
          <Link href={href.toolPricing(locale, tool.slug)} className="price-receipt" data-status={tool.pricingStatus} title={t('receipts.open')} prefetch={false}>
            <Icon name={STATUS_GLYPH[tool.pricingStatus]} size={14} />
            {receiptChipName({ status: tool.pricingStatus, t, locale, date: tool.priceCheckedAt })}
          </Link>
        )}
      </div>
      {compareFormId && (
        <div className="tool-row-actions">
          <label className="compare-toggle">
            <input type="checkbox" name="tools" value={tool.slug} form={compareFormId} />
            <Icon name="plus" size={14} className="compare-toggle-off" />
            <Icon name="check" size={14} className="compare-toggle-on" />
            {t('tool.addToCompare')}
          </label>
        </div>
      )}
    </li>
  );
}
