/**
 * Static edition only: /data/<locale>.json holds what the browser needs to
 * compute Match, Stack Doctor, explorer filters and Compare (the catalog, the
 * message namespaces the shared views use, and which tools carry an affiliate
 * link for the disclosure notes). 404 in the server edition.
 */
import { NextResponse } from 'next/server';
import { isEnabledLocale } from '@/i18n/config';
import { pickMessages } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { catalogToWire } from '@/lib/catalog/wire';
import { staticSite } from '@/lib/env';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import type { SiteDataWire } from '@/components/static/StaticQueryPage';

export const dynamic = 'force-dynamic';

/** Message namespaces used by the shared views and their components. */
const CLIENT_NAMESPACES = [
  'common',
  'compare',
  'disclosure',
  'doctor',
  'explorer',
  'facts',
  'freshness',
  'lead',
  'limits',
  'match',
  'period',
  'platforms',
  'pricingModel',
  'reasons',
  'skill',
  'stack',
  'status',
  'tool',
  'toolStatus',
  'unit',
];

export async function GET(_req: Request, ctx: RouteContext<'/data/[file]'>) {
  const { file } = await ctx.params;
  const locale = /^([a-z]{2})\.json$/.exec(file)?.[1];
  if (!staticSite() || !locale || !isEnabledLocale(locale)) return new NextResponse('Not found', { status: 404 });
  const body: SiteDataWire = {
    catalog: catalogToWire(await getCatalog()),
    messages: pickMessages(locale, CLIENT_NAMESPACES),
    affiliates: [...(await affiliateToolIds())],
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex' } });
}
