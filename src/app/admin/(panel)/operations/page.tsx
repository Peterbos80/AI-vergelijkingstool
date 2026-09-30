import type { Metadata } from 'next';
import { desc } from 'drizzle-orm';
import { agentActions, agentConfigs, agentRuns } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { flashMessage } from '@/lib/admin/flash';
import { actionLabel } from '@/lib/admin/labels';
import { formatDateTime, formatRelative } from '@/i18n/formatters';
import { AGENTS } from '@/agents/registry';
import { isReversible } from '@/agents/actions';
import { can, getAdmin } from '@/lib/auth/session';
import { Badge, Card, Empty, Flash, PageHeader, statusTone, Table, TextLink } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { nowDate } from '@/lib/time';
import { revertActionAction, runNowAction, toggleAgentAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.operations.title') };
}

export default async function OperationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, t, locale } = await adminContext();
  const user = (await getAdmin())!;
  const now = nowDate();
  const [cfgs, runs, actions] = await Promise.all([
    db.select().from(agentConfigs),
    db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(40),
    db.select().from(agentActions).orderBy(desc(agentActions.createdAt)).limit(40),
  ]);
  const flash = flashMessage(await searchParams, t);
  const lastRun = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!lastRun.has(r.agent)) lastRun.set(r.agent, r);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('admin.operations.title')} />
      <Flash message={flash?.text ?? null} tone={flash?.tone} />
      <Card title={t('admin.operations.agents')} id="agents">
        <Table head={[t('admin.operations.agent'), t('admin.operations.schedule'), t('admin.operations.lastRun'), t('admin.operations.nextRun'), t('admin.operations.failures'), '']}>
          {AGENTS.map((a) => {
            const c = cfgs.find((x) => x.agent === a.name);
            const last = lastRun.get(a.name);
            return (
              <tr key={a.name}>
                <td>
                  <span className="font-semibold">{a.name}</span>
                  <div className="max-w-[22rem] text-xs text-ink-3">{t.has(`admin.agentDescription.${a.name}`) ? t(`admin.agentDescription.${a.name}`) : a.description}</div>
                </td>
                <td className="mono text-xs">{c?.schedule ?? a.schedule}</td>
                <td className="text-xs">
                  {c?.lastRunAt ? formatRelative(c.lastRunAt, locale, now) : t('admin.common.never')}
                  {last && (
                    <div>
                      <Badge tone={statusTone(last.status)}>{t(`admin.operations.status.${last.status}`)}</Badge>
                    </div>
                  )}
                </td>
                <td className="text-xs">{c?.enabled === false ? <Badge tone="warn">{t('admin.common.disabled')}</Badge> : c?.nextRunAt ? formatDateTime(c.nextRunAt, locale) : '—'}</td>
                <td className={`tabular ${c && c.consecutiveFailures > 0 ? 'text-danger font-semibold' : ''}`}>{c?.consecutiveFailures ?? 0}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {can(user, 'editor') && (
                      <form action={runNowAction}>
                        <input type="hidden" name="agent" value={a.name} />
                        <SubmitButton variant="ghost">{t('admin.common.runNow')}</SubmitButton>
                      </form>
                    )}
                    {can(user, 'owner') && (
                      <form action={toggleAgentAction}>
                        <input type="hidden" name="agent" value={a.name} />
                        <input type="hidden" name="enable" value={c?.enabled === false ? '1' : '0'} />
                        <SubmitButton variant="ghost">{c?.enabled === false ? t('admin.common.enable') : t('admin.common.disable')}</SubmitButton>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card title={t('admin.operations.runs')} id="runs">
          {runs.length === 0 ? (
            <Empty>{t('admin.operations.noRuns')}</Empty>
          ) : (
            <Table head={[t('admin.common.when'), t('admin.operations.agent'), t('admin.common.status'), t('admin.operations.summary')]}>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs whitespace-nowrap">
                    <TextLink href={`/admin/operations/runs/${r.id}`}>{formatDateTime(r.startedAt, locale)}</TextLink>
                  </td>
                  <td className="mono text-xs">{r.agent}</td>
                  <td>
                    <Badge tone={statusTone(r.status)}>{t(`admin.operations.status.${r.status}`)}</Badge>
                  </td>
                  <td className="max-w-[20rem] text-xs text-ink-2">{r.summary ?? r.error ?? ''}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title={t('admin.operations.actions')} id="actions">
          {actions.length === 0 ? (
            <Empty>{t('admin.overview.handledEmpty')}</Empty>
          ) : (
            <Table head={[t('admin.common.when'), t('admin.common.actions'), t('admin.common.status'), '']}>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="text-xs whitespace-nowrap">{formatDateTime(a.createdAt, locale)}</td>
                  <td>
                    <span className="text-sm">{actionLabel(t, a.action)}</span>
                    <div className="mono text-xs text-ink-3">
                      {a.agent}
                      {a.field ? ` · ${a.field}` : ''}
                      {a.sourceUrl ? (
                        <>
                          {' · '}
                          <TextLink href={a.sourceUrl} external>
                            {t('admin.common.source')}
                          </TextLink>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <Badge tone={a.decision === 'info' ? 'neutral' : a.decision === 'auto_published_flagged' ? 'warn' : 'ok'}>{t(`admin.operations.decision.${a.decision}`)}</Badge>
                  </td>
                  <td>
                    {a.revertedAt ? (
                      <Badge>{t('admin.common.reverted')}</Badge>
                    ) : isReversible(a.action) && can(user, 'owner') ? (
                      <form action={revertActionAction}>
                        <input type="hidden" name="actionId" value={a.id} />
                        <input type="hidden" name="back" value="/admin/operations" />
                        <SubmitButton variant="ghost">{t('admin.common.revert')}</SubmitButton>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
