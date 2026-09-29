import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate, formatMoney } from '@/i18n/formatters';
import { getCatalog } from '@/lib/catalog';
import { entryPaidPlan } from '@/lib/engine/compose';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { getStack } from '@/lib/stacks/store';
import { href } from '@/lib/routes';
import { emailEnabled, siteUrl } from '@/lib/env';
import { track } from '@/lib/analytics/track';
import { StackReceipt } from '@/components/stack/StackReceipt';
import { StepDetails } from '@/components/stack/StepDetails';
import { DisclosureNote } from '@/components/data/DisclosureNote';
import { WatchForm } from '@/components/forms/WatchForm';
import { ShareButtons } from '@/components/forms/ShareButtons';
import { deleteStackAction, watchStackAction } from './actions';

export async function generateMetadata({ params }: PageProps<'/[locale]/stack/[id]'>): Promise<Metadata> {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const stack = await getStack(id);
  const t = getT(locale);
  return {
    title: stack ? t('stackPage.metaTitle', { title: stack.snapshot.title }) : t('stackPage.notFound'),
    robots: { index: false, follow: false },
  };
}

export default async function StackPage({ params, searchParams }: PageProps<'/[locale]/stack/[id]'>) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const sp = await searchParams;
  const stack = await getStack(id);
  if (!stack) notFound();
  const t = getT(locale);
  const catalog = await getCatalog();
  const affiliates = await affiliateToolIds();
  await track({ path: `/${locale}/stack`, pageType: 'stack', locale, entityId: stack.id });
  const { result, title, prices } = stack.snapshot;
  const task = result.taskId ? (catalog.tasksById.get(result.taskId) ?? null) : null;

  // Stack Diff: saved prices/status vs current catalog.
  const diffs: string[] = [];
  for (const [toolId, saved] of Object.entries(prices ?? {})) {
    const tool = catalog.toolsById.get(toolId);
    if (!tool) {
      diffs.push(t('stackPage.diffRemoved', { tool: toolId.slice(0, 8) }));
      continue;
    }
    if (tool.status !== 'active' && tool.status !== 'beta') diffs.push(t('stackPage.diffStatus', { tool: tool.name, status: t(`toolStatus.${tool.status}`) }));
    const entry = entryPaidPlan(tool);
    const now = saved.cents === 0 ? 0 : (entry?.monthlyCents ?? null);
    if (saved.cents !== null && now !== null && saved.cents !== now && saved.currency) {
      diffs.push(
        t('stackPage.diffPrice', {
          tool: tool.name,
          old: formatMoney(saved.cents, saved.currency, locale),
          new: formatMoney(now, entry?.currency ?? saved.currency, locale),
        }),
      );
    } else if (saved.planKey && !tool.plans.some((p) => p.key === saved.planKey)) {
      diffs.push(t('stackPage.diffPlan', { tool: tool.name }));
    }
  }
  const url = siteUrl(href.stack(locale, stack.publicId));
  const tools = result.lines.map((l) => catalog.toolsById.get(l.toolId)).filter(Boolean);

  return (
    <div className="container-page py-8">
      {sp.saved === '1' && (
        <p role="status" className="notice mb-6">
          {t('stackPage.savedNotice')}
        </p>
      )}
      <p className="eyebrow">{t('stackPage.savedOn', { date: formatDate(stack.createdAt, locale) })}</p>
      <h1 className="mt-1 text-2xl md:text-3xl">{title}</h1>
      {stack.queryText && (
        <p className="mt-2 text-sm text-ink-2">
          <span className="text-ink-3">{t('stackPage.query')}:</span> “{stack.queryText}”
        </p>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-8">
          {tools.some((x) => affiliates.has(x!.id)) && <DisclosureNote t={t} locale={locale} />}
          <StackReceipt
            result={result}
            task={task}
            title={title}
            catalog={catalog}
            t={t}
            locale={locale}
            receiptNo={stack.publicId.toUpperCase().slice(0, 6)}
            date={stack.createdAt}
          />
          <section aria-labelledby="diff" className="card p-4">
            <h2 id="diff" className="text-lg">
              {t('stackPage.diffTitle')}
            </h2>
            {diffs.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">{t('stackPage.diffNone')}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {diffs.map((d) => (
                  <li key={d}>• {d}</li>
                ))}
              </ul>
            )}
            {stack.queryText && (
              <Link href={href.match(locale, { q: stack.queryText })} className="mt-3 inline-block text-sm">
                {t('stackPage.recompute')} →
              </Link>
            )}
          </section>
          <StepDetails result={result} task={task} catalog={catalog} t={t} locale={locale} affiliates={affiliates} src="stack" />
        </div>
        <aside className="space-y-6">
          <section className="card p-4" aria-labelledby="share">
            <h2 id="share" className="eyebrow">
              {t('stackPage.shareTitle')}
            </h2>
            <div className="mt-2">
              <ShareButtons url={url} text={t('stackPage.shareText', { title })} labels={{ share: t('common.share'), copy: t('common.copyLink'), copied: t('common.copied') }} />
            </div>
          </section>
          {emailEnabled() && (
          <section className="card p-4" aria-labelledby="watch">
            <h2 id="watch" className="eyebrow">
              {t('stackPage.watchTitle')}
            </h2>
            <p className="mt-2 text-sm text-ink-2">{t('stackPage.watchBody')}</p>
            <div className="mt-3">
              <WatchForm
                action={watchStackAction}
                hidden={{ locale, stack: stack.publicId }}
                labels={{ email: t('subscribe.email'), consent: t('subscribe.consent'), newsletter: t('subscribe.consentNewsletter'), submit: t('subscribe.submit') }}
              />
            </div>
          </section>
          )}
          <form action={deleteStackAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="stack" value={stack.publicId} />
            <button type="submit" className="text-xs text-ink-3 underline">
              {t('stackPage.delete')}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
