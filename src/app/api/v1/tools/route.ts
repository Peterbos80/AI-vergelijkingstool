import type { NextRequest } from 'next/server';
import { getCatalog, toolText } from '@/lib/catalog';
import { siteUrl } from '@/lib/env';
import { href } from '@/lib/routes';
import { apiGuard, apiLocale, ATTRIBUTION, json } from '@/lib/api/public';

export async function GET(req: NextRequest) {
  const limited = await apiGuard(req);
  if (limited) return limited;
  const locale = apiLocale(req);
  const catalog = await getCatalog();
  return json({
    attribution: ATTRIBUTION,
    count: catalog.tools.length,
    tools: catalog.tools.map((t) => ({
      slug: t.slug,
      name: t.name,
      url: siteUrl(href.tool(locale, t.slug)),
      tagline: toolText(t, locale)?.tagline ?? null,
      status: t.status,
      capabilities: t.capabilities,
      pricing_model: t.pricingModel,
      has_free_tier: t.hasFreeTier,
      entry_price: t.entryPriceCents === null ? null : { cents: t.entryPriceCents, currency: t.entryPriceCurrency, period: 'month', plan: t.entryPlanName },
      pricing_status: t.pricingStatus,
      confidence: t.confidence,
      freshness: t.freshness,
      price_checked_at: t.priceCheckedAt?.toISOString() ?? null,
    })),
  });
}
