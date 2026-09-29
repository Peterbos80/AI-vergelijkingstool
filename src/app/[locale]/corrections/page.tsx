import type { Metadata } from 'next';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate } from '@/i18n/formatters';
import { getCatalog } from '@/lib/catalog';
import { getDb } from '@/lib/db/client';
import { reviewItems } from '@/lib/db/schema';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { CorrectionForm } from '@/components/forms/CorrectionForm';
import { correctionAction } from './actions';

export async function generateMetadata({ params }: PageProps<'/[locale]/corrections'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('corrections.title'), description: t('corrections.metaDescription'), alternates: alternates(locale, (l) => href.page(l, 'corrections')) };
}

export default async function CorrectionsPage({ params, searchParams }: PageProps<'/[locale]/corrections'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  await track({ path: href.page(locale, 'corrections'), pageType: 'static', locale });
  const catalog = await getCatalog();
  // Public log: handled corrections only, without personal data.
  const log = await getDb()
    .select({ id: reviewItems.id, toolId: reviewItems.toolId, status: reviewItems.status, reviewedAt: reviewItems.reviewedAt, payload: reviewItems.payload })
    .from(reviewItems)
    .where(and(eq(reviewItems.kind, 'correction'), inArray(reviewItems.status, ['approved', 'rejected', 'auto_resolved'])))
    .orderBy(desc(reviewItems.reviewedAt))
    .limit(50);
  const fields = ['price', 'free', 'feature', 'status', 'privacy', 'other'];
  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_24rem]">
      <div>
        <h1 className="text-3xl md:text-4xl">{t('corrections.title')}</h1>
        <p className="mt-2 max-w-2xl text-ink-2">{t('corrections.intro')}</p>
        <div className="card mt-6 p-5">
          <CorrectionForm
            action={correctionAction}
            locale={locale}
            defaultTool={typeof sp.tool === 'string' ? sp.tool : undefined}
            tools={[...catalog.tools].sort((a, b) => a.name.localeCompare(b.name)).map((x) => ({ slug: x.slug, name: x.name }))}
            fields={fields.map((f) => ({ value: f, label: t(`corrections.fieldOptions.${f}`) }))}
            labels={{
              tool: t('corrections.tool'),
              field: t('corrections.field'),
              correct: t('corrections.correct'),
              source: t('corrections.source'),
              email: t('corrections.email'),
              vendor: t('corrections.vendor'),
              submit: t('corrections.submit'),
            }}
          />
        </div>
      </div>
      <aside aria-labelledby="log">
        <h2 id="log" className="eyebrow">
          {t('corrections.logTitle')}
        </h2>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">{t('corrections.logEmpty')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {log.map((r) => (
              <li key={r.id} className="py-2">
                <span className="font-medium">{r.toolId ? (catalog.toolsById.get(r.toolId)?.name ?? '—') : '—'}</span> ·{' '}
                {t(`corrections.fieldOptions.${String(r.payload.field ?? 'other')}`)} ·{' '}
                {r.status === 'approved' ? t('corrections.logApproved') : r.status === 'rejected' ? t('corrections.logRejected') : t('corrections.logAuto')}
                <span className="block text-xs text-ink-3">{formatDate(r.reviewedAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
