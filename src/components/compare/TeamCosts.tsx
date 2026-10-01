'use client';
/**
 * Team costs: N users × the per-user or per-seat price, monthly billing
 * against annual billing. Data from lib/compare/team (build time); the order
 * is the computed yearly total in euros for the chosen billing, nothing else.
 */
import { useId, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { MessageTree, Translator } from '@/i18n/format';
import { formatDate, formatMoney } from '@/i18n/formatters';
import { href } from '@/lib/routes';
import { computeTeam, type Billing, type TeamData, type TeamRow } from '@/lib/compare/team';
import { eurFor, type FxData } from '@/lib/compare/usage';
import { LabelChip } from './LabelChip';
import { Money, Stamp, useCostsT, useHydrated } from './CostCalculator';

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

function PlanNotes({ row, t, locale }: { row: TeamRow; t: Translator; locale: Locale }) {
  const p = row.plan;
  const notes: string[] = [];
  if (p.minSeats !== null && row.seats > 0 && p.minSeats > 1) notes.push(t('costs.team.minSeats', { min: p.minSeats, seats: row.seats }));
  if (p.maxSeats !== null) notes.push(t('costs.team.maxSeats', { max: p.maxSeats }));
  if (p.annualOnly) notes.push(t('costs.team.annualOnly'));
  return (
    <>
      {notes.length > 0 && <span className="block text-xs text-ink-2">{notes.join(' · ')}</span>}
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
        {p.quota && <span className="mono">“{p.quota}”</span>}
        <Stamp status={p.status} t={t} />
        <span>{t('costs.observed', { date: formatDate(p.observedAt, locale) })}</span>
        <a href={href.toolPricing(locale, p.tool)}>{t('costs.receipt')}</a>
      </span>
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
  const first = result.ranked[0];
  const billingText = t(billing === 'monthly' ? 'costs.team.billingMonthly' : 'costs.team.billingAnnual');
  const summary = first
    ? t('costs.team.summary', {
        users: result.users,
        billing: billingText,
        tool: first.plan.toolName,
        plan: first.plan.name,
        price: formatMoney(first.eurPerYear!, 'EUR', locale),
      })
    : t('costs.team.summaryNone', { users: result.users, billing: billingText });
  const rows = [...result.ranked, ...result.unranked];
  const cheapest = result.ranked.length >= 2 ? result.ranked[0]!.eurPerYear : null;

  return (
    <div className="space-y-4" data-testid="team-costs" data-hydrated={hydrated ? '1' : undefined}>
      <div className="card space-y-4 p-4">
        <fieldset>
          <legend className="label">{t('costs.team.pickGroup')}</legend>
          <div className="flex flex-wrap gap-2">
            {data.groups.map((g) => (
              <label
                key={g.id}
                className={`chip has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${g.id === group.id ? 'chip-active' : ''}`}
              >
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
                <label
                  key={b}
                  className={`chip has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${b === billing ? 'chip-active' : ''}`}
                >
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

      <div className="table-scroll">
        <table className="table-data">
          <caption className="visually-hidden">{t('costs.team.caption', { users: result.users, billing: billingText })}</caption>
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
              <tr key={`${row.plan.tool}/${row.plan.key}`} data-plan={`${row.plan.tool}/${row.plan.key}`}>
                <th scope="row" className="min-w-56 whitespace-normal bg-transparent text-left font-sans text-sm font-normal normal-case tracking-normal text-ink">
                  <a href={href.tool(locale, row.plan.tool)} className="font-semibold text-ink">
                    {row.plan.toolName}
                  </a>
                  <span className="text-ink-2"> · {row.plan.name}</span>
                  {(row.plan.european || (cheapest !== null && row.eurPerYear === cheapest)) && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {cheapest !== null && row.eurPerYear === cheapest && (
                        <LabelChip label="cheapest" text={t('costs.labelCheapest')} href={`${href.costs(locale)}#label-cheapest`} />
                      )}
                      {row.plan.european && <LabelChip label="european" text={t('costs.labelEuropean')} href={`${href.costs(locale)}#label-european`} />}
                    </span>
                  )}
                  <PlanNotes row={row} t={t} locale={locale} />
                </th>
                <td>
                  <Cell cents={row.plan.monthlyCents} currency={row.plan.currency} fx={data.fx} locale={locale} t={t} />
                  {row.plan.annualMonthlyCents !== null && (
                    <span className="block text-xs text-ink-3">
                      {t('costs.team.annualPerUser', { price: formatMoney(row.plan.annualMonthlyCents, row.plan.currency, locale) })}
                    </span>
                  )}
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
      {result.unranked.length > 0 && <p className="text-xs text-ink-3">{t('costs.team.unrankedNote')}</p>}
      {result.tooMany.length > 0 && (
        <p className="text-sm text-ink-2">
          {t('costs.team.tooMany', {
            users: result.users,
            list: result.tooMany.map((p) => t('costs.team.tooManyItem', { tool: p.toolName, plan: p.name, max: p.maxSeats ?? 0 })).join('; '),
          })}
        </p>
      )}
      <ul className="space-y-1 text-xs text-ink-3">
        <li>{t('costs.team.noteOrder')}</li>
        <li>{t('costs.team.noteExtras')}</li>
        <li>{data.fx.day ? t('costs.noteFx', { date: formatDate(data.fx.day, locale) }) : t('costs.noteNoFx')}</li>
      </ul>
    </div>
  );
}
