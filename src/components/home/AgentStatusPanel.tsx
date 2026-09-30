import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDateTime } from '@/i18n/formatters';
import { scheduleParts, type AgentStatus } from '@/lib/ops/agent-status';

function scheduleLabel(schedule: string | null, t: Translator): string | null {
  const p = scheduleParts(schedule);
  if (!p) return null;
  return t(`hub.every.${p.unit}`, { n: p.n });
}

/**
 * "Autonomous agents": the real state of the agents that check the official
 * pages, from their run log. A bulb only pulses for an agent that is on
 * schedule; failures and delays are shown as they are.
 */
export function AgentStatusPanel({ statuses, asOf, t, locale }: { statuses: AgentStatus[]; asOf: Date; t: Translator; locale: Locale }) {
  const active = statuses.filter((s) => s.state === 'active').length;
  return (
    <section aria-labelledby="agents-title" className="hub-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="agents-title" className="text-2xl">
            <span aria-hidden="true">⚙️ </span>
            {t('hub.agentsTitle')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">{t('hub.agentsSub')}</p>
        </div>
        <p className="mono text-xs text-ink-3">
          {t('hub.agentsSummary', { active, total: statuses.length })} · <span data-dynamic>{t('hub.asOf', { time: formatDateTime(asOf, locale) })}</span>
        </p>
      </div>
      <ul className="agent-feed mt-5">
        {statuses.map((s) => {
          const every = scheduleLabel(s.schedule, t);
          const ran = s.state === 'active' || s.state === 'late';
          return (
            <li key={s.agent} className="agent-row" data-state={s.state}>
              <span className="bulb" data-state={s.state} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">{t(`hub.agent.${s.agent}.name`)}</span>{' '}
                  <span className="agent-state" data-state={s.state}>
                    {t(`hub.state.${s.state}`)}
                  </span>
                </p>
                <p className="text-xs text-ink-3">{t(`hub.agent.${s.agent}.does`)}</p>
              </div>
              <div className="mono shrink-0 text-right text-xs text-ink-2">
                {ran && <p>{t(`hub.agent.${s.agent}.result`, s.result)}</p>}
                {s.lastRunAt && (
                  <p className="text-ink-3" data-dynamic>
                    {t('hub.lastRun', { time: formatDateTime(s.lastRunAt, locale) })}
                  </p>
                )}
                {!ran && s.lastSuccessAt && (
                  <p className="text-ink-3" data-dynamic>
                    {t('hub.lastSuccess', { time: formatDateTime(s.lastSuccessAt, locale) })}
                  </p>
                )}
                {every && <p className="text-ink-3">{every}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
