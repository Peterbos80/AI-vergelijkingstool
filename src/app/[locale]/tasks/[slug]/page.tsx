import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate, formatMoney } from '@/i18n/formatters';
import { findBySlug, getCatalog, nameOf, stepLabel, taskSlug, taskTextOf } from '@/lib/catalog';
import { composeStack } from '@/lib/engine/compose';
import { rankForCapability } from '@/lib/engine/rank';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { href } from '@/lib/routes';
import { alternates, clip, robots } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JsonLd } from '@/components/ui/JsonLd';
import { StackReceipt } from '@/components/stack/StackReceipt';
import { StepDetails } from '@/components/stack/StepDetails';
import { ToolRow } from '@/components/data/ToolRow';
import { DisclosureNote } from '@/components/data/DisclosureNote';
import { TaskGuideCard } from '@/components/start/TaskGuideCard';
import { TaskCosts } from '@/components/compare/TaskCosts';
import { FreeCheck } from '@/components/compare/FreeCheck';
import { taskGuide } from '@/content/task-guides';
import type { Catalog, CatalogTask } from '@/lib/catalog/types';
import type { Money } from '@/lib/engine/compose';

function gate(task: CatalogTask, catalog: Catalog): boolean {
  return task.steps
    .filter((s) => s.required)
    .every((s) => catalog.tools.filter((x) => x.status !== 'shutdown' && x.capabilities.some((c) => s.capabilityIds.includes(c.id))).length >= 2);
}

function money(list: Money[], locale: Locale, free: string): string {
  return list.length ? list.map((m) => formatMoney(m.cents, m.currency, locale)).join(' + ') : free;
}

export async function generateMetadata({ params }: PageProps<'/[locale]/tasks/[slug]'>): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const task = findBySlug(catalog.tasks, decodeURIComponent(slug), locale);
  if (!task) return {};
  const text = taskTextOf(task, locale);
  return {
    title: text.title,
    description: clip(text.summary ?? text.title),
    alternates: alternates(locale, (l) => href.task(l, taskSlug(task, l)), Object.keys(task.text) as Locale[]),
    robots: robots(gate(task, catalog) && text.locale === locale),
  };
}

