import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { agentActions, agentRuns } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { flashMessage } from '@/lib/admin/flash';
import { actionLabel } from '@/lib/admin/labels';
import { formatDateTime, formatNumber } from '@/i18n/formatters';
import { isReversible } from '@/agents/actions';
import { can, getAdmin } from '@/lib/auth/session';
import { Badge, Card, Empty, Flash, PageHeader, statusTone, Table, TextLink } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { revertActionAction, revertRunAction } from '../../actions';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.operations.runs') };
}

export default async function RunPage({ params, searchParams }: Props) {
  const { db, t, locale } = await adminContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id));
  if (!run) notFound();
  const actions = await db.select().from(agentActions).where(eq(agentActions.runId, id)).orderBy(desc(agentActions.createdAt));
  const user = (await getAdmin())!;
  const flash = flashMessage(await searchParams, t);
  const reversible = actions.filter((a) => isReversible(a.action) && !a.revertedAt);
  const duration = run.finishedAt ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000) : null;
  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-2 text-sm">
        <TextLink href="/admin/operations">← {t('admin.operations.title')}</TextLink>
      </p>
      <PageHeader
        title={`${run.agent} · ${formatDateTime(run.startedAt, locale)}`}
        sub={`${t('admin.operations.trigger')}: ${run.trigger}${duration !== null ? ` · ${t('admin.operations.duration')}: ${duration}s` : ''}`}
        action={<Badge tone={statusTone(run.status)}>{t(`admin.operations.status.${run.status}`)}</Badge>}
      />
      <Flash message={flash?.text ?? null} tone={flash?.tone} />
      <div className="grid gap-4">
        <Card title={t('admin.operations.summary')}>
          <p>{run.summary ?? '—'}</p>
          {run.error && <pre className="mt-2 overflow-x-auto rounded bg-paper-2 p-2 text-xs text-danger">{run.error}</pre>}
          {Object.keys(run.stats).length > 0 && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {Object.entries(run.stats).map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow">{k.replace(/_/g, ' ')}</dt>
                  <dd className="tabular font-semibold">{formatNumber(v, locale)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
        <Card
          title={t('admin.operations.actions')}
          action={
            reversible.length > 0 && can(user, 'owner') ? (
              <form action={revertRunAction}>
                <input type="hidden" name="runId" value={run.id} />
                <SubmitButton variant="danger" confirm={t('admin.operations.revertRun')}>
                  {t('admin.operations.revertRun')}
                </SubmitButton>
              </form>
            ) : undefined
          }
        >
          {actions.length === 0 ? (
            <Empty>{t('admin.common.empty')}</Empty>
          ) : (
            <Table head={[t('admin.common.actions'), t('admin.common.previous'), t('admin.common.value'), '']}>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td>
                    {actionLabel(t, a.action)}
                    <div className="mono text-xs text-ink-3">
                      {a.field ?? ''} {a.reason ? `· ${a.reason}` : ''}
                    </div>
                  </td>
                  <td className="max-w-[14rem] truncate mono text-xs">{a.oldValue ? JSON.stringify(a.oldValue) : '—'}</td>
                  <td className="max-w-[14rem] truncate mono text-xs">{a.newValue ? JSON.stringify(a.newValue) : '—'}</td>
                  <td>
                    {a.revertedAt ? (
                      <Badge>{t('admin.common.reverted')}</Badge>
                    ) : isReversible(a.action) && can(user, 'owner') ? (
                      <form action={revertActionAction}>
                        <input type="hidden" name="actionId" value={a.id} />
                        <input type="hidden" name="back" value={`/admin/operations/runs/${run.id}`} />
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
