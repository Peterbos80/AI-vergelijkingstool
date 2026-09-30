import type { Metadata } from 'next';
import { desc } from 'drizzle-orm';
import { reports } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { formatDate } from '@/i18n/formatters';
import { Badge, Card, Empty, PageHeader, TextLink } from '@/components/admin/ui';
import type { WeeklyReportData } from '@/lib/reports/weekly';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.reports.title') };
}

export default async function ReportsPage() {
  const { db, t, locale } = await adminContext();
  const list = await db.select().from(reports).orderBy(desc(reports.periodStart)).limit(104);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('admin.reports.title')} />
      <Card>
        {list.length === 0 ? (
          <Empty>{t('admin.reports.empty')}</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {list.map((r) => {
              const d = r.data as unknown as WeeklyReportData;
              const attention = d.inbox?.attention?.length ?? 0;
              return (
                <li key={r.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TextLink href={`/admin/reports/${r.id}`}>{t('admin.reports.week', { date: formatDate(r.periodStart, locale) })}</TextLink>
                    <Badge tone={attention ? 'signal' : 'ok'}>{attention ? t('admin.overview.attentionCount', { count: attention }) : t('admin.overview.nothingToDo')}</Badge>
                    <span className="text-xs text-ink-3">{r.emailedAt ? t('admin.reports.emailed', { date: formatDate(r.emailedAt, locale) }) : t('admin.reports.notEmailed')}</span>
                  </div>
                  <p className="text-sm text-ink-2">{(r.summary as Record<string, string>)[locale] ?? ''}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
