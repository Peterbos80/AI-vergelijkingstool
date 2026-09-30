import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { toolCandidates } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { flashMessage } from '@/lib/admin/flash';
import { formatDate } from '@/i18n/formatters';
import { can, getAdmin } from '@/lib/auth/session';
import { Badge, Card, Empty, Flash, PageHeader, statusTone, Table, TextLink } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { promoteAction, rejectCandidateAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.candidates.title') };
}

const STATUSES = ['verified', 'new', 'rejected', 'duplicate', 'promoted'] as const;

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, t, locale } = await adminContext();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as (typeof STATUSES)[number]) : 'verified';
  const list = await db.select().from(toolCandidates).where(eq(toolCandidates.status, status)).orderBy(desc(toolCandidates.confidence), desc(toolCandidates.lastSeenAt)).limit(200);
  const user = (await getAdmin())!;
  const flash = flashMessage(sp, t);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('admin.candidates.title')} />
      <Flash message={flash?.text ?? null} tone={flash?.tone} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label={t('admin.candidates.title')}>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/candidates?status=${s}`} className="chip" aria-current={s === status ? 'true' : undefined}>
            {t(`admin.candidates.status.${s}`)}
          </Link>
        ))}
      </nav>
      <Card>
        {list.length === 0 ? (
          <Empty>{t('admin.candidates.empty')}</Empty>
        ) : (
          <Table head={[t('admin.common.name'), t('admin.candidates.score'), t('admin.candidates.source'), t('admin.candidates.signals'), '']}>
            {list.map((c) => {
              const d = (c.signals.dossier ?? null) as { description?: string | null; pricing?: { amounts: string[] } } | null;
              return (
                <tr key={c.id}>
                  <td>
                    <TextLink href={c.url} external>
                      {c.name}
                    </TextLink>
                    <div className="mono text-xs text-ink-3">{c.domain}</div>
                    {d?.description && <div className="mt-1 max-w-[26rem] text-xs text-ink-2">“{d.description}”</div>}
                    {c.notes && <div className="text-xs text-ink-3">{c.notes}</div>}
                  </td>
                  <td>
                    <Badge tone={statusTone(c.status === 'verified' ? 'ok' : c.status === 'rejected' ? 'fail' : 'neutral')}>{c.confidence}</Badge>
                  </td>
                  <td className="text-xs">
                    {c.sourceUrl ? (
                      <TextLink href={c.sourceUrl} external>
                        {c.source}
                      </TextLink>
                    ) : (
                      c.source
                    )}
                    <div className="text-ink-3">{formatDate(c.firstSeenAt, locale)}</div>
                  </td>
                  <td className="mono text-xs">
                    {['hnPoints', 'githubStars']
                      .filter((k) => c.signals[k] !== undefined)
                      .map((k) => `${k}: ${String(c.signals[k])}`)
                      .join(' · ')}
                    {d?.pricing?.amounts?.length ? <div>{d.pricing.amounts.join(' · ')}</div> : null}
                  </td>
                  <td>
                    {can(user, 'editor') && (c.status === 'verified' || c.status === 'new') && (
                      <div className="flex flex-wrap gap-1">
                        <form action={promoteAction}>
                          <input type="hidden" name="candidateId" value={c.id} />
                          <SubmitButton>{t('admin.candidates.promote')}</SubmitButton>
                        </form>
                        <form action={rejectCandidateAction}>
                          <input type="hidden" name="candidateId" value={c.id} />
                          <SubmitButton variant="ghost">{t('admin.candidates.reject')}</SubmitButton>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
