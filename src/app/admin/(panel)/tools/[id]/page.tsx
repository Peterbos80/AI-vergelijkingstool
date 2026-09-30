import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { agentActions, changeEvents, pricingPlans, sources, toolCapabilities, toolI18n, tools } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { flashMessage } from '@/lib/admin/flash';
import { actionLabel } from '@/lib/admin/labels';
import { publishGate } from '@/lib/admin/tools';
import { formatDateTime, formatMoney } from '@/i18n/formatters';
import { localized } from '@/lib/catalog/events';
import { can, getAdmin } from '@/lib/auth/session';
import { Badge, Card, Empty, Flash, PageHeader, statusTone, Table, TextLink } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { addPlanAction, approveTextsAction, capabilitiesAction, publishAction, saveBasicsAction, saveTextAction, unpublishAction } from '../actions';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { db, t } = await adminContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: t('admin.tools.title') };
  const [tool] = await db.select({ name: tools.name }).from(tools).where(eq(tools.id, id));
  return { title: tool?.name ?? t('admin.tools.title') };
}

export default async function ToolAdminPage({ params, searchParams }: Props) {
  const { db, t, locale } = await adminContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [tool] = await db.select().from(tools).where(eq(tools.id, id));
  if (!tool) notFound();
  const user = (await getAdmin())!;
  const editor = can(user, 'editor');
  const owner = can(user, 'owner');
  const [texts, caps, plans, srcs, events, actions, gate] = await Promise.all([
    db.select().from(toolI18n).where(eq(toolI18n.toolId, id)),
    db.select().from(toolCapabilities).where(eq(toolCapabilities.toolId, id)),
    db.select().from(pricingPlans).where(and(eq(pricingPlans.toolId, id), isNull(pricingPlans.validTo))).orderBy(pricingPlans.position),
    db.select().from(sources).where(eq(sources.toolId, id)),
    db.select().from(changeEvents).where(eq(changeEvents.toolId, id)).orderBy(desc(changeEvents.detectedAt)).limit(10),
    db.select().from(agentActions).where(eq(agentActions.toolId, id)).orderBy(desc(agentActions.createdAt)).limit(10),
    publishGate(db, id),
  ]);
  const flash = flashMessage(await searchParams, t);
  const primary = caps.filter((c) => c.strength === 'primary').map((c) => c.capabilityId);
  const secondary = caps.filter((c) => c.strength === 'secondary').map((c) => c.capabilityId);
  const field = (name: keyof typeof tool, label: string, value: string | null) => (
    <div key={name}>
      <label className="label" htmlFor={`f-${name}`}>
        {label}
      </label>
      <input id={`f-${name}`} name={name} defaultValue={value ?? ''} className="input" />
    </div>
  );
  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-2 text-sm">
        <TextLink href="/admin/tools">← {t('admin.tools.title')}</TextLink>
      </p>
      <PageHeader
        title={tool.name}
        sub={`${tool.slug} · ${t('admin.tools.quality')} ${tool.qualityScore} · ${tool.confidence}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tool.published ? 'ok' : 'warn'}>{tool.published ? t('admin.tools.published') : t('admin.tools.draft')}</Badge>
            {tool.published && (
              <TextLink href={`/${locale}/tools/${tool.slug}`} external>
                {t('admin.inbox.openTool')}
              </TextLink>
            )}
            {owner &&
              (tool.published ? (
                <form action={unpublishAction}>
                  <input type="hidden" name="toolId" value={id} />
                  <SubmitButton variant="ghost" confirm={t('admin.tools.unpublish')}>
                    {t('admin.tools.unpublish')}
                  </SubmitButton>
                </form>
              ) : (
                <form action={publishAction}>
                  <input type="hidden" name="toolId" value={id} />
                  <SubmitButton>{t('admin.tools.publish')}</SubmitButton>
                </form>
              ))}
          </div>
        }
      />
      <Flash message={flash?.text ?? null} tone={flash?.tone} />
      {!tool.published && gate.length > 0 && (
        <p className="notice notice-warning mb-4 text-sm">{t('admin.tools.publishBlocked', { reasons: gate.map((g) => t(`admin.tools.gate.${g}`)).join(', ') })}</p>
      )}

      <div className="grid gap-4">
        <Card title={t('admin.common.details')}>
          <form action={saveBasicsAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="toolId" value={id} />
            <fieldset disabled={!editor} className="contents">
              {field('name', t('admin.common.name'), tool.name)}
              <div>
                <label className="label" htmlFor="f-status">
                  {t('admin.tools.statusLabel')}
                </label>
                <select id="f-status" name="status" defaultValue={tool.status} className="input">
                  {['active', 'beta', 'waitlist', 'deprecated', 'shutdown', 'unknown'].map((s) => (
                    <option key={s} value={s}>
                      {t.has(`toolStatus.${s}`) ? t(`toolStatus.${s}`) : s}
                    </option>
                  ))}
                </select>
              </div>
              {field('websiteUrl', t('admin.tools.website'), tool.websiteUrl)}
              {field('pricingUrl', t('admin.tools.pricingUrl'), tool.pricingUrl)}
              {field('changelogUrl', 'Changelog URL', tool.changelogUrl)}
              {field('rssUrl', 'RSS URL', tool.rssUrl)}
              {field('githubRepo', 'GitHub (owner/repo)', tool.githubRepo)}
              {field('youtubeChannelId', 'YouTube channel id', tool.youtubeChannelId)}
            </fieldset>
            {editor && (
              <div className="md:col-span-2">
                <SubmitButton>{t('admin.common.save')}</SubmitButton>
              </div>
            )}
          </form>
        </Card>

        <Card
          title={t('admin.tools.texts')}
          action={
            editor && texts.some((x) => x.contentStatus === 'ai_draft' || x.contentStatus === 'machine_translated') ? (
              <form action={approveTextsAction}>
                <input type="hidden" name="toolId" value={id} />
                <SubmitButton variant="ghost">{t('admin.tools.approveTexts')}</SubmitButton>
              </form>
            ) : undefined
          }
        >
          <div className="grid gap-6 md:grid-cols-2">
            {(['nl', 'en'] as const).map((l) => {
              const x = texts.find((r) => r.locale === l);
              return (
                <form key={l} action={saveTextAction} className="flex flex-col gap-3">
                  <input type="hidden" name="toolId" value={id} />
                  <input type="hidden" name="locale" value={l} />
                  <div className="flex items-center gap-2">
                    <span className="eyebrow">{l}</span>
                    {x && <Badge tone={x.contentStatus === 'ai_draft' || x.contentStatus === 'machine_translated' ? 'warn' : 'ok'}>{t(`admin.tools.contentStatus.${x.contentStatus}`)}</Badge>}
                  </div>
                  <fieldset disabled={!editor} className="flex flex-col gap-3">
                    <div>
                      <label className="label" htmlFor={`tag-${l}`}>
                        {t('admin.tools.tagline')}
                      </label>
                      <input id={`tag-${l}`} name="tagline" defaultValue={x?.tagline ?? ''} maxLength={120} className="input" required />
                    </div>
                    <div>
                      <label className="label" htmlFor={`desc-${l}`}>
                        {t('admin.tools.description')}
                      </label>
                      <textarea id={`desc-${l}`} name="description" defaultValue={x?.description ?? ''} rows={5} maxLength={1200} className="input" required />
                    </div>
                    {(['bestFor', 'notFor', 'limitations'] as const).map((k) => (
                      <div key={k}>
                        <label className="label" htmlFor={`${k}-${l}`}>
                          {k}
                        </label>
                        <textarea id={`${k}-${l}`} name={k} defaultValue={(x?.[k] ?? []).join('\n')} rows={3} className="input" />
                      </div>
                    ))}
                  </fieldset>
                  {editor && (
                    <div>
                      <SubmitButton>{t('admin.common.save')}</SubmitButton>
                    </div>
                  )}
                </form>
              );
            })}
          </div>
        </Card>

        <Card title={t('admin.candidates.capabilities')}>
          <form action={capabilitiesAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="toolId" value={id} />
            <fieldset disabled={!editor} className="contents">
              <div>
                <label className="label" htmlFor="cap-primary">
                  primary
                </label>
                <input id="cap-primary" name="primary" defaultValue={primary.join(', ')} className="input mono" />
              </div>
              <div>
                <label className="label" htmlFor="cap-secondary">
                  secondary
                </label>
                <input id="cap-secondary" name="secondary" defaultValue={secondary.join(', ')} className="input mono" />
              </div>
            </fieldset>
            {caps.some((c) => c.note) && <p className="text-xs text-ink-3 md:col-span-2">{caps.find((c) => c.note)?.note}</p>}
            {editor && (
              <div className="md:col-span-2">
                <SubmitButton>{t('admin.common.save')}</SubmitButton>
              </div>
            )}
          </form>
        </Card>

        <Card title={t('admin.candidates.pricing')}>
          {plans.length === 0 ? (
            <Empty>{t('admin.common.empty')}</Empty>
          ) : (
            <Table head={['Plan', t('admin.common.value'), t('admin.common.status'), t('admin.common.source')]}>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name} <span className="mono text-xs text-ink-3">{p.planKey}</span>
                  </td>
                  <td className="tabular">{p.isFree ? t('common.free') : formatMoney(p.priceCents, p.currency, locale)}</td>
                  <td>
                    <Badge tone={statusTone(p.status === 'verified' ? 'ok' : p.status === 'unverified' ? 'warn' : 'info')}>{t(`status.${p.status}.label`)}</Badge>
                    <div className="text-xs text-ink-3">{p.verifiedAt ? formatDateTime(p.verifiedAt, locale) : ''}</div>
                  </td>
                  <td className="max-w-[18rem] text-xs text-ink-3">{p.evidence ? `“${p.evidence.slice(0, 120)}”` : '—'}</td>
                </tr>
              ))}
            </Table>
          )}
          {editor && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">+ Plan</summary>
              <form action={addPlanAction} className="mt-3 grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="toolId" value={id} />
                <input name="planKey" placeholder="key (e.g. pro)" className="input" required aria-label="plan key" />
                <input name="name" placeholder="Name" className="input" required aria-label="plan name" />
                <input name="price" placeholder="12.00" inputMode="decimal" className="input" aria-label="price" />
                <input name="annualMonthly" placeholder="10.00 (annual/mo)" inputMode="decimal" className="input" aria-label="annual monthly price" />
                <input name="currency" defaultValue="USD" maxLength={3} className="input" aria-label="currency" />
                <select name="billingPeriod" defaultValue="month" className="input" aria-label="billing period">
                  {['month', 'year', 'one_time', 'usage', 'custom'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isFree" /> {t('common.free')}
                </label>
                <div className="sm:col-span-3">
                  <SubmitButton>{t('admin.common.save')}</SubmitButton>
                </div>
              </form>
            </details>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t('admin.common.source')}>
            <ul className="flex flex-col gap-1.5 text-sm">
              {srcs.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow">{s.role}</span>
                  <TextLink href={s.url} external>
                    {s.url.replace(/^https?:\/\//, '').slice(0, 50)}
                  </TextLink>
                  {s.failureCount > 0 && <Badge tone="fail">{s.failureCount}×</Badge>}
                  <span className="text-xs text-ink-3">{s.lastFetchedAt ? formatDateTime(s.lastFetchedAt, locale) : '—'}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={t('admin.operations.actions')}>
            {actions.length === 0 && events.length === 0 ? (
              <Empty>{t('admin.common.empty')}</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {actions.map((a) => (
                  <li key={a.id}>
                    {actionLabel(t, a.action)} <span className="text-xs text-ink-3">{formatDateTime(a.createdAt, locale)}</span>
                  </li>
                ))}
                {events.map((e) => (
                  <li key={e.id} className="text-ink-2">
                    {localized(e.title, locale)} <span className="text-xs text-ink-3">{formatDateTime(e.detectedAt, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
