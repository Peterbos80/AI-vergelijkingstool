'use client';
/**
 * "Wat kost het voor mij?": a slider (and a number field) for the usage per
 * month, and per tool the cheapest plan that covers it. The data comes
 * precomputed from the server (lib/compare/usage → buildMeter); the browser
 * only re-runs the pure computeMeter(). The order is the computed price only.
 */
import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LOCALE_META, type Locale } from '@/i18n/config';
import { createTranslator, type MessageTree, type Translator } from '@/i18n/format';
import { formatDate, formatMoney } from '@/i18n/formatters';
import { href } from '@/lib/routes';
import { computeMeter, type MeterData, type MeterPlan, type MeterTool, type PlanCost, type SkippedPlan } from '@/lib/compare/usage';
import { LabelChip } from './LabelChip';

export function useCostsT(locale: Locale, messages: MessageTree): Translator {
  return useMemo(() => createTranslator(locale, LOCALE_META[locale].intl, messages), [locale, messages]);
}

const noSubscribe = () => () => undefined;
/** true once React has hydrated (a hook for tests; the server render is the same list). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

export function Stamp({ status, t }: { status: string; t: Translator }) {
  return (
    <span className={`stamp stamp-${status}`} title={t(`status.${status}.tooltip`)}>
      {t(`status.${status}.short`)}
    </span>
  );
}

/** "€ 29", with the vendor's amount and the ECB day when it was converted. */
export function Money({
  cents,
  eurCents,
  currency,
  fxDay,
  locale,
  t,
  strong = false,
}: {
  cents: number;
  eurCents: number | null;
  currency: string;
  fxDay: string | null;
  locale: Locale;
  t: Translator;
  strong?: boolean;
}) {
  const main = eurCents !== null ? formatMoney(eurCents, 'EUR', locale) : formatMoney(cents, currency, locale);
  const converted = eurCents !== null && currency !== 'EUR' && cents !== 0;
  return (
    <span className="tabular">
      <span className={strong ? 'text-lg font-semibold text-ink' : 'text-ink'}>
        {converted ? '≈ ' : ''}
        {main}
      </span>
      {converted && (
        <span className="block text-xs text-ink-3">{t('costs.original', { amount: formatMoney(cents, currency, locale), date: formatDate(fxDay, locale) })}</span>
      )}
    </span>
  );
}

function capacity(minutes: number, unit: 'hour' | 'minute', t: Translator): string {
  return unit === 'hour' ? t('costs.hours', { n: Math.round((minutes / 60) * 10) / 10 }) : t('costs.minutes', { n: Math.round(minutes) });
}

function planFacts(plan: MeterPlan, unit: 'hour' | 'minute', t: Translator, locale: Locale): string[] {
  const out: string[] = [];
  if (plan.kind === 'allowance' && plan.minutes !== null) out.push(`${plan.approximate ? '≈ ' : ''}${t('costs.covers', { capacity: capacity(plan.minutes, unit, t) })}`);
  if (plan.kind === 'unlimited') out.push(t('costs.unlimited'));
  if (plan.kind === 'usage' && plan.usageMinutes) {
    const price = formatMoney(plan.priceCents, plan.currency, locale);
    out.push(plan.usageMinutes === 60 ? t('costs.usageHour', { price }) : t('costs.usageMinutes', { price, n: plan.usageMinutes }));
  }
  if (plan.approximate) out.push(t('costs.approx'));
  if (plan.perUser) out.push(t('costs.perUser'));
  if (plan.billing === 'annual') out.push(t('costs.annualPlan'));
  else if (plan.annualMonthlyCents !== null && plan.annualMonthlyCents < plan.priceCents)
    out.push(t('costs.annualPrice', { price: formatMoney(plan.annualMonthlyCents, plan.currency, locale) }));
  return out;
}

function SkippedLine({ skipped, t }: { skipped: SkippedPlan[]; t: Translator }) {
  if (!skipped.length) return null;
  return (
    <p className="mt-1 text-xs text-ink-3">
      {t('costs.skippedPlans', { list: skipped.map((s) => `${s.name}: ${t(`costs.reasons.${s.reason}`)}`).join('; ') })}
    </p>
  );
}

