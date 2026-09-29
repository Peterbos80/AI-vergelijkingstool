import type { NextRequest } from 'next/server';
import { getCatalog } from '@/lib/catalog';
import { eventTitle, localized } from '@/lib/catalog/events';
import { apiGuard, apiLocale, ATTRIBUTION, json } from '@/lib/api/public';

export async function GET(req: NextRequest) {
  const limited = await apiGuard(req);
  if (limited) return limited;
  const locale = apiLocale(req);
  const catalog = await getCatalog();
  return json({
    attribution: ATTRIBUTION,
    changes: catalog.events.slice(0, 100).map((e) => ({
      tool: e.toolId ? (catalog.toolsById.get(e.toolId)?.slug ?? null) : null,
      kind: e.kind,
      title: eventTitle(e, locale),
      summary: localized(e.summary, locale),
      occurred_at: e.occurredAt?.toISOString() ?? null,
      occurred_precision: e.occurredPrecision,
      detected_at: e.detectedAt.toISOString(),
      confidence: e.confidence,
      source: e.sourceUrl,
    })),
  });
}
