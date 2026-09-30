import type { Metadata } from 'next';
import Link from 'next/link';
import { asc, eq, ilike, or, and, type SQL } from 'drizzle-orm';
import { tools } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { formatRelative } from '@/i18n/formatters';
import { Badge, Card, Empty, PageHeader, statusTone, Table } from '@/components/admin/ui';
import { nowDate } from '@/lib/time';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.tools.title') };
}

export default async function ToolsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, t, locale } = await adminContext();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  const filter = sp.filter === 'draft' || sp.filter === 'published' ? sp.filter : 'all';
  const conds: SQL[] = [];
  if (q) conds.push(or(ilike(tools.name, `%${q.replace(/[%_]/g, '')}%`), ilike(tools.slug, `%${q.replace(/[%_]/g, '')}%`))!);
  if (filter !== 'all') conds.push(eq(tools.published, filter === 'published'));
  const list = await db.select().from(tools).where(conds.length ? and(...conds) : undefined).orderBy(asc(tools.published), asc(tools.name)).limit(300);
  const now = nowDate();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('admin.tools.title')} sub={`${list.length}`} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          {t('admin.tools.search')}
        </label>
        <input id="q" name="q" defaultValue={q} placeholder={t('admin.tools.search')} className="input max-w-xs" />
        <select name="filter" defaultValue={filter} className="input max-w-[12rem]" aria-label={t('admin.common.status')}>
          <option value="all">—</option>
          <option value="published">{t('admin.tools.published')}</option>
          <option value="draft">{t('admin.tools.draft')}</option>
        </select>
        <button type="submit" className="btn btn-ghost">
          {t('admin.tools.search')}
        </button>
      </form>
      <Card>
        {list.length === 0 ? (
          <Empty>{t('admin.common.empty')}</Empty>
        ) : (
          <Table head={[t('admin.common.name'), t('admin.common.status'), t('admin.tools.quality'), t('admin.tools.freshness'), t('admin.tools.indexable'), t('admin.tools.website')]}>
            {list.map((x) => (
              <tr key={x.id}>
                <td>
                  <Link href={`/admin/tools/${x.id}`} className="font-semibold">
                    {x.name}
                  </Link>
                  <div className="mono text-xs text-ink-3">{x.slug}</div>
                </td>
                <td>
                  <Badge tone={x.published ? 'ok' : 'warn'}>{x.published ? t('admin.tools.published') : t('admin.tools.draft')}</Badge>{' '}
                  <span className="text-xs text-ink-3">{x.status}</span>
                </td>
                <td className="tabular">{x.qualityScore}</td>
                <td>
                  <Badge tone={statusTone(x.freshness)}>{t(`freshness.${x.freshness}`)}</Badge>
                  <div className="text-xs text-ink-3">{x.lastCheckedAt ? formatRelative(x.lastCheckedAt, locale, now) : '—'}</div>
                </td>
                <td className="text-xs">{['tool', 'pricing', 'alternatives'].filter((k) => x.indexable[k as 'tool']).join(', ') || '—'}</td>
                <td>
                  <Badge tone={statusTone(x.websiteStatus)}>{x.websiteStatus}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
