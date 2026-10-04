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
import { ToolRow } from '@/components/data/ToolRow';
import { isWorld } from '@/lib/world-ids';

export async function generateMetadata({ params }: PageProps<'/[locale]/categories/[slug]'>): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const cat = findBySlug(catalog.categories, slug, locale);
  if (!cat) return {};
  const n = nameOf(cat, locale);
  return {
    title: n.name,
    description: clip(n.description ?? n.name),
    // Same gate as the sitemap: only locales with the category's own text are indexable.
    alternates: alternates(locale, (l) => href.category(l, nameOf(cat, l).slug), Object.keys(cat.text) as Locale[]),
    robots: robots(n.locale === locale),
  };
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
  const capIds = new Set(caps.map((c) => c.id));
  const toolCount = catalog.tools.filter((x) => x.status !== 'shutdown' && x.capabilities.some((c) => capIds.has(c.id))).length;
  const world = isWorld(cat.id) ? cat.id : null;
  return (
    <div data-world={world ?? undefined}>
      <section className="world-hero" aria-labelledby="world-title">
        <div className="container-page world-hero-grid">
          <div>
            <Breadcrumbs t={t} items={[{ label: t('categories.breadcrumb'), href: href.categories(locale) }, { label: n.name }]} />
            <h1 id="world-title" className="world-hero-title">
              {n.name}
            </h1>
            {n.description && <p className="hero-sub">{n.description}</p>}
            <p className="world-hero-stats">{t('categories.worldStats', { tools: toolCount, functions: caps.length, tasks: tasks.length })}</p>
            {tasks.length > 0 && (
              <div className="mt-6">
                <h2 id="tasks" className="eyebrow">
                  {t('categories.tasks')}
                </h2>
                <ul className="world-task-chips">
                  {tasks.map((x) => (
                    <li key={x.id}>
                      <Link href={href.task(locale, taskSlug(x, locale))} className="chip">
                        <span className="prompt-dot" aria-hidden="true" />
                        {taskTextOf(x, locale).title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container-page space-y-12 py-12">
        {caps.map((c) => {
          const tools = rankForCapability(catalog, c.id).slice(0, 5);
          const cn = nameOf(c, locale);
          return (
            <section key={c.id} aria-labelledby={`cap-${c.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`cap-${c.id}`} className="world-section-title text-xl">
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
