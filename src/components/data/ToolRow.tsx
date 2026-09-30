import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { nameOf, toolText } from '@/lib/catalog/helpers';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import { href } from '@/lib/routes';
import { FreshnessDial } from './FreshnessDial';
import { StatusStamp } from './StatusStamp';
import { ToolMonogram } from './ToolMonogram';
import { entryPriceLabel } from './format';

/** Compact tool row (no card walls; docs/strategy/10 §3). */
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
    <li className="flex items-start gap-3 border-b border-line py-4 last:border-b-0">
      <ToolMonogram name={tool.name} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link href={href.tool(locale, tool.slug)} className="font-semibold no-underline hover:underline">
            {tool.name}
          </Link>
          {tool.status !== 'active' && tool.status !== 'unknown' && <span className="mono text-xs text-ink-3">{t(`toolStatus.${tool.status}`)}</span>}
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
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <span className="mono tabular text-sm font-medium">{entryPriceLabel(tool, t, locale)}</span>
        {tool.hasFreeTier && tool.entryPriceCents !== null && (
          <span className="text-xs text-verified">{t('tool.freePlan')}</span>
        )}
        <span className="flex items-center gap-1.5">
          {tool.pricingStatus && <StatusStamp status={tool.pricingStatus} t={t} compact />}
          <FreshnessDial freshness={tool.freshness} t={t} />
        </span>
        {compareFormId && (
          <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" name="tools" value={tool.slug} form={compareFormId} className="h-4 w-4 accent-[var(--ink)]" />
            {t('tool.addToCompare')}
          </label>
        )}
      </div>
    </li>
  );
}
