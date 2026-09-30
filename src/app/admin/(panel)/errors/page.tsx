import type { Metadata } from 'next';
import { sql } from 'drizzle-orm';
import { adminContext } from '@/lib/admin/context';
import { queryRows } from '@/lib/db/sql';
import { formatDateTime, formatNumber } from '@/i18n/formatters';
import { Badge, Card, Empty, PageHeader, Table } from '@/components/admin/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.errors.title') };
}

export default async function ErrorsPage() {
  const { db, t, locale } = await adminContext();
  const rows = await queryRows<{ fingerprint: string; scope: string; agent: string | null; message: string; count: string; last_at: string; days: string }>(
    db,
    sql`SELECT fingerprint, max(scope) AS scope, max(agent) AS agent, max(message) AS message, sum(count)::text AS count,
               max(at)::text AS last_at, count(DISTINCT day)::text AS days
        FROM error_log WHERE at > now() - interval '14 days'
        GROUP BY fingerprint ORDER BY max(at) DESC LIMIT 100`,
  );
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('admin.errors.title')} />
      <Card>
        {rows.length === 0 ? (
          <Empty>{t('admin.errors.empty')}</Empty>
        ) : (
          <Table head={[t('admin.errors.message'), t('admin.errors.scope'), t('admin.errors.count'), t('admin.errors.last')]}>
            {rows.map((r) => (
              <tr key={r.fingerprint}>
                <td className="max-w-[36rem] mono text-xs break-words">{r.message}</td>
                <td>
                  <Badge>{r.scope}</Badge>
                  {r.agent && <div className="mono text-xs text-ink-3">{r.agent}</div>}
                </td>
                <td className="tabular">
                  {formatNumber(Number(r.count), locale)}
                  <div className="text-xs text-ink-3">{r.days}d</div>
                </td>
                <td className="text-xs whitespace-nowrap">{formatDateTime(r.last_at, locale)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
