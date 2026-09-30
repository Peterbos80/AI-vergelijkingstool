import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { findBySlug, getCatalog, nameOf, taskSlug, taskTextOf } from '@/lib/catalog';
import { rankForCapability } from '@/lib/engine/rank';
import { href } from '@/lib/routes';
import { alternates, clip, robots } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JsonLd } from '@/components/ui/JsonLd';
import { ToolRow } from '@/components/data/ToolRow';
import { siteUrl } from '@/lib/env';

export async function generateMetadata({ params }: PageProps<'/[locale]/capabilities/[slug]'>): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const cap = findBySlug(catalog.capabilities, slug, locale);
  if (!cap) return {};
  const t = getT(locale);
  const n = nameOf(cap, locale);
  const tools = rankForCapability(catalog, cap.id);
  const primary = tools.filter((x) => x.capabilities.some((c) => c.id === cap.id && c.strength === 'primary')).length;
  return {
    title: t('capability.metaTitle', { name: n.name.toLowerCase(), year: new Date().getFullYear() }),
    description: clip(t('capability.metaDescription', { name: n.name.toLowerCase(), count: tools.length })),
    // Same gates as the sitemap: own text in this locale, and enough tools.
    alternates: alternates(locale, (l) => href.capability(l, nameOf(cap, l).slug), Object.keys(cap.text) as Locale[]),
    robots: robots(primary >= 4 && n.locale === locale),
  };
}

export default async function CapabilityPage({ params }: PageProps<'/[locale]/capabilities/[slug]'>) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const cap = findBySlug(catalog.capabilities, slug, locale);
  if (!cap) notFound();
  const n = nameOf(cap, locale);
  if (n.slug !== slug) permanentRedirect(href.capability(locale, n.slug));
  const t = getT(locale);
  await track({ path: href.capability(locale, n.slug), pageType: 'capability', locale, entityId: cap.id });
  const ranked = rankForCapability(catalog, cap.id);
  const primary = ranked.filter((x) => x.capabilities.some((c) => c.id === cap.id && c.strength === 'primary'));
  const secondary = ranked.filter((x) => !primary.includes(x));
  const category = catalog.categoriesById.get(cap.categoryId);
  const tasks = catalog.tasks.filter((x) => x.steps.some((s) => s.capabilityIds.includes(cap.id)));
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t('capability.title', { name: n.name.toLowerCase() }),
    itemListElement: ranked.slice(0, 20).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: siteUrl(href.tool(locale, x.slug)), name: x.name })),
  };
  return (
    <div className="container-page py-8">
      <Breadcrumbs
        t={t}
        items={[
          { label: t('categories.breadcrumb'), href: href.categories(locale) },
          ...(category ? [{ label: nameOf(category, locale).name, href: href.category(locale, nameOf(category, locale).slug) }] : []),
          { label: n.name },
        ]}
      />
      <JsonLd data={ld} />
      <h1 className="mt-6 text-3xl md:text-4xl">{t('capability.title', { name: n.name.toLowerCase() })}</h1>
      {n.description && <p className="mt-2 max-w-2xl text-ink-2">{n.description}</p>}
      <details className="mt-4 max-w-2xl text-sm">
        <summary className="cursor-pointer text-ink-2">{t('capability.ranking')}</summary>
        <p className="mt-2 text-ink-2">
          {t('capability.rankingText')} <Link href={href.page(locale, 'methodology')}>{t('receipts.methodologyLink')}</Link>
        </p>
      </details>
      <section className="mt-8" aria-labelledby="primary">
        <h2 id="primary" className="eyebrow">
          {t('capability.primaryTools')}
        </h2>
        <ol className="card mt-2 px-4">
          {primary.map((tool) => (
            <ToolRow key={tool.id} tool={tool} catalog={catalog} t={t} locale={locale} compareFormId="compare-form" />
          ))}
        </ol>
      </section>
      {secondary.length > 0 && (
        <section className="mt-8" aria-labelledby="secondary">
          <h2 id="secondary" className="eyebrow">
            {t('capability.secondaryTools')}
          </h2>
          <ul className="card mt-2 px-4">
            {secondary.map((tool) => (
              <ToolRow key={tool.id} tool={tool} catalog={catalog} t={t} locale={locale} compareFormId="compare-form" />
            ))}
          </ul>
        </section>
      )}
      <form id="compare-form" method="get" action={href.compare(locale)} className="mt-4">
        <button type="submit" className="btn btn-ghost btn-sm">
          {t('explorer.compareSelected')}
        </button>
      </form>
      {tasks.length > 0 && (
        <section className="mt-10" aria-labelledby="cap-tasks">
          <h2 id="cap-tasks" className="eyebrow">
            {t('capability.tasks')}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {tasks.map((x) => (
              <li key={x.id}>
                <Link href={href.task(locale, taskSlug(x, locale))} className="chip">
                  {taskTextOf(x, locale).title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