export default async function TaskPage({ params }: PageProps<'/[locale]/tasks/[slug]'>) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const task = findBySlug(catalog.tasks, decodeURIComponent(slug), locale);
  if (!task) notFound();
  const canonical = taskSlug(task, locale);
  if (canonical !== decodeURIComponent(slug)) permanentRedirect(href.task(locale, canonical));
  const t = getT(locale);
  const text = taskTextOf(task, locale);
  const guide = taskGuide(task.id, locale);
  await track({ path: href.task(locale, canonical), pageType: 'task', locale, entityId: task.id });
  const affiliates = await affiliateToolIds();
  const recommended = composeStack(catalog, task, {}, 'recommended');
  const cheapest = composeStack(catalog, task, {}, 'budget');
  const fewest = composeStack(catalog, task, {}, 'fewest');
  const requiredWithoutFree = cheapest.steps.filter((s) => s.required && s.toolId && !cheapest.lines.find((l) => l.toolId === s.toolId)?.freePlanAvailable);
  const toolName = (id: string) => catalog.toolsById.get(id)?.name ?? id;
  const related = catalog.tasks
    .filter((x) => x.id !== task.id)
    .map((x) => ({ x, shared: x.steps.flatMap((s) => s.capabilityIds).filter((c) => task.steps.some((s) => s.capabilityIds.includes(c))).length }))
    .filter((r) => r.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 4)
    .map((r) => r.x);
  const checked = formatDate(catalog.stats.lastCheckAt, locale);
  const faq = [
    {
      q: t('tasks.faqCost', { task: text.title.toLowerCase() }),
      a: t('tasks.faqCostAnswer', {
        start: money(recommended.totals.core.start, locale, t('common.free').toLowerCase()),
        paid: money(recommended.totals.core.paid, locale, t('common.free').toLowerCase()),
        date: checked,
      }),
    },
    {
      q: t('tasks.faqFree'),
      a:
        requiredWithoutFree.length === 0
          ? t('tasks.faqFreeYes', { tools: cheapest.lines.map((l) => toolName(l.toolId)).join(', ') })
          : t('tasks.faqFreeNo', { steps: requiredWithoutFree.map((s) => stepLabel(task.steps.find((x) => x.key === s.key)!, locale).label.toLowerCase()).join(', ') }),
    },
    {
      q: t('tasks.faqTools'),
      a: t('tasks.faqToolsAnswer', { count: fewest.lines.filter((l) => !l.optional).length, tools: fewest.lines.filter((l) => !l.optional).map((l) => toolName(l.toolId)).join(', ') }),
    },
  ];
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <article className="container-page py-8">
      <Breadcrumbs t={t} items={[{ label: t('tasks.breadcrumb'), href: href.tasks(locale) }, { label: text.title }]} />
      <JsonLd data={ld} />
      <h1 className="mt-6 text-3xl md:text-4xl">{text.title}</h1>
      {text.summary && <p className="mt-2 max-w-2xl text-lg text-ink-2">{text.summary}</p>}
      {guide && (
        <div className="mt-6 max-w-3xl">
          <TaskGuideCard guide={guide} t={t} />
        </div>
      )}

      <section className="mt-8" aria-labelledby="workflow">
        <h2 id="workflow" className="text-xl">
          {t('tasks.workflow')}
        </h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {task.steps.map((s, i) => {
            const label = stepLabel(s, locale);
            return (
              <li key={s.key} className="card p-4">
                <p className="mono text-xs text-ink-3">
                  {i + 1} · {s.required ? t('tasks.required') : t('tasks.optional')}
                </p>
                <p className="mt-1 font-semibold">{label.label}</p>
                {label.hint && <p className="mt-1 text-sm text-ink-2">{label.hint}</p>}
                <p className="mt-2 text-xs text-ink-3">
                  {s.capabilityIds.map((c) => nameOf(catalog.capabilitiesById.get(c)!, locale).name).join(' · ')}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]" aria-labelledby="recommended">
        <div className="min-w-0 space-y-4">
          <h2 id="recommended" className="text-xl">
            {t('tasks.recommended')}
          </h2>
          <p className="text-sm text-ink-2">{t('tasks.recommendedNote')}</p>
          {recommended.lines.some((l) => affiliates.has(l.toolId)) && <DisclosureNote t={t} locale={locale} />}
          <StackReceipt result={recommended} task={task} title={text.title} catalog={catalog} t={t} locale={locale} receiptNo={task.id.slice(0, 4).toUpperCase()} date={catalog.stats.lastCheckAt ?? new Date()} />
          <Link href={href.match(locale, { q: text.title })} className="btn">
            {t('tasks.personalize')} →
          </Link>
          <div className="pt-4">
            <StepDetails result={recommended} task={task} catalog={catalog} t={t} locale={locale} affiliates={affiliates} src="task" />
          </div>
        </div>
        <aside className="space-y-6">
          <section className="card p-4" aria-labelledby="faq">
            <h2 id="faq" className="eyebrow">
              {t('tasks.faq')}
            </h2>
            <dl className="mt-2 space-y-3 text-sm">
              {faq.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold">{f.q}</dt>
                  <dd className="mt-1 text-ink-2">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
          {related.length > 0 && (
            <section className="card p-4" aria-labelledby="related">
              <h2 id="related" className="eyebrow">
                {t('tasks.related')}
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={href.task(locale, taskSlug(r, locale))}>{taskTextOf(r, locale).title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </section>

      <TaskCosts task={task} catalog={catalog} t={t} locale={locale} />
      <FreeCheck task={task} catalog={catalog} t={t} locale={locale} />

      <section className="mt-12" aria-labelledby="per-step">
        <h2 id="per-step" className="text-xl">
          {t('tasks.toolsPerStep')}
        </h2>
        <div className="mt-4 space-y-8">
          {task.steps.map((s) => (
            <div key={s.key}>
              <h3 className="font-semibold">{stepLabel(s, locale).label}</h3>
              <ul className="card mt-2 px-4">
                {[...new Map(s.capabilityIds.flatMap((c) => rankForCapability(catalog, c).slice(0, 4)).map((x) => [x.id, x])).values()]
                  .slice(0, 5)
                  .map((tool) => (
                    <ToolRow key={tool.id} tool={tool} catalog={catalog} t={t} locale={locale} />
                  ))}
              </ul>
              {s.capabilityIds.map((c) => {
                const cap = catalog.capabilitiesById.get(c)!;
                return (
                  <Link key={c} href={href.capability(locale, nameOf(cap, locale).slug)} className="mr-4 mt-2 inline-block text-sm">
                    {t('tasks.moreTools', { capability: nameOf(cap, locale).name.toLowerCase() })} →
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
