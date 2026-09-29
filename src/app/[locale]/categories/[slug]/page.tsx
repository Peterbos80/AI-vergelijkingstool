import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { findBySlug, getCatalog, nameOf, taskSlug, taskTextOf } from '@/lib/catalog';
import { rankForCapability } from '@/lib/engine/rank';
import { href } from '@/lib/routes';
import { alternates, clip } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ToolRow } from '@/components/data/ToolRow';

export async function generateMetadata({ params }: PageProps<'/[locale]/categories/[slug]'>): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const cat = findBySlug(catalog.categories, slug, locale);
  if (!cat) return {};
  const n = nameOf(cat, locale);
  return { title: n.name, description: clip(n.description ?? n.name), alternates: alternates(locale, (l) => href.category(l, nameOf(cat, l).slug)) };
}

export default async function CategoryPage({ params }: PageProps<'/[locale]/categories/[slug]'>) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const cat = findBySlug(catalog.categories, slug, locale);
  if (!cat) notFound();
  const n = nameOf(cat, locale);
  if (n.slug !== slug) permanentRedirect(href.category(locale, n.slug));
  const t = getT(locale);
  await track({ path: href.category(locale, n.slug), pageType: 'category', locale, entityId: cat.id });
  const caps = catalog.capabilities.filter((c) => c.categoryId === cat.id);
  const tasks = catalog.tasks.filter((x) => x.categoryId === cat.id);
  return (
    <div className="container-page py-8">
      <Breadcrumbs t={t} items={[{ label: t('categories.breadcrumb'), href: href.categories(locale) }, { label: n.name }]} />
      <h1 className="mt-6 text-3xl md:text-4xl">{n.name}</h1>
      {n.description && <p className="mt-2 max-w-2xl text-ink-2">{n.description}</p>}
      {tasks.length > 0 && (
        <section className="mt-8" aria-labelledby="tasks">
          <h2 id="tasks" className="eyebrow">
            {t('categories.tasks')}
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
      <div className="mt-10 space-y-10">
        {caps.map((c) => {
          const tools = rankForCapability(catalog, c.id).slice(0, 5);
          const cn = nameOf(c, locale);
          return (
            <section key={c.id} aria-labelledby={`cap-${c.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`cap-${c.id}`} className="text-xl">
                  {cn.name}
                </h2>
                <Link href={href.capability(locale, cn.slug)} className="text-sm">
                  {t('tasks.moreTools', { capability: cn.name.toLowerCase() })} →
                </Link>
              </div>
              {cn.description && <p className="mt-1 text-sm text-ink-2">{cn.description}</p>}
              <ul className="card mt-3 px-4">
                {tools.map((tool) => (
                  <ToolRow key={tool.id} tool={tool} catalog={catalog} t={t} locale={locale} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
