import type { NextRequest } from 'next/server';
import { getCatalog, toolText } from '@/lib/catalog';
import { getToolDetail } from '@/lib/catalog/detail';
import { siteUrl } from '@/lib/env';
import { href } from '@/lib/routes';
import { apiGuard, apiLocale, ATTRIBUTION, json } from '@/lib/api/public';

export async function GET(req: NextRequest, ctx: RouteContext<'/api/v1/tools/[slug]'>) {
  const limited = await apiGuard(req);
  if (limited) return limited;
  const { slug } = await ctx.params;
  const locale = apiLocale(req);
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(slug);
  if (!tool) return json({ error: 'not_found' }, 404);
  const detail = await getToolDetail(tool.id);
  const text = toolText(tool, locale);
  return json({
    attribution: ATTRIBUTION,
    slug: tool.slug,
    name: tool.name,
    url: siteUrl(href.tool(locale, tool.slug)),
    website: tool.websiteUrl,
    company: tool.companyName,
    status: tool.status,
    text: text ? { locale: text.locale, tagline: text.tagline, description: text.description, best_for: text.bestFor, not_for: text.notFor, limitations: text.limitations, content_status: text.contentStatus } : null,
    capabilities: tool.capabilities,
    freshness: tool.freshness,
    plans: tool.plans.map((p) => {
      const r = detail.plans[p.key];
      return {
        key: p.key,
        name: p.name,
        price_cents: p.priceCents,
        currency: p.currency,
        period: p.period,
        unit: p.unit,
        annual_monthly_cents: p.annualMonthlyCents,
        is_free: p.isFree,
        is_custom: p.isCustom,
        quota: p.quota,
        status: p.status,
        confidence: p.confidence,
        observed_at: p.observedAt.toISOString(),
        verified_at: p.verifiedAt?.toISOString() ?? null,
        sources: r?.sources.map((s) => ({ url: s.url, type: s.type })) ?? [],
      };
    }),
    facts: Object.values(detail.facts).map((f) => ({
      key: f.key,
      value: f.value,
      status: f.status,
      confidence: f.confidence,
      observed_at: f.observedAt.toISOString(),
      sources: f.sources.map((s) => ({ url: s.url, type: s.type })),
    })),
    price_history: detail.history
      .filter((h) => h.validTo !== null)
      .map((h) => ({ plan: h.planKey, price_cents: h.priceCents, currency: h.currency, valid_to: h.validTo!.toISOString(), source: h.sourceUrl })),
    alternatives: tool.alternatives.map((a) => catalog.toolsById.get(a.id)?.slug).filter(Boolean),
  });
}
