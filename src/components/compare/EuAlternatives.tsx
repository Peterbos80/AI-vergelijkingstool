/**
 * Tool page section "Europees alternatief": for a tool whose company is
 * outside Europe, tools of European companies with the same primary
 * capabilities (lib/compare/eu). Shows the overlap, the entry price and the
 * country, and says that a European company says nothing about data location.
 */
import Link from 'next/link';
import { LOCALE_META, type Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatMoney, formatPercent } from '@/i18n/formatters';
import { nameOf } from '@/lib/catalog/helpers';
import type { Catalog, CatalogTool } from '@/lib/catalog/types';
import { euAlternatives } from '@/lib/compare/eu';
import { href } from '@/lib/routes';
import { LabelChip } from './LabelChip';

function region(code: string | null, locale: Locale): string {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([LOCALE_META[locale].intl], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function EuAlternatives({ tool, catalog, t, locale }: { tool: CatalogTool; catalog: Catalog; t: Translator; locale: Locale }) {
  const alts = euAlternatives(catalog, tool);
  if (!alts || !alts.length) return null;
  return (
    <section aria-labelledby="eu-alt" data-testid="eu-alternatives">
      <h2 id="eu-alt" className="text-xl">
        {t('euAlt.title')}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-2">{t('euAlt.intro', { name: tool.name, country: region(tool.companyCountry, locale) })}</p>
      <ul className="card mt-3 divide-y divide-line px-4">
        {alts.map((a) => {
          const caps = a.shared.map((c) => {
            const cap = catalog.capabilitiesById.get(c);
            return cap ? nameOf(cap, locale).name : c;
          });
          const entry =
            a.tool.entryPriceCents !== null && a.tool.entryPriceCurrency
              ? t('euAlt.entry', {
                  price: formatMoney(a.tool.entryPriceCents, a.tool.entryPriceCurrency, locale),
                  eur: a.entryEurCents !== null && a.tool.entryPriceCurrency !== 'EUR' ? ` (≈ ${formatMoney(a.entryEurCents, 'EUR', locale)})` : '',
                })
              : null;
          return (
            <li key={a.tool.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-3" data-tool={a.tool.slug}>
              <div className="min-w-0">
                <p className="font-semibold">
                  <Link href={href.tool(locale, a.tool.slug)}>{a.tool.name}</Link>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                  <LabelChip label="european" text={t('costs.labelEuropean')} href={`${href.costs(locale)}#label-european`} />
                  <span>{region(a.tool.companyCountry, locale)}</span>
                </p>
                <p className="mt-1 text-sm text-ink-2">{t('euAlt.shared', { caps: caps.join(', ') })}</p>
              </div>
              <div className="text-right text-sm">
                <p className="tabular font-semibold">{t('euAlt.overlap', { percent: formatPercent(a.overlap, locale) })}</p>
                <p className="text-ink-2">
                  {[entry, a.tool.hasFreeTier ? t('euAlt.freePlan') : null].filter(Boolean).join(' · ') || t('euAlt.priceOnSite')}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-3">
        {t('euAlt.dataNote')} {t('euAlt.order')}
      </p>
    </section>
  );
}
