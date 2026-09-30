import type { Metadata } from 'next';
import { healthChecks } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { flashMessage } from '@/lib/admin/flash';
import { dependencyAction, dependencyName } from '@/lib/admin/labels';
import { formatDateTime } from '@/i18n/formatters';
import { DEPENDENCIES } from '@/lib/ops/dependencies';
import { DEFAULT_SETTINGS, type SettingsKey } from '@/lib/settings';
import { can, getAdmin } from '@/lib/auth/session';
import { Badge, Card, Flash, PageHeader, statusTone, Table } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { checkNowAction, saveSettingsAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.automation.title') };
}

const SELECTS: Record<string, string[]> = { newToolMode: ['queue'], locale: ['nl', 'en'], currency: ['EUR'] };
const STEP: Record<string, string> = { gatingThreshold: '0.05', gatingMin: '0.05', gatingMax: '0.05', dailyBudgetUsd: '0.5', confirmHours: '1', priceIncreasePct: '1', priceDecreasePct: '1', maxToolsPct: '1', p1Pct: '1' };
const SKIP = new Set(['freshness']); // day ranges are documented, not tuned from the UI

export default async function AutomationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, t, locale, settings } = await adminContext();
  const user = (await getAdmin())!;
  const flash = flashMessage(await searchParams, t);
  const checks = await db.select().from(healthChecks);
  const editable = can(user, 'owner');
  const blockers = DEPENDENCIES.filter((d) => ['legal', 'owner_account', 'database'].includes(d.key) && checks.find((c) => c.key === d.key)?.status !== 'ok');
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t('admin.automation.title')} sub={t('admin.automation.intro')} />
      <Flash message={flash?.text ?? null} tone={flash?.tone} />

      <Card
        id="dependencies"
        title={t('admin.automation.dependencies')}
        action={
          <form action={checkNowAction}>
            <SubmitButton variant="ghost">{t('admin.common.runNow')}</SubmitButton>
          </form>
        }
      >
        {blockers.length > 0 && <p className="notice notice-warning mb-3 text-sm">{blockers.map((b) => dependencyName(t, b.key)).join(' · ')}</p>}
        <Table head={[t('admin.common.name'), t('admin.common.status'), t('admin.common.details'), t('admin.automation.lastOk')]}>
          {DEPENDENCIES.map((d) => {
            const c = checks.find((x) => x.key === d.key);
            return (
              <tr key={d.key}>
                <td>
                  <span className="font-semibold">{dependencyName(t, d.key)}</span>
                  <div className="max-w-[22rem] text-xs text-ink-3">{dependencyAction(t, d.key)}</div>
                </td>
                <td>
                  <Badge tone={statusTone(c?.status ?? 'unknown')}>{t(`admin.automation.depStatus.${c?.status ?? 'unknown'}`)}</Badge>
                </td>
                <td className="max-w-[16rem] mono text-xs text-ink-2">{c?.message ?? '—'}</td>
                <td className="text-xs text-ink-3">{c?.lastOkAt ? formatDateTime(c.lastOkAt, locale) : '—'}</td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(Object.keys(DEFAULT_SETTINGS) as SettingsKey[])
          .filter((k) => !SKIP.has(k))
          .map((key) => {
            const values = settings[key] as Record<string, unknown>;
            return (
              <Card key={key} id={key} title={t(`admin.automation.section.${key}`)}>
                <form action={saveSettingsAction} className="flex flex-col gap-3">
                  <input type="hidden" name="section" value={key} />
                  <fieldset disabled={!editable} className="flex flex-col gap-3">
                    {Object.entries(values).map(([field, value]) => {
                      const id = `${key}-${field}`;
                      const label = t.has(`admin.automation.field.${field}`) ? t(`admin.automation.field.${field}`) : field;
                      return (
                        <div key={field}>
                          <label className="label" htmlFor={id}>
                            {label}
                          </label>
                          {SELECTS[field] ? (
                            <select id={id} name={field} defaultValue={String(value)} className="input">
                              {SELECTS[field]!.map((o) => (
                                <option key={o} value={o}>
                                  {field === 'newToolMode' ? t(`admin.automation.newToolMode.${o}`) : o}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input id={id} name={field} className="input" type={typeof value === 'number' ? 'number' : 'text'} step={STEP[field] ?? '1'} defaultValue={String(value)} required />
                          )}
                        </div>
                      );
                    })}
                  </fieldset>
                  {editable && (
                    <div>
                      <SubmitButton>{t('admin.common.save')}</SubmitButton>
                    </div>
                  )}
                </form>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