function Receipt({ plan, slug, locale, t }: { plan: MeterPlan; slug: string; locale: Locale; t: Translator }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
      {plan.quota && <span className="mono">“{plan.quota}”</span>}
      <Stamp status={plan.status} t={t} />
      <span>{t('costs.observed', { date: formatDate(plan.observedAt, locale) })}</span>
      <a href={href.toolPricing(locale, slug)}>{t('costs.receipt')}</a>
    </p>
  );
}

function Row({
  tool,
  cost,
  data,
  usageValue,
  cheapest,
  locale,
  t,
}: {
  tool: MeterTool;
  cost: PlanCost;
  data: MeterData;
  usageValue: number;
  cheapest: boolean;
  locale: Locale;
  t: Translator;
}) {
  const perUnit = cost.eurCents ?? cost.cents;
  const perUnitCurrency = cost.eurCents !== null ? 'EUR' : cost.plan.currency;
  const unitPrice = formatMoney(Math.round(perUnit / usageValue), perUnitCurrency, locale);
  return (
    <li className="card p-3" data-tool={tool.slug} data-cents={cost.eurCents ?? cost.cents}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="font-semibold">
            <a href={href.tool(locale, tool.slug)}>{tool.name}</a>
            <span className="font-normal text-ink-2"> · {cost.plan.name}</span>
          </p>
          {(cheapest || tool.european) && (
            <p className="mt-1 flex flex-wrap gap-1.5">
              {cheapest && <LabelChip label="cheapest" text={t('costs.labelCheapest')} href={`${href.costs(locale)}#label-cheapest`} />}
              {tool.european && <LabelChip label="european" text={t('costs.labelEuropean')} href={`${href.costs(locale)}#label-european`} />}
            </p>
          )}
        </div>
        <p className="text-right">
          <Money cents={cost.cents} eurCents={cost.eurCents} currency={cost.plan.currency} fxDay={data.fx.day} locale={locale} t={t} strong />
          <span className="block text-xs text-ink-2">
            {t('costs.perMonth')} · {t(data.unit === 'hour' ? 'costs.perHour' : 'costs.perMinute', { price: unitPrice })}
          </span>
        </p>
      </div>
      <p className="mt-1 text-sm text-ink-2">{planFacts(cost.plan, data.unit, t, locale).join(' · ')}</p>
      <Receipt plan={cost.plan} slug={tool.slug} locale={locale} t={t} />
      <SkippedLine skipped={tool.skipped} t={t} />
    </li>
  );
}

