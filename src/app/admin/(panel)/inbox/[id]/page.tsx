/**
 * Inbox item (docs/strategy/12 §5.2): why you, recommendation, evidence,
 * impact, what happens if you do nothing, and the decision buttons.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { agentActions, capabilities, tools, reviewItems } from '@/lib/db/schema';
import { adminContext, type AdminContext } from '@/lib/admin/context';
import { flashMessage } from '@/lib/admin/flash';
import { actionLabel, dependencyAction, dependencyName, ifNothing, kindLabel, reasonText } from '@/lib/admin/labels';
import { formatDateTime, formatMoney, formatNumber } from '@/i18n/formatters';
import { getAdmin, can } from '@/lib/auth/session';
import { Badge, Card, Flash, severityTone, statusTone, Table, TextLink } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { auditVerdictsAction, decideAction, reenableAgentAction, revertFromInboxAction } from '../actions';
import type { AuditSampleItem } from '@/agents/defs/audit';

type Item = typeof reviewItems.$inferSelect;
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = await adminContext();
  const { id } = await params;
  return { title: `${t('admin.inbox.title')} · ${id.slice(0, 8)}` };
}

type ChangeLike = { toolName?: string; planKey?: string; oldCents?: number | null; newCents?: number; currency?: string; evidence?: string; sourceUrl?: string | null; confidence?: number };

function Changes({ list, ctx }: { list: ChangeLike[]; ctx: AdminContext }) {
  const { t, locale } = ctx;
  return (
    <Table head={[t('admin.common.tool'), 'Plan', t('admin.common.previous'), t('admin.common.value'), t('admin.common.source')]}>
      {list.map((c, i) => (
        <tr key={i}>
          <td className="font-semibold">{c.toolName ?? '—'}</td>
          <td className="mono text-xs">{c.planKey ?? '—'}</td>
          <td className="tabular">{formatMoney(c.oldCents ?? null, c.currency ?? null, locale)}</td>
          <td className="tabular font-semibold">{formatMoney(c.newCents ?? null, c.currency ?? null, locale)}</td>
          <td>
            {c.sourceUrl ? (
              <TextLink href={c.sourceUrl} external>
                {t('admin.inbox.openSource')}
              </TextLink>
            ) : (
              '—'
            )}
            {c.evidence && <blockquote className="mt-1 border-l-2 border-line pl-2 text-xs text-ink-3">“{c.evidence.slice(0, 240)}”</blockquote>}
          </td>
        </tr>
      ))}
    </Table>
  );
}

async function Evidence({ item, ctx }: { item: Item; ctx: AdminContext }) {
  const { t, locale, db } = ctx;
  const p = item.payload as Record<string, unknown>;
  switch (item.kind) {
    case 'price_change':
      return <Changes list={(Array.isArray(p.items) ? p.items : [p]) as ChangeLike[]} ctx={ctx} />;
    case 'anomaly_freeze':
      return <Changes list={(Array.isArray(p.changes) ? p.changes : []) as ChangeLike[]} ctx={ctx} />;
    case 'new_tool': {
      const d = (p.dossier ?? {}) as {
        name?: string;
        url?: string;
        title?: string | null;
        description?: string | null;
        capabilityIds?: string[];
        pricing?: { url: string | null; mentionsFree: boolean; amounts: string[] };
        legal?: { privacy: boolean; terms: boolean };
        waitlist?: boolean;
        signals?: Record<string, unknown>;
        score?: number;
        breakdown?: Record<string, number>;
      };
      const caps = d.capabilityIds?.length ? await db.select().from(capabilities).where(inArray(capabilities.id, d.capabilityIds)) : [];
      return (
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="eyebrow">URL</dt>
            <dd>{d.url ? <TextLink href={d.url} external>{d.url}</TextLink> : '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t('admin.candidates.score')}</dt>
            <dd className="tabular font-semibold">
              {d.score ?? '—'} <span className="text-xs text-ink-3">{d.breakdown ? Object.entries(d.breakdown).map(([k, v]) => `${k} ${v}`).join(' · ') : ''}</span>
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="eyebrow">{d.title ?? d.name}</dt>
            <dd>{d.description ? <blockquote className="border-l-2 border-line pl-2 text-ink-2">“{d.description}”</blockquote> : '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t('admin.candidates.capabilities')}</dt>
            <dd>{caps.length ? caps.map((c) => c.id).join(', ') : '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t('admin.candidates.pricing')}</dt>
            <dd>
              {d.pricing?.url ? <TextLink href={d.pricing.url} external>{d.pricing.url}</TextLink> : '—'}
              {d.pricing?.amounts?.length ? <span className="ml-2 mono text-xs">{d.pricing.amounts.join(' · ')}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{t('admin.candidates.legal')}</dt>
            <dd>
              {d.legal?.privacy ? '✓' : '✗'} / {d.legal?.terms ? '✓' : '✗'} {d.waitlist ? <Badge tone="warn">{t('admin.candidates.waitlist')}</Badge> : null}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{t('admin.candidates.signals')}</dt>
            <dd className="mono text-xs">
              {Object.entries(d.signals ?? {})
                .filter(([k]) => k !== 'dossier')
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(' · ')}
            </dd>
          </div>
        </dl>
      );
    }
    case 'dependency': {
      const key = typeof p.check === 'string' ? p.check : null;
      return (
        <div className="text-sm">
          {key && <p className="font-semibold">{dependencyName(t, key)}</p>}
          <p className="mono text-xs text-ink-3">{String(p.message ?? '')}</p>
          {key && <p className="mt-2">{dependencyAction(t, key)}</p>}
          {Array.isArray(p.sample) && <pre className="mt-2 overflow-x-auto rounded bg-paper-2 p-2 text-xs">{JSON.stringify(p.sample, null, 2)}</pre>}
        </div>
      );
    }
    case 'regression': {
      const cases = (p.cases ?? []) as { id: string; failures: string[] }[];
      const recent = (p.recentActions ?? []) as { id: string; agent: string; action: string; at: string }[];
      const reverted = recent.length ? new Set((await db.select().from(agentActions).where(inArray(agentActions.id, recent.map((r) => r.id)))).filter((a) => a.revertedAt).map((a) => a.id)) : new Set<string>();
      return (
        <div className="flex flex-col gap-4 text-sm">
          <div>
            <h3 className="eyebrow mb-1">{t('admin.inbox.cases')}</h3>
            <ul className="list-disc pl-5">
              {cases.map((c) => (
                <li key={c.id}>
                  <span className="mono">{c.id}</span>: {c.failures.join('; ')}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="eyebrow mb-1">{t('admin.inbox.recentActions')}</h3>
            {recent.length === 0 ? (
              <p className="text-ink-3">{t('admin.common.empty')}</p>
            ) : (
              <Table head={[t('admin.common.when'), t('admin.operations.agent'), t('admin.common.actions'), '']}>
                {recent.map((a) => (
                  <tr key={a.id}>
                    <td className="text-xs">{formatDateTime(a.at, locale)}</td>
                    <td className="mono text-xs">{a.agent}</td>
                    <td>{actionLabel(t, a.action)}</td>
                    <td>
                      {reverted.has(a.id) ? (
                        <Badge tone="neutral">{t('admin.common.reverted')}</Badge>
                      ) : (
                        <form action={revertFromInboxAction}>
                          <input type="hidden" name="actionId" value={a.id} />
                          <input type="hidden" name="back" value={`/admin/inbox/${item.id}`} />
                          <SubmitButton variant="ghost">{t('admin.common.revert')}</SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      );
    }
    case 'opportunity':
    case 'autonomy_proposal':
    case 'duplicate':
    case 'broken_link':
    case 'agent_failing':
    default:
      return (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-2">{t('admin.inbox.payload')}</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded bg-paper-2 p-3 text-xs">{JSON.stringify(p, null, 2)}</pre>
        </details>
      );
  }
}

async function AuditForm({ item, ctx }: { item: Item; ctx: AdminContext }) {
  const { t, db, locale } = ctx;
  const sample = (item.payload.sample ?? []) as AuditSampleItem[];
  const toolIds = [...new Set(sample.map((s) => s.toolId).filter((x): x is string => Boolean(x)))];
  const names = new Map((toolIds.length ? await db.select({ id: tools.id, name: tools.name }).from(tools).where(inArray(tools.id, toolIds)) : []).map((x) => [x.id, x.name]));
  const done = sample.filter((s) => s.verdict).length;
  return (
    <form action={auditVerdictsAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={item.id} />
      <p className="text-sm text-ink-2">{t('admin.inbox.audit.intro')}</p>
      <p className="text-xs text-ink-3">{t('admin.inbox.audit.progress', { done, total: sample.length })}</p>
      <ol className="flex flex-col divide-y divide-line">
        {sample.map((s) => (
          <li key={s.actionId} className="flex flex-col gap-2 py-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              <span className="font-semibold">{actionLabel(t, s.action)}</span> · {s.toolId ? names.get(s.toolId) ?? '—' : '—'} ·{' '}
              <span className="tabular text-ink-3">{s.confidence ?? '—'}</span> · <span className="text-xs text-ink-3">{formatDateTime(s.at, locale)}</span>
              {s.sourceUrl && (
                <>
                  {' '}
                  · <TextLink href={s.sourceUrl} external>{t('admin.inbox.openSource')}</TextLink>
                </>
              )}
            </div>
            <fieldset className="flex gap-3 text-sm">
              <legend className="sr-only">{actionLabel(t, s.action)}</legend>
              {(['correct', 'incorrect', 'unsure'] as const).map((v) => (
                <label key={v} className="flex items-center gap-1">
                  <input type="radio" name={`verdict_${s.actionId}`} value={v} defaultChecked={s.verdict === v} />
                  {t(`admin.inbox.audit.${v}`)}
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      <div>
        <SubmitButton>{t('admin.inbox.audit.submit')}</SubmitButton>
      </div>
    </form>
  );
}

function decisionLabels(item: Item, ctx: AdminContext): { approve: string; reject: string } {
  const { t } = ctx;
  if (item.kind === 'price_change' && item.reasonCode !== 'flagged_for_post_check') return { approve: t('admin.inbox.publishPrice'), reject: t('admin.inbox.keepOld') };
  if (item.kind === 'new_tool') return { approve: t('admin.inbox.createDraft'), reject: t('admin.inbox.reject') };
  return { approve: t('admin.inbox.approve'), reject: t('admin.inbox.reject') };
}

export default async function InboxItemPage({ params, searchParams }: Props) {
  const ctx = await adminContext();
  const { t, locale, db } = ctx;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [item] = await db.select().from(reviewItems).where(eq(reviewItems.id, id));
  if (!item) notFound();
  const user = (await getAdmin())!;
  const flash = flashMessage(await searchParams, t);
  const [tool] = item.toolId ? await db.select({ slug: tools.slug, name: tools.name }).from(tools).where(eq(tools.id, item.toolId)) : [];
  const pending = item.status === 'pending';
  const canDecide = can(user, 'editor');
  const labels = decisionLabels(item, ctx);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-2 text-sm">
        <TextLink href="/admin/inbox">← {t('admin.inbox.title')}</TextLink>
      </p>
      <Flash message={flash?.text ?? null} tone={flash?.tone} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={severityTone(item.severity)}>{t(`admin.severity.${item.severity}`)}</Badge>
        <span className="eyebrow">{kindLabel(t, item.kind)}</span>
        <span className="eyebrow">· {t(`admin.category.${item.category}`)}</span>
        {!pending && <Badge tone={statusTone(item.status)}>{t(`admin.inbox.status.${item.status}`)}</Badge>}
      </div>
      <h1 className="text-2xl">{item.title}</h1>
      <p className="mt-1 text-xs text-ink-3">
        {formatDateTime(item.createdAt, locale)} · {t('admin.inbox.createdBy', { who: item.createdBy })}
        {tool && (
          <>
            {' · '}
            <TextLink href={`/admin/tools/${item.toolId}`}>{tool.name}</TextLink>
            {' · '}
            <TextLink href={`/${locale}/tools/${tool.slug}`} external>
              {t('admin.inbox.openTool')}
            </TextLink>
          </>
        )}
      </p>

      <div className="mt-6 grid gap-4">
        <Card title={t('admin.inbox.whyYou')}>
          <p>{reasonText(t, item.reasonCode, item.title)}</p>
          {item.impact && (item.impact.evCentsPerMonth || item.impact.visits30d || item.impact.pages) && (
            <p className="mt-2 text-sm text-ink-2">
              {t('admin.inbox.impact')}:{' '}
              {[
                item.impact.pages ? t('admin.inbox.impactPages', { count: item.impact.pages }) : null,
                item.impact.visits30d ? t('admin.inbox.impactVisits', { count: formatNumber(item.impact.visits30d, locale) }) : null,
                item.impact.evCentsPerMonth ? t('admin.inbox.ev', { amount: formatMoney(item.impact.evCentsPerMonth, 'EUR', locale), basis: item.impact.evBasis ?? t('admin.common.estimate') }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </Card>

        <Card title={t('admin.inbox.evidence')}>
          {item.kind === 'audit_sample' && pending ? <AuditForm item={item} ctx={ctx} /> : <Evidence item={item} ctx={ctx} />}
        </Card>

        {pending && (
          <Card title={t('admin.inbox.ifNothing')}>
            <p>{ifNothing(t, locale, item.defaultAction, item.dueAt)}</p>
          </Card>
        )}

        {pending && canDecide && item.kind !== 'audit_sample' && (
          <Card>
            <form action={decideAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={item.id} />
              <div>
                <label className="label" htmlFor="note">
                  {t('admin.common.note')}
                </label>
                <textarea id="note" name="note" rows={2} maxLength={1000} className="input" />
              </div>
              <div className="flex flex-wrap gap-2">
                <SubmitButton name="decision" value="approve">
                  {labels.approve}
                </SubmitButton>
                <SubmitButton name="decision" value="reject" variant="ghost">
                  {labels.reject}
                </SubmitButton>
                <SubmitButton name="decision" value="snooze" variant="ghost">
                  {t('admin.inbox.snooze')}
                </SubmitButton>
                {item.defaultAction && (
                  <SubmitButton name="decision" value="default" variant="ghost">
                    {t('admin.inbox.applyDefault')}
                  </SubmitButton>
                )}
              </div>
            </form>
            {item.kind === 'agent_failing' && can(user, 'owner') && (
              <form action={reenableAgentAction} className="mt-3">
                <input type="hidden" name="id" value={item.id} />
                <SubmitButton variant="ghost">{t('admin.common.enable')}</SubmitButton>
              </form>
            )}
          </Card>
        )}
        {!pending && item.reviewNote && (
          <Card>
            <p className="text-sm text-ink-2">
              {item.reviewedBy} · {formatDateTime(item.reviewedAt, locale)}: {item.reviewNote}
            </p>
          </Card>
        )}
        {!canDecide && <p className="text-sm text-ink-3">{t('admin.common.readOnly')}</p>}
        <p className="text-xs text-ink-3">
          <Link href="/admin/inbox">{t('admin.common.back')}</Link>
        </p>
      </div>
    </div>
  );
}
