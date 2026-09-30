/**
 * Sitemap with indexability gates (docs/strategy/05 §5); the page selection
 * lives in lib/sitemap so reports count exactly the pages listed here.
 */
import type { MetadataRoute } from 'next';
import { enabledLocales } from '@/i18n/config';
import { getCatalog } from '@/lib/catalog';
import { emailEnabled, siteUrl } from '@/lib/env';
import { sitemapEntries } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();
  return sitemapEntries(catalog, enabledLocales(), { newsletter: emailEnabled() }).map((e) => ({
    url: siteUrl(e.path),
    lastModified: e.lastModified,
    priority: e.priority,
    alternates: { languages: Object.fromEntries(Object.entries(e.languages).map(([k, p]) => [k, siteUrl(p)])) },
  }));
}
