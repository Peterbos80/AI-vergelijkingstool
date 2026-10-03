import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { toolText } from '@/lib/catalog';
import { toolWorld } from '@/lib/catalog/helpers';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import { href } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { entryPriceLabel } from './format';
import { STATUS_GLYPH, receiptChipName } from './ReceiptChip';
import { ToolMark } from './ToolMark';

/**
 * A tool as a card for short lists such as alternatives: mark, name (its
 * link covers the card), tagline, the entry price and that price's receipt
 * line ("Onderbouwd · 29 sep", a link to the price receipts, like in
 * ToolRow). Long lists use ToolRow.
 */
export function ToolCard({ tool, catalog, t, locale }: { tool: CatalogTool; catalog: Catalog; t: Translator; locale: Locale }) {
  const text = toolText(tool, locale);
  return (
    <div className="tool-card">
      <ToolMark tool={tool} world={toolWorld(tool, catalog)} size={48} />
      <h3>
        <Link href={href.tool(locale, tool.slug)} className="tool-card-link">
          {tool.name}
        </Link>
      </h3>
      {text?.tagline && <p className="tool-card-tagline">{text.tagline}</p>}
      <p className="tool-card-price">
        <strong>{entryPriceLabel(tool, t, locale)}</strong>
        {tool.hasFreeTier && tool.entryPriceCents !== null && ` · ${t('tool.freePlan')}`}
      </p>
      {tool.pricingStatus && (
        <Link href={href.toolPricing(locale, tool.slug)} className="price-receipt" data-status={tool.pricingStatus} title={t('receipts.open')} prefetch={false}>
          <Icon name={STATUS_GLYPH[tool.pricingStatus]} size={14} />
          {receiptChipName({ status: tool.pricingStatus, t, locale, date: tool.priceCheckedAt })}
        </Link>
      )}
    </div>
  );
}
