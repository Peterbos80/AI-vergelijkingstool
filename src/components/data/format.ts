import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatMoney } from '@/i18n/formatters';
import { toEurCents } from '@/lib/pricing/money';
import type { CatalogPlan, CatalogTool } from '@/lib/catalog/types';

export function planPriceLabel(plan: Pick<CatalogPlan, 'isCustom' | 'isFree' | 'priceCents' | 'currency' | 'period' | 'unit'>, t: Translator, locale: Locale): string {
  if (plan.isCustom || plan.priceCents === null) return t('common.custom');
  if (plan.isFree || plan.priceCents === 0) return t('common.free');
  const money = formatMoney(plan.priceCents, plan.currency, locale);
  const period = t(`period.${plan.period}`);
  const unit = plan.unit !== 'flat' ? ` ${t(`unit.${plan.unit}`)}` : '';
  return `${money}${period.startsWith('/') ? period : period ? ` ${period}` : ''}${unit}`;
}

export function entryPriceLabel(tool: CatalogTool, t: Translator, locale: Locale): string {
  if (tool.entryPriceCents !== null && tool.entryPriceCurrency) {
    return `${formatMoney(tool.entryPriceCents, tool.entryPriceCurrency, locale)}${t('period.month')}`;
  }
  if (tool.hasFreeTier) return t('common.free');
  if (tool.plans.some((p) => p.isCustom)) return t('common.custom');
  return '—';
}

export function approxEur(cents: number | null, currency: string | null, rates: ReadonlyMap<string, number>, locale: Locale): string | null {
  if (cents === null || !currency || currency === 'EUR') return null;
  const eur = toEurCents(cents, currency, rates);
  return eur === null ? null : formatMoney(eur, 'EUR', locale);
}

export function factValueLabel(key: string, value: unknown, t: Translator): string {
  if (value === null || value === undefined) return t('common.unknown');
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
  if (key === 'platforms' && Array.isArray(value)) return value.map((p) => (t.has(`platforms.${p}`) ? t(`platforms.${p}`) : String(p))).join(', ');
  if (key === 'trains_on_user_data' && typeof value === 'string') return t(`facts.values.${value}`);
  if (key === 'status' && typeof value === 'string') return t(`toolStatus.${value}`);
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

export function boolLabel(v: boolean | null, t: Translator): string {
  return v === null ? t('common.unknown') : v ? t('common.yes') : t('common.no');
}
