import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog, nameOf, toolText } from '@/lib/catalog';
import { href } from '@/lib/routes';
import { alternates, clip, robots } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ToolRow } from '@/components/data/ToolRow';
import type { CatalogTool } from '@/lib/catalog/types';

function liveAlternatives(tool: CatalogTool, byId: Map<string, CatalogTool>) {
  return tool.alternatives
    .map((a) => ({ alt: a, tool: byId.get(a.id) }))
    .filter((x): x is { alt: (typeof tool.alternatives)[number]; tool: CatalogTool } => Boolean(x.tool) && x.tool!.status !== 'shutdown');
}

export async function generateMetadata({ params }: PageProps<'/[locale]/tools/[slug]/alternatives'>): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(slug);
  if (!tool) return {};
  const t = getT(locale);
  const count = liveAlternatives(tool, catalog.toolsById).length;
  return {
    title: t('alternatives.metaTitle', { name: tool.name, count }),
    description: clip(t('alternatives.metaDescription', { name: tool.name })),
    alternates: alternates(locale, (l) => href.toolAlternatives(l, tool.slug), Object.keys(tool.text) as Locale[]),
    // Same gate as the sitemap: indexable only in locales with the tool's own text.
    robots: robots(tool.indexable.alternatives && toolText(tool, locale)?.locale === locale),
  };
}

export default async function AlternativesPage({ params }: PageProps<'/[locale]/tools/[slug]/alternatives'>) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(slug);
  if (!tool) notFound();
  const t = getT(locale);
  await track({ path: href.toolAlternatives(locale, tool.slug), pageType: 'tool_alternatives', locale, entityId: tool.id });
  const list = liveAlternatives(tool, catalog.toolsById);
  const mine = new Set(tool.capabilities.map((c) => c.id));
  const capName = (id: string) => {
    const c = catalog.capabilitiesById.get(id);
    return c ? nameOf(c, locale).name : id;
  };

  return (
    <article className="container-page py-8">
      <Breadcrumbs
        t={t}
        items={[
          { label: t('tool.breadcrumbTools'), href: href.tools(locale) },
          { label: tool.name, href: href.tool(locale, tool.slug) },
          { label: t('tool.alternatives') },
        ]}
      />
      <h1 className="mt-6 text-3xl md:text-4xl">{t('alternatives.title', { name: tool.name })}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('alternatives.intro')}</p>

      {list.length === 0 ? (
        <p className="mt-8 text-ink-2">{t('alternatives.none')}</p>
      ) : (
        <ul className="card mt-8 px-4">
          {list.map(({ alt, tool: other }) => {
            const theirs = new Set(other.capabilities.map((c) => c.id));
            const shared = [...mine].filter((c) => theirs.has(c));
            const extra = [...theirs].filter((c) => !mine.has(c));
            const missing = [...mine].filter((c) => !theirs.has(c));
            let priceNote: string | null = null;
            if (
              tool.entryPriceCents !== null &&
              other.entryPriceCents !== null &&
              tool.entryPriceCurrency === other.entryPriceCurrency
            ) {
              priceNote =
                other.entryPriceCents < tool.entryPriceCents
                  ? t('alternatives.cheaper')
                  : other.entryPriceCents > tool.entryPriceCents
                    ? t('alternatives.pricier')
                    : t('alternatives.samePrice');
            }
            return (
              <ToolRow
                key={other.id}
                tool={other}
                catalog={catalog}
                t={t}
                locale={locale}
                extra={
                  <div className="mt-2 space-y-1 text-xs text-ink-2">
                    <p>
                      <span className="text-ink-3">{t('alternatives.shared')}:</span> {shared.map(capName).join(', ') || '—'}
                    </p>
                    {extra.length > 0 && (
                      <p>
                        <span className="text-ink-3">{t('alternatives.extra')}:</span> {extra.map(capName).join(', ')}
                      </p>
                    )}
                    {missing.length > 0 && (
                      <p>
                        <span className="text-ink-3">{t('alternatives.missing')}:</span> {missing.map(capName).join(', ')}
                      </p>
                    )}
                    <p className="flex flex-wrap items-center gap-2">
                      {alt.score !== null && (
                        <span className="mono">
                          {t('alternatives.overlap')} {Math.round(alt.score * 100)}%
                        </span>
                      )}
                      <span className="mono text-ink-3">({t(`alternatives.${alt.source === 'computed' ? 'computed' : 'editorial'}`)})</span>
                      {priceNote && <span>· {priceNote}</span>}
                      <Link href={href.compare(locale, [tool.slug, other.slug])} className="underline">
                        {t('alternatives.compareBoth', { name: tool.name })}
                      </Link>
                    </p>
                  </div>
                }
              />
            );
          })}
        </ul>
      )}
    </article>
  );
}
