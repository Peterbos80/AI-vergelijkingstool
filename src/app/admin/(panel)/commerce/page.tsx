import type { Metadata } from 'next';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { affiliateLinks, affiliatePrograms, leads, revenueEntries, subscribers, tools } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { flashMessage } from '@/lib/admin/flash';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/i18n/formatters';
import { can, getAdmin } from '@/lib/auth/session';
import { Badge, Card, Empty, Flash, PageHeader, statusTone, Table, TextLink } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { addEntryAction, addLinkAction, addProgramAction, importConversionsAction, leadStatusAction, programStatusAction, toggleLinkAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.commerce.title') };
}

const PROGRAM_STATUS = ['researching', 'applied', 'approved', 'rejected', 'paused', 'closed'] as const;
const LEAD_STATUS = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;

export default async function CommercePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, t, locale } = await adminContext();
  const user = (await getAdmin())!;
  const owner = can(user, 'owner');
  const flash = flashMessage(await searchParams, t);
  const [programs, links, entries, leadRows, toolList, [subs]] = await Promise.all([
    db.select({ p: affiliatePrograms, tool: tools.name, slug: tools.slug }).from(affiliatePrograms).innerJoin(tools, eq(tools.id, affiliatePrograms.toolId)).orderBy(asc(tools.name)),
    db.select({ l: affiliateLinks, tool: tools.name }).from(affiliateLinks).innerJoin(tools, eq(tools.id, affiliateLinks.toolId)).orderBy(asc(tools.name)),
    db.select().from(revenueEntries).orderBy(desc(revenueEntries.day)).limit(20),
    db.select().from(leads).orderBy(desc(leads.createdAt)).limit(30),
    db.select({ slug: tools.slug, name: tools.name }).from(tools).orderBy(asc(tools.name)),
    db
      .select({
        confirmed: sql<number>`count(*) FILTER (WHERE ${subscribers.status} = 'confirmed')::int`,
        pending: sql<number>`count(*) FILTER (WHERE ${subscribers.status} = 'pending')::int`,
        newsletter: sql<number>`count(*) FILTER (WHERE ${subscribers.status} = 'confirmed' AND ${subscribers.newsletter})::int`,
      })
      .from(subscribers),
  ]);
  const toolSelect = (name: string, required = true) => (
    <select name={name} className="input" required={required} defaultValue="" aria-label={t('admin.commerce.tool')}>
      <option value="" disabled={required}>
        {t('admin.commerce.tool')}
      </option>
      {toolList.map((x) => (
        <option key={x.slug} value={x.slug}>
          {x.name}
        </option>
      ))}
    </select>
  );
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('admin.commerce.title')} sub={t('admin.commerce.disclosure')} />
      <Flash message={flash?.text ?? null} tone={flash?.tone} />
      <div className="grid gap-4">
        <Card id="programs" title={t('admin.commerce.programs')}>
          {programs.length === 0 ? (
            <Empty>{t('admin.commerce.noPrograms')}</Empty>
          ) : (
            <Table head={[t('admin.commerce.tool'), t('admin.commerce.network'), t('admin.common.status'), t('admin.commerce.commission'), t('admin.commerce.cookieDays')]}>
              {programs.map(({ p, tool }) => (
                <tr key={p.id}>
                  <td className="font-semibold">
                    {tool}
                    {p.programUrl && (
                      <div className="text-xs font-normal">
                        <TextLink href={p.programUrl} external>
                          {p.programUrl.replace(/^https:\/\//, '').slice(0, 40)}
                        </TextLink>
                      </div>
                    )}
                  </td>
                  <td>{p.network}</td>
                  <td>
                    {owner ? (
                      <form action={programStatusAction} className="flex gap-1">
                        <input type="hidden" name="programId" value={p.id} />
                        <select name="status" defaultValue={p.status} className="input min-h-0 py-1 text-sm" aria-label={t('admin.common.status')}>
                          {PROGRAM_STATUS.map((s) => (
                            <option key={s} value={s}>
                              {t(`admin.commerce.programStatus.${s}`)}
                            </option>
                          ))}
                        </select>
                        <SubmitButton variant="ghost">{t('admin.common.save')}</SubmitButton>
                      </form>
                    ) : (
                      <Badge tone={statusTone(p.status === 'approved' ? 'ok' : 'neutral')}>{t(`admin.commerce.programStatus.${p.status}`)}</Badge>
                    )}
                  </td>
                  <td className="text-sm">
                    {p.commissionType} {p.commissionValue ?? ''}
                  </td>
                  <td className="tabular">{p.cookieDays ?? '—'}</td>
                </tr>
              ))}
            </Table>
          )}
          {owner && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">+ {t('admin.commerce.addProgram')}</summary>
              <form action={addProgramAction} className="mt-3 grid gap-3 sm:grid-cols-3">
                {toolSelect('tool')}
                <input name="network" placeholder={t('admin.commerce.network')} className="input" aria-label={t('admin.commerce.network')} />
                <select name="status" defaultValue="researching" className="input" aria-label={t('admin.common.status')}>
                  {PROGRAM_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {t(`admin.commerce.programStatus.${s}`)}
                    </option>
                  ))}
                </select>
                <select name="commissionType" defaultValue="unknown" className="input" aria-label={t('admin.commerce.commission')}>
                  {['recurring_percent', 'first_payment_percent', 'flat', 'cpc', 'unknown'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input name="commissionValue" placeholder="30" inputMode="decimal" className="input" aria-label={t('admin.commerce.commission')} />
                <input name="cookieDays" placeholder={t('admin.commerce.cookieDays')} inputMode="numeric" className="input" aria-label={t('admin.commerce.cookieDays')} />
                <input name="programUrl" placeholder="https://…" className="input sm:col-span-2" aria-label="URL" />
                <div>
                  <SubmitButton>{t('admin.common.save')}</SubmitButton>
                </div>
              </form>
            </details>
          )}
        </Card>

        <Card id="links" title={t('admin.commerce.links')}>
          {links.length === 0 ? (
            <Empty>{t('admin.commerce.noLinks')}</Empty>
          ) : (
            <Table head={[t('admin.commerce.tool'), 'URL', t('admin.common.status'), t('admin.commerce.lastCheck'), '']}>
              {links.map(({ l, tool }) => (
                <tr key={l.id}>
                  <td className="font-semibold">{tool}</td>
                  <td className="max-w-[20rem] truncate mono text-xs" title={l.urlTemplate}>
                    {l.urlTemplate}
                  </td>
                  <td>
                    <Badge tone={l.active ? 'ok' : 'neutral'}>{l.active ? t('admin.commerce.active') : t('admin.commerce.inactive')}</Badge>
                  </td>
                  <td className="text-xs">
                    {l.lastCheckedAt ? formatDateTime(l.lastCheckedAt, locale) : '—'} {l.lastStatus ? `(${l.lastStatus})` : ''}
                  </td>
                  <td>
                    {owner && (
                      <form action={toggleLinkAction}>
                        <input type="hidden" name="linkId" value={l.id} />
                        <input type="hidden" name="active" value={l.active ? '0' : '1'} />
                        <SubmitButton variant="ghost">{l.active ? t('admin.common.disable') : t('admin.common.enable')}</SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
          {owner && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">+ {t('admin.commerce.addLink')}</summary>
              <form action={addLinkAction} className="mt-3 grid gap-3 sm:grid-cols-3">
                {toolSelect('tool')}
                <select name="programId" defaultValue="" className="input" aria-label={t('admin.commerce.program')}>
                  <option value="">{t('admin.commerce.program')} —</option>
                  {programs.map(({ p, tool }) => (
                    <option key={p.id} value={p.id}>
                      {tool} · {p.network}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" /> {t('admin.commerce.active')}
                </label>
                <div className="sm:col-span-3">
                  <label className="label" htmlFor="urlTemplate">
                    {t('admin.commerce.template')}
                  </label>
                  <input id="urlTemplate" name="urlTemplate" placeholder="https://partner.example/?ref=you&sub={click_id}" className="input mono" required />
                </div>
                <div>
                  <SubmitButton>{t('admin.common.save')}</SubmitButton>
                </div>
              </form>
            </details>
          )}
        </Card>

        {owner && (
          <Card id="import" title={t('admin.commerce.import')}>
            <p className="mb-3 text-sm text-ink-2">{t('admin.commerce.importHelp')}</p>
            {programs.length === 0 ? (
              <Empty>{t('admin.commerce.noPrograms')}</Empty>
            ) : (
              <form action={importConversionsAction} className="flex flex-col gap-3">
                <select name="programId" required className="input max-w-md" aria-label={t('admin.commerce.program')} defaultValue="">
                  <option value="" disabled>
                    {t('admin.commerce.program')}
                  </option>
                  {programs.map(({ p, tool }) => (
                    <option key={p.id} value={p.id}>
                      {tool} · {p.network} ({t(`admin.commerce.programStatus.${p.status}`)})
                    </option>
                  ))}
                </select>
                <input type="file" name="file" accept=".csv,text/csv" className="text-sm" aria-label="CSV" />
                <textarea name="csv" rows={4} className="input mono text-xs" placeholder="external_id,occurred_at,amount,currency,status,click_id" aria-label="CSV" />
                <div>
                  <SubmitButton>{t('admin.commerce.import')}</SubmitButton>
                </div>
              </form>
            )}
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card id="entries" title={t('admin.commerce.entries')}>
            {entries.length === 0 ? (
              <Empty>{t('admin.commerce.noEntries')}</Empty>
            ) : (
              <Table head={[t('admin.commerce.day'), t('admin.commerce.entryKind'), t('admin.commerce.amount'), t('admin.commerce.description')]}>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs whitespace-nowrap">{formatDate(e.day, locale)}</td>
                    <td>{t(`admin.revenue.stream.${e.kind}`)}</td>
                    <td className="tabular">{formatMoney(e.amountCents, e.currency, locale)}</td>
                    <td className="text-xs text-ink-2">{e.description ?? ''}</td>
                  </tr>
                ))}
              </Table>
            )}
            {owner && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold">+ {t('admin.commerce.addEntry')}</summary>
                <form action={addEntryAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <select name="kind" className="input" aria-label={t('admin.commerce.entryKind')}>
                    {['sponsorship', 'newsletter', 'lead', 'data', 'other'].map((k) => (
                      <option key={k} value={k}>
                        {t(`admin.revenue.stream.${k}`)}
                      </option>
                    ))}
                  </select>
                  <input name="amount" placeholder="150.00" inputMode="decimal" required className="input" aria-label={t('admin.commerce.amount')} />
                  <input name="currency" defaultValue="EUR" maxLength={3} className="input" aria-label={t('admin.commerce.currency')} />
                  <input name="day" type="date" required className="input" aria-label={t('admin.commerce.day')} />
                  {toolSelect('tool', false)}
                  <input name="description" placeholder={t('admin.commerce.description')} className="input" aria-label={t('admin.commerce.description')} />
                  <div>
                    <SubmitButton>{t('admin.common.save')}</SubmitButton>
                  </div>
                </form>
              </details>
            )}
          </Card>

          <Card id="leads" title={t('admin.commerce.leads')}>
            {leadRows.length === 0 ? (
              <Empty>{t('admin.commerce.noLeads')}</Empty>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {leadRows.map((l) => (
                  <li key={l.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {l.name} {l.company ? `· ${l.company}` : ''}
                      </span>
                      <span className="text-xs text-ink-3">{formatDate(l.createdAt, locale)}</span>
                    </div>
                    <div className="text-xs text-ink-3">
                      {l.email} · {l.kind} · {l.companySize ?? ''}
                    </div>
                    {l.message && <p className="mt-1 text-ink-2">{l.message.slice(0, 300)}</p>}
                    {can(user, 'editor') && (
                      <form action={leadStatusAction} className="mt-2 flex flex-wrap gap-1">
                        <input type="hidden" name="leadId" value={l.id} />
                        <select name="status" defaultValue={l.status} className="input min-h-0 max-w-[10rem] py-1 text-sm" aria-label={t('admin.common.status')}>
                          {LEAD_STATUS.map((s) => (
                            <option key={s} value={s}>
                              {t(`admin.commerce.leadStatus.${s}`)}
                            </option>
                          ))}
                        </select>
                        <input name="value" placeholder="€" defaultValue={l.valueCents ? String(l.valueCents / 100) : ''} inputMode="decimal" className="input min-h-0 max-w-[7rem] py-1 text-sm" aria-label={t('admin.commerce.amount')} />
                        <SubmitButton variant="ghost">{t('admin.common.save')}</SubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card id="subscribers" title={t('admin.commerce.subscribers')}>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="eyebrow">{t('admin.commerce.confirmed')}</dt>
              <dd className="tabular text-xl font-bold">{formatNumber(subs?.confirmed ?? 0, locale)}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t('admin.commerce.pending')}</dt>
              <dd className="tabular text-xl font-bold">{formatNumber(subs?.pending ?? 0, locale)}</dd>
            </div>
            <div>
              <dt className="eyebrow">AI Pulse</dt>
              <dd className="tabular text-xl font-bold">{formatNumber(subs?.newsletter ?? 0, locale)}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
