import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq, gt, inArray, isNull, lte, ne, or, asc, sql } from 'drizzle-orm';
import { reviewItems } from '@/lib/db/schema';
import { adminContext } from '@/lib/admin/context';
import { flashMessage } from '@/lib/admin/flash';
import { ifNothing, kindLabel, reasonText } from '@/lib/admin/labels';
import { formatDate, formatRelative } from '@/i18n/formatters';
import { Badge, Card, Empty, Flash, PageHeader, severityTone, statusTone } from '@/components/admin/ui';
import { nowDate } from '@/lib/time';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.inbox.title') };
}

const TABS = ['attention', 'queue', 'snoozed', 'resolved'] as const;
type Tab = (typeof TABS)[number];

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, t, locale } = await adminContext();
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'attention';
  const now = nowDate();
  const notSnoozed = or(isNull(reviewItems.snoozedUntil), lte(reviewItems.snoozedUntil, now));
  const where =
    tab === 'attention'
      ? and(eq(reviewItems.status, 'pending'), inArray(reviewItems.severity, ['p1', 'p2']), notSnoozed)
      : tab === 'queue'
        ? and(eq(reviewItems.status, 'pending'), eq(reviewItems.severity, 'p3'), notSnoozed)
        : tab === 'snoozed'
          ? and(eq(reviewItems.status, 'pending'), gt(reviewItems.snoozedUntil, now))
          : ne(reviewItems.status, 'pending');
  const order =
    tab === 'resolved'
      ? [desc(reviewItems.reviewedAt)]
      : [asc(reviewItems.severity), sql`${reviewItems.dueAt} NULLS LAST`, desc(reviewItems.priority), desc(reviewItems.createdAt)];
  const items = await db.select().from(reviewItems).where(where).orderBy(...order).limit(100);
  const flash = flashMessage(sp, t);
  const tabLabel: Record<Tab, string> = { attention: t('admin.inbox.attention'), queue: t('admin.inbox.queue'), snoozed: t('admin.inbox.snoozed'), resolved: t('admin.inbox.resolved') };
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t('admin.inbox.title')} />
      <Flash message={flash?.text ?? null} tone={flash?.tone} />
      <nav aria-label={t('admin.inbox.title')} className="mb-4 flex flex-wrap gap-2">
        {TABS.map((x) => (
          <Link key={x} href={`/admin/inbox?tab=${x}`} className="chip" aria-current={x === tab ? 'true' : undefined}>
            {tabLabel[x]}
          </Link>
        ))}
      </nav>
      <Card>
        {items.length === 0 ? (
          <Empty>{tab === 'attention' ? t('admin.overview.nothingToDo') : t('admin.inbox.empty')}</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="py-3 first:pt-0 last:pb-0">
                <Link href={`/admin/inbox/${i.id}`} className="group block no-underline">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={severityTone(i.severity)}>{t(`admin.severity.${i.severity}`)}</Badge>
                    <span className="eyebrow">{kindLabel(t, i.kind)}</span>
                    <span className="eyebrow">· {t(`admin.category.${i.category}`)}</span>
                    {i.groupCount > 1 && <Badge>{t('admin.inbox.group', { count: i.groupCount })}</Badge>}
                    {tab === 'resolved' && <Badge tone={statusTone(i.status)}>{t(`admin.inbox.status.${i.status}`)}</Badge>}
                    <span className="ml-auto text-xs text-ink-3">{formatRelative(i.createdAt, locale, now)}</span>
                  </div>
                  <p className="mt-1 font-semibold group-hover:underline">{i.title}</p>
                  <p className="text-sm text-ink-2">{reasonText(t, i.reasonCode, '')}</p>
                  {tab !== 'resolved' && (
                    <p className="mt-1 text-xs text-ink-3">
                      {t('admin.inbox.ifNothing')}: {ifNothing(t, locale, i.defaultAction, i.dueAt)}
                      {i.snoozedUntil && i.snoozedUntil > now ? ` · ${t('admin.inbox.snoozed')} → ${formatDate(i.snoozedUntil, locale)}` : ''}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
