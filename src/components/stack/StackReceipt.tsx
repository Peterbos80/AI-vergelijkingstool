import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDate, formatMoney } from '@/i18n/formatters';
import { nameOf, stepLabel } from '@/lib/catalog/helpers';
import type { Catalog, CatalogTask } from '@/lib/catalog/types';
import type { LimitationCode, Money, ReasonCode, StackResult } from '@/lib/engine/compose';
import { href } from '@/lib/routes';
import { StatusStamp } from '@/components/data/StatusStamp';
import { FreshnessDial } from '@/components/data/FreshnessDial';
import { Icon } from '@/components/ui/Icon';

export function stepName(task: CatalogTask | null, key: string, catalog: Catalog, locale: Locale): string {
  const step = task?.steps.find((s) => s.key === key);
  if (step && Object.keys(step.text).length) return stepLabel(step, locale).label;
  const cap = catalog.capabilitiesById.get(key);
  return cap ? nameOf(cap, locale).name : key;
}

function moneyList(list: Money[], locale: Locale): string {
  return list.map((m) => formatMoney(m.cents, m.currency, locale)).join(' + ');
}

export function reasonText(r: ReasonCode, t: Translator, locale: Locale, catalog: Catalog, task: CatalogTask | null): string {
  switch (r.code) {
    case 'primary':
    case 'secondary': {
      const c = catalog.capabilitiesById.get(r.capabilityId);
      return t(`reasons.${r.code}`, { capability: c ? nameOf(c, locale).name : r.capabilityId });
    }
    case 'covers_steps':
      return t('reasons.covers_steps', { steps: r.steps.map((k) => stepName(task, k, catalog, locale).toLowerCase()).join(', ') });
    case 'platform':
      return t('reasons.platform', { platform: t(`platforms.${r.platform}`) });
    default:
      return t(`reasons.${r.code}`);
  }
}

export function limitationText(l: LimitationCode, t: Translator): string {
  if (l.code === 'relaxed') return t('limits.relaxed', { constraint: t(`match.relaxedNames.${l.constraint}`) });
  if (l.code === 'text') return l.text;
  return t(`limits.${l.code}`);
}

/**
 * The stack receipt (docs/strategy/10 §3 StackReceipt). Pure server
 * component; also rendered for shared stacks and as the OG card source.
 */