export function CostCalculator({
  meter,
  locale,
  messages,
  question,
  footer,
}: {
  meter: MeterData;
  locale: Locale;
  messages: MessageTree;
  /** Label of the slider ("How many hours of audio per month?"). */
  question: string;
  footer?: ReactNode;
}) {
  const t = useCostsT(locale, messages);
  const id = useId();
  const hydrated = useHydrated();
  const [value, setValue] = useState(meter.initial);
  const [raw, setRaw] = useState(String(meter.initial));
  const minutes = meter.unit === 'hour' ? value * 60 : value;
  const result = useMemo(() => computeMeter(meter, minutes), [meter, minutes]);
  const usage = meter.unit === 'hour' ? t('costs.hours', { n: value }) : t('costs.minutes', { n: value });
  const clamp = (n: number) => Math.min(meter.max, Math.max(meter.min, meter.unit === 'hour' ? Math.round(n * 10) / 10 : Math.round(n)));
  const set = (n: number) => {
    const v = clamp(n);
    setValue(v);
    setRaw(String(v));
  };
  const first = result.ranked[0];
  const summary = first
    ? t('costs.summary', {
        usage,
        tool: first.tool.name,
        plan: first.best!.plan.name,
        price: formatMoney(first.best!.eurCents!, 'EUR', locale),
      })
    : result.unconverted.length
      ? t('costs.summaryUnconverted', { usage, count: result.unconverted.length })
      : t('costs.summaryNone', { usage });
  const showCheapest = result.ranked.length >= 2;

  return (
    <div className="space-y-4" data-meter={meter.id} data-hydrated={hydrated ? '1' : undefined}>
      <div className="card p-4">
        <label htmlFor={`${id}-range`} className="label">
          {question}
        </label>
        <div className="flex items-center gap-3">
          <input
            id={`${id}-range`}
            type="range"
            min={meter.min}
            max={meter.max}
            step={meter.step}
            value={value}
            onChange={(e) => set(Number(e.target.value))}
            aria-valuetext={usage}
            className="min-w-0 flex-1 cursor-pointer accent-accent"
            data-testid="usage-slider"
          />
          <input
            id={`${id}-number`}
            type="number"
            inputMode="decimal"
            min={meter.min}
            max={meter.max}
            step={meter.unit === 'hour' ? 'any' : meter.step}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== '' && Number.isFinite(n) && n >= meter.min && n <= meter.max) setValue(clamp(n));
            }}
            onBlur={() => set(Number(raw) || meter.min)}
            aria-label={t(meter.unit === 'hour' ? 'costs.inputHours' : 'costs.inputMinutes')}
            className="input w-24 tabular"
          />
          <span className="text-sm text-ink-2" aria-hidden="true">
            {t(meter.unit === 'hour' ? 'costs.unitHours' : 'costs.unitMinutes')}
          </span>
        </div>
        <p aria-live="polite" aria-atomic="true" className="mt-3 text-sm font-semibold" data-testid="cost-summary">
          {summary}
        </p>
      </div>

      {result.ranked.length > 0 && (
        <ol className="space-y-2" data-testid="cost-ranking" aria-label={t('costs.rankedLabel', { usage })}>
          {result.ranked.map((r) => (
            <Row
              key={r.tool.slug}
              tool={r.tool}
              cost={r.best!}
              data={meter}
              usageValue={value}
              cheapest={showCheapest && r.best!.eurCents === result.cheapestEurCents}
              locale={locale}
              t={t}
            />
          ))}
        </ol>
      )}

      {result.unconverted.length > 0 && (
        <div>
          <h3 className="text-base font-semibold">{t('costs.unconvertedTitle')}</h3>
          <p className="mt-1 text-sm text-ink-2">{t('costs.unconvertedNote')}</p>
          <ol className="mt-2 space-y-2" data-testid="cost-unconverted">
            {result.unconverted.map((r) => (
              <Row key={r.tool.slug} tool={r.tool} cost={r.best!} data={meter} usageValue={value} cheapest={false} locale={locale} t={t} />
            ))}
          </ol>
        </div>
      )}

      {result.notCovered.length > 0 && (
        <div>
          <h3 className="text-base font-semibold">{t('costs.notCoveredTitle')}</h3>
          <ul className="mt-2 space-y-1.5 text-sm" data-testid="cost-not-covered">
            {result.notCovered.map((r) => (
              <li key={r.tool.slug}>
                <a href={href.tool(locale, r.tool.slug)} className="font-semibold">
                  {r.tool.name}
                </a>
                {r.maxMinutes !== null && <span className="text-ink-2"> · {t('costs.notCoveredMax', { capacity: capacity(r.maxMinutes, meter.unit, t) })}</span>}
                <SkippedLine skipped={r.tool.skipped} t={t} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.notComputable.length > 0 && (
        <div>
          <h3 className="text-base font-semibold">{t('costs.notComputableTitle')}</h3>
          <ul className="mt-2 space-y-1.5 text-sm" data-testid="cost-not-computable">
            {result.notComputable.map((tool) => (
              <li key={tool.slug}>
                <a href={href.tool(locale, tool.slug)} className="font-semibold">
                  {tool.name}
                </a>
                <span className="text-ink-2"> · {tool.skipped.map((s) => `${s.name}: ${t(`costs.reasons.${s.reason}`)}`).join('; ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-1 text-xs text-ink-3">
        <li>{t('costs.noteOrder')}</li>
        <li>{t('costs.noteOverage')}</li>
        <li>{meter.fx.day ? t('costs.noteFx', { date: formatDate(meter.fx.day, locale) }) : t('costs.noteNoFx')}</li>
      </ul>
      {footer}
    </div>
  );
}
