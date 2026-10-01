'use client';
/**
 * The /costs hub: a tab per kind of calculation (usage meters, team costs)
 * and a choice of meter. "#team" or "#<meter id>" in the address opens that
 * tab or meter (links from task pages and labels).
 */
import { useId, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { MessageTree } from '@/i18n/format';
import type { MeterData } from '@/lib/compare/usage';
import type { TeamData } from '@/lib/compare/team';
import { ACTIVE_CHIP, CHIP_FOCUS, CostCalculator, useCostsT } from './CostCalculator';
import { TeamCosts } from './TeamCosts';

type Tab = 'usage' | 'team';
const TABS: Tab[] = ['usage', 'team'];

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const readHash = () => window.location.hash.slice(1);
const noHash = () => '';

export function CostsHub({ meters, team, locale, messages }: { meters: MeterData[]; team: TeamData; locale: Locale; messages: MessageTree }) {
  const t = useCostsT(locale, messages);
  const id = useId();
  const hash = useSyncExternalStore(subscribeHash, readHash, noHash);
  const [tabChoice, setTab] = useState<Tab | null>(null);
  const [meterChoice, setMeter] = useState<string | null>(null);
  const hashMeter = meters.find((m) => m.id === hash)?.id;
  const tab: Tab = tabChoice ?? (hash === 'team' && team.groups.length ? 'team' : 'usage');
  const meter = meters.find((m) => m.id === (meterChoice ?? hashMeter)) ?? meters[0];

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = TABS.indexOf(tab);
    const next = e.key === 'Home' ? TABS[0]! : e.key === 'End' ? TABS[TABS.length - 1]! : TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
    setTab(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={t('costs.tabsLabel')} className="flex flex-wrap gap-2">
        {TABS.filter((x) => x === 'usage' || team.groups.length > 0).map((x) => (
          <button
            key={x}
            id={`${id}-tab-${x}`}
            type="button"
            role="tab"
            aria-selected={tab === x}
            aria-controls={`${id}-panel-${x}`}
            tabIndex={tab === x ? 0 : -1}
            onClick={() => setTab(x)}
            onKeyDown={onTabKey}
            className={`chip font-semibold ${tab === x ? ACTIVE_CHIP : ''}`}
            data-testid={`costs-tab-${x}`}
          >
            {t(x === 'usage' ? 'costs.tabUsage' : 'costs.tabTeam')}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${id}-panel-usage`} aria-labelledby={`${id}-tab-usage`} hidden={tab !== 'usage'} className="mt-6">
        {meter && (
          <>
            <fieldset>
              <legend className="label">{t('costs.pickMeter')}</legend>
              <div className="flex flex-wrap gap-2">
                {meters.map((m) => (
                  <label key={m.id} className={`chip ${CHIP_FOCUS} ${m.id === meter.id ? ACTIVE_CHIP : ''}`}>
                    <input
                      type="radio"
                      name={`${id}-meter`}
                      value={m.id}
                      checked={m.id === meter.id}
                      onChange={() => setMeter(m.id)}
                      className="visually-hidden"
                    />
                    {t(`costs.meters.${m.id}.title`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <h2 className="mt-6 text-xl">{t(`costs.meters.${meter.id}.title`)}</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-2">{t(`costs.meters.${meter.id}.intro`)}</p>
            <div className="mt-4">
              <CostCalculator key={meter.id} meter={meter} locale={locale} messages={messages} question={t(`costs.meters.${meter.id}.question`)} />
            </div>
          </>
        )}
      </div>

      {team.groups.length > 0 && (
        <div role="tabpanel" id={`${id}-panel-team`} aria-labelledby={`${id}-tab-team`} hidden={tab !== 'team'} className="mt-6">
          <h2 className="text-xl">{t('costs.team.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">{t('costs.team.intro')}</p>
          <div className="mt-4">
            <TeamCosts data={team} locale={locale} messages={messages} />
          </div>
        </div>
      )}
    </div>
  );
}