export function StackReceipt({
  result,
  task,
  title,
  catalog,
  t,
  locale,
  receiptNo,
  date,
}: {
  result: StackResult;
  task: CatalogTask | null;
  title: string;
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  receiptNo: string;
  date: Date;
}) {
  const core = result.totals.core;
  const all = result.totals.all;
  const hasOptionalCost = moneyList(all.paid, locale) !== moneyList(core.paid, locale);
  const fxDate = result.totals.fxDay ? formatDate(result.totals.fxDay, locale) : null;
  const budgetAmount = result.budget ? formatMoney(result.budget.limitCents, result.budget.currency, locale) : null;
  return (
    <section className="receipt print-in px-5 py-6" aria-label={t('stack.receipt')} data-testid="stack-receipt">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dashed border-line pb-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider">{t('stack.receipt')}</h2>
        <p className="text-xs text-ink-3" data-dynamic="">
          {t('stack.number')} {receiptNo} · {formatDate(date, locale)}
        </p>
      </header>
      <p className="mt-3 font-sans text-base font-semibold">{title}</p>
      <ol className="mt-3 divide-y divide-dashed divide-line">
        {result.steps.map((s, i) => {
          const tool = s.toolId ? catalog.toolsById.get(s.toolId) : undefined;
          const line = result.lines.find((l) => l.toolId === s.toolId);
          const plan = tool && s.planKey ? tool.plans.find((p) => p.key === s.planKey) : undefined;
          const label = stepName(task, s.key, catalog, locale);
          return (
            <li key={s.key} data-testid="receipt-step" data-step={s.key} data-required={s.required ? '1' : '0'} data-tool={s.toolId ?? ''} className="grid grid-cols-[1.5rem_minmax(6rem,1fr)_minmax(7rem,1.4fr)_auto] items-baseline gap-x-3 gap-y-1 py-2.5 max-sm:grid-cols-[1.5rem_1fr_auto]">
              <span className="text-ink-3">{i + 1}</span>
              <span className="text-ink-2">
                {label}
                {!s.required && <span className="ml-1 text-[0.6875rem] text-ink-3">({t('match.optional')})</span>}
              </span>
              {!tool ? (
                <span className="col-span-2 text-ink-3 max-sm:col-span-1 max-sm:col-start-2">
                  {s.skipped === 'no_candidate' ? t('match.noCandidate') : t('match.skippedOptional')}
                </span>
              ) : s.sharedFromStep ? (
                <span className="col-span-2 text-ink-3 max-sm:col-span-1 max-sm:col-start-2">{t('stack.inTool', { tool: tool.name })}</span>
              ) : (
                <>
                  <span className="max-sm:col-start-2">
                    <Link href={href.tool(locale, tool.slug)} className="font-semibold text-ink no-underline hover:underline">
                      {tool.name}
                    </Link>
                    {plan && <span className="ml-1.5 text-ink-3">{plan.name}</span>}
                  </span>
                  <span className="flex items-center justify-end gap-2 text-right num max-sm:col-start-3 max-sm:row-start-1">
                    {line?.paidCents === null || line === undefined ? (
                      <span className="text-ink-3">{t('stack.priceUnknown')}</span>
                    ) : line.paidCents === 0 ? (
                      t('common.free')
                    ) : (
                      `${formatMoney(line.paidCents, line.currency, locale)}${t('period.month')}`
                    )}
                    {tool.pricingStatus && <StatusStamp status={tool.pricingStatus} t={t} compact />}
                    <FreshnessDial freshness={tool.freshness} t={t} size={14} />
                  </span>
                  {line && line.freePlanAvailable && (line.paidCents ?? 0) > 0 && (
                    <span className="col-start-3 text-[0.6875rem] text-verified max-sm:col-start-2">{t('stack.freeAvailable')}</span>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
      <hr className="receipt-rule my-3" />
      <dl className="space-y-1.5 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="font-semibold uppercase">{t('stack.totalCore')}</dt>
          <dd className="num font-semibold">
            {core.paid.length ? `${moneyList(core.paid, locale)}${t('period.month')}` : t('common.free')}
          </dd>
        </div>
        {hasOptionalCost && (
          <div className="flex flex-wrap justify-between gap-2 text-ink-2">
            <dt>{t('stack.totalAll')}</dt>
            <dd className="num">{`${moneyList(all.paid, locale)}${t('period.month')}`}</dd>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2 text-ink-2">
          <dt>{t('stack.startCost')}</dt>
          <dd className="num">{core.start.length ? `${moneyList(core.start, locale)}${t('period.month')}` : t('common.free')}</dd>
        </div>
      </dl>
      <div className="mt-1.5 text-xs text-ink-3">
        {core.paidEurCents !== null && core.paid.some((m) => m.currency !== 'EUR') && fxDate
          ? t('stack.approx', { amount: formatMoney(core.paidEurCents, 'EUR', locale), date: fxDate })
          : core.paid.some((m) => m.currency !== 'EUR')
            ? t('stack.noFx')
            : null}
      </div>
      {result.budget && budgetAmount && (
        <p
          className={`mt-1.5 flex items-start gap-1.5 text-sm ${result.budget.paidWithin === true ? 'text-verified' : result.budget.paidWithin === false ? 'text-danger' : 'text-ink-3'}`}
        >
          {result.budget.paidWithin !== null && <Icon name={result.budget.paidWithin ? 'check' : 'x'} size={16} className="mt-0.5" />}
          <span>
            {result.budget.paidWithin === true
              ? t('stack.withinBudget', { amount: budgetAmount })
              : result.budget.paidWithin === false
                ? t('stack.overBudget', { amount: budgetAmount })
                : t('stack.budgetUnknown', { amount: budgetAmount })}
          </span>
        </p>
      )}
      <p className="mt-3 text-[0.6875rem] text-ink-3">{t('stack.confidence', { value: result.confidence })}</p>
    </section>
  );
}
