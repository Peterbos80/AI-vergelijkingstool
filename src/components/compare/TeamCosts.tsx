'use client';
/**
 * Team costs: N users × the per-user or per-seat price, monthly billing
 * against annual billing. Data from lib/compare/team (build time); the order
 * is the computed yearly total in euros for the chosen billing, nothing else.
 * Phones get one card per plan; wider screens a table.
 */
import { useId, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { MessageTree, Translator } from '@/i18n/format';
import { formatDate, formatMoney } from '@/i18n/formatters';
import { href } from '@/lib/routes';
import { computeTeam, type Billing, type TeamData, type TeamRow } from '@/lib/compare/team';
import { eurFor, type FxData } from '@/lib/compare/usage';
import { LabelChip } from './LabelChip';
import { ACTIVE_CHIP, CHIP_FOCUS, Money, Stamp, useCostsT, useHydrated } from './CostCalculator';

function Cell({ cents, currency, fx, locale, t }: { cents: number | null; currency: string; fx: FxData; locale: Locale; t: Translator }) {
  if (cents === null) {
    return (
      <span className="text-ink-3">
        <span aria-hidden="true">– </span>
        {t('costs.team.unknown')}
      </span>
    );
  }
  return <Money cents={cents} eurCents={eurFor(cents, currency, fx)} currency={currency} fxDay={fx.day} locale={locale} t={t} />;
}

function PlanHead({ row, users, cheapest, t, locale }: { row: TeamRow; users: number; cheapest: boolean; t: Translator; locale: Locale }) {
  const p = row.plan;
  const notes: string[] = [];
  if (p.minSeats !== null && p.minSeats > 1)
    notes.push(row.seats > users ? t('costs.team.minSeatsApplied', { min: p.minSeats, seats: row.seats }) : t('costs.team.minSeats', { min: p.minSeats }));
  if (p.maxSeats !== null) notes.push(t('costs.team.maxSeats', { max: p.maxSeats }));
  if (p.annualOnly) notes.push(t('costs.team.annualOnly'));
  return (
    <>
      <a href={href.tool(locale, p.tool)} className="font-semibold text-ink">
        {p.toolName}
      </a>
      <span className="text-ink-2"> · {p.name}</span>
      {(cheapest || p.european) && (
        <span className="mt-1 flex flex-wrap gap-1.5">
          {cheapest && <LabelChip label="cheapest" text={t('costs.labelCheapest')} href={`${href.costs(locale)}#label-cheapest`} />}
          {p.european && <LabelChip label="european" text={t('costs.labelEuropean')} href={`${href.costs(locale)}#label-european`} />}
        </span>
      )}
      {notes.length > 0 && <span className="mt-0.5 block text-xs text-ink-2">{notes.join(' · ')}</span>}
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
        {p.quota && <span className="mono">“{p.quota}”</span>}
        <Stamp status={p.status} t={t} />
        <span>{t('costs.observed', { date: formatDate(p.observedAt, locale) })}</span>
        <a href={href.toolPricing(locale, p.tool)}>{t('costs.receipt')}</a>
      </span>
    </>
  );
}

function PerUser({ row, fx, locale, t }: { row: TeamRow; fx: FxData; locale: Locale; t: Translator }) {
  return (
    <>
      <Cell cents={row.plan.monthlyCents} currency={row.plan.currency} fx={fx} locale={locale} t={t} />
      {row.plan.annualMonthlyCents !== null && (
        <span className="block text-xs text-ink-3">{t('costs.team.annualPerUser', { price: formatMoney(row.plan.annualMonthlyCents, row.plan.currency, locale) })}</span>
      )}
    </>
  );
}

export function TeamCosts({ data, locale, messages }: { data: TeamData; locale: Locale; messages: MessageTree }) {
  const t = useCostsT(locale, messages);
  const id = useId();
  const hydrated = useHydrated();
  const [groupId, setGroupId] = useState(data.groups[0]?.id ?? '');
  const [users, setUsers] = useState(5);
  const [raw, setRaw] = useState('5');
  const [billing, setBilling] = useState<Billing>('monthly');
  const group = data.groups.find((g) => g.id === groupId) ?? data.groups[0];
  const result = useMemo(() => (group ? computeTeam(group, data.fx, users, billing) : null), [group, data.fx, users, billing]);
  if (!group || !result) return null;
  const setN = (n: number) => {
    const v = Math.min(1000, Math.max(1, Math.round(n) || 1));
    setUsers(v);
    setRaw(String(v));
  };
  const billingText = t(billing === 'monthly' ? 'costs.team.billingMonthly' : 'costs.team.billingAnnual');
  const yearly = (r: TeamRow) => (billing === 'monthly' ? r.monthlyPerYear : r.annualPerYear)!;
  const first = result.ranked[0];
  const firstNative = result.unconverted[0];
  const oneCurrency = new Set(result.unconverted.map((r) => r.plan.currency)).size === 1;
  const vars = { users: result.users, billing: billingText };
  const summary = first
    ? t(result.unconverted.length ? 'costs.team.summaryEuroOnly' : 'costs.team.summary', {
        ...vars,
        tool: first.plan.toolName,
        plan: first.plan.name,
        price: formatMoney(first.eurPerYear!, 'EUR', locale),
        count: result.unconverted.length,
      })
    : firstNative && oneCurrency
      ? t('costs.team.summaryUnconverted', {
          ...vars,
          tool: firstNative.plan.toolName,
          plan: firstNative.plan.name,
          price: formatMoney(yearly(firstNative), firstNative.plan.currency, locale),
        })
      : t('costs.team.summaryNone', vars);
  const rows = [...result.ranked, ...result.unconverted, ...result.unknown];
  // "Cheapest for your usage" only when every row with a price is in euros: no claim across currencies.
  const cheapest = result.ranked.length >= 2 && !result.unconverted.length ? result.ranked[0]!.eurPerYear : null;
  const isCheapest = (r: TeamRow) => cheapest !== null && r.eurPerYear === cheapest;
  const key = (r: TeamRow) => `${r.plan.tool}/${r.plan.key}`;

  return (
    <div className="space-y-4" data-testid="team-costs" data-hydrated={hydrated ? '1' : undefined}>
      <div className="card space-y-4 p-4">
        <fieldset>
          <legend className="label">{t('costs.team.pickGroup')}</legend>
          <div className="flex flex-wrap gap-2">
            {data.groups.map((g) => (
              <label key={g.id} className={`chip ${CHIP_FOCUS} ${g.id === group.id ? ACTIVE_CHIP : ''}`}>
                <input type="radio" name={`${id}-group`} value={g.id} checked={g.id === group.id} onChange={() => setGroupId(g.id)} className="visually-hidden" />
                {t(`costs.team.groups.${g.id}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label htmlFor={`${id}-users`} className="label">
              {t('costs.team.users')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={Math.min(users, 100)}
                onChange={(e) => setN(Number(e.target.value))}
                aria-label={t('costs.team.usersSlider')}
                aria-valuetext={t('costs.team.usersValue', { n: users })}
                className="w-40 cursor-pointer accent-accent"
              />
              <input
                id={`${id}-users`}
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  const n = Number(e.target.value);
                  if (e.target.value !== '' && Number.isInteger(n) && n >= 1 && n <= 1000) setUsers(n);
                }}
                onBlur={() => setN(Number(raw))}
                className="input w-24 tabular"
              />
            </div>
          </div>
          <fieldset>
            <legend className="label">{t('costs.team.billing')}</legend>
            <div className="flex flex-wrap gap-2">
              {(['monthly', 'annual'] as const).map((b) => (
                <label key={b} className={`chip ${CHIP_FOCUS} ${b === billing ? ACTIVE_CHIP : ''}`}>
                  <input type="radio" name={`${id}-billing`} value={b} checked={b === billing} onChange={() => setBilling(b)} className="visually-hidden" />
                  {t(b === 'monthly' ? 'costs.team.billingMonthly' : 'costs.team.billingAnnual')}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <p aria-live="polite" aria-atomic="true" className="text-sm font-semibold" data-testid="team-summary">
          {summary}
        </p>
      </div>

      {/* Phones: one card per plan. */}
      <ol className="space-y-2 sm:hidden" aria-label={t('costs.team.caption', vars)}>
        {rows.map((row) => (
          <li key={key(row)} className="card p-3" data-plan={key(row)}>
            <p>
              <PlanHead row={row} users={result.users} cheapest={isCheapest(row)} t={t} locale={locale} />
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-ink-3">{t('costs.team.colPerUser')}</dt>
                <dd>
                  <PerUser row={row} fx={data.fx} locale={locale} t={t} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">{t('costs.team.colMonthly')}</dt>
                <dd>
                  <Cell cents={row.monthlyPerYear} currency={row.plan.currency} fx={data.fx} locale={locale} t={t} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">{t('costs.team.colAnnual')}</dt>
                <dd>
                  <Cell cents={row.annualPerYear} currency={row.plan.currency} fx={data.fx} locale={locale} t={t} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">{t('costs.team.colSaving')}</dt>
                <dd>
                  <Cell cents={row.savingPerYear} currency={row.plan.currency} fx={data.fx} locale={locale} t={t} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <div className="table-scroll hidden sm:block">
        <table className="table-data">
          <caption className="visually-hidden">{t('costs.team.caption', vars)}</caption>
          <thead>
            <tr>
              <th scope="col">{t('costs.team.colTool')}</th>
              <th scope="col">{t('costs.team.colPerUser')}</th>
              <th scope="col">{t('costs.team.colMonthly')}</th>
              <th scope="col">{t('costs.team.colAnnual')}</th>
              <th scope="col">{t('costs.team.colSaving')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={key(row)} data-plan={key(row)}>
                <th scope="row" className="min-w-56 whitespace-normal bg-transparent align-top text-left font-sans text-sm font-normal normal-case tracking-normal text-ink">
                  <PlanHead row={row} users={result.users} cheapest={isCheapest(row)} t={t} locale={locale} />
                </th>
                <td>
                  <PerUser row={row} fx={data.fx} locale={locale} t={t} />
                </td>
                <td>
                  <Cell cents={row.monthlyPerYear} currency={row.plan.currency} fx={data.fx} locale={locale} t={t} />
                </td>
                <td>
                  <Cell cents={row.annualPerYear} currency={row.plan.currency} fx={data.fx} locale={locale} t={t} />
                </td>
                <td>
                  <Cell cents={row.savingPerYear} currency={row.plan.currency} fx={data.fx} locale={locale} t={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1 text-xs text-ink-3">
        {result.unconverted.length > 0 && <li>{t('costs.team.unconvertedNote')}</li>}
        {result.unknown.length > 0 && <li>{t('costs.team.unknownNote')}</li>}
        {result.tooMany.length > 0 && (
          <li className="text-sm text-ink-2">
            {t('costs.team.tooMany', {
              users: result.users,
              list: result.tooMany.map((p) => t('costs.team.tooManyItem', { tool: p.toolName, plan: p.name, max: p.maxSeats ?? 0 })).join('; '),
            })}
          </li>
        )}
        <li>{t('costs.team.noteOrder')}</li>
        <li>{t('costs.team.noteExtras')}</li>
        <li>{data.fx.day ? t('costs.noteFx', { date: formatDate(data.fx.day, locale) }) : t('costs.noteNoFx')}</li>
      </ul>
    </div>
  );
}
