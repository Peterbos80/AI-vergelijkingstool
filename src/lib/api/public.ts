/**
 * Helpers for the public read-only data API (/api/v1). Rate limited per IP,
 * CORS-open for GET, and every value carries status/confidence/date.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { DEFAULT_LOCALE, isEnabledLocale, type Locale } from '@/i18n/config';
import { rateLimit } from '@/lib/security/rate-limit';
import { staticSite } from '@/lib/env';
import { clientIp } from '@/lib/analytics/visitor';

export function apiLocale(req: NextRequest): Locale {
  const l = req.nextUrl.searchParams.get('locale');
  return isEnabledLocale(l) ? l : DEFAULT_LOCALE;
}

export async function apiGuard(req: NextRequest): Promise<NextResponse | null> {
  // The static edition is exported once at build time: nothing to protect, and the crawler must not be throttled.
  if (staticSite()) return null;
  const ipKey = createHash('sha256').update(clientIp(req.headers)).digest('hex').slice(0, 24);
  if (!(await rateLimit(`api:${ipKey}`, 60, 60))) {
    return json({ error: 'rate_limited', message: 'Max 60 requests per minute.' }, 429, { 'Retry-After': '60' });
  }
  return null;
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': status === 200 ? 'public, max-age=300, stale-while-revalidate=600' : 'no-store',
      'X-Robots-Tag': 'noindex',
      ...extra,
    },
  });
}

export const ATTRIBUTION = 'Data: AIToolsWijzer — attribution with a link is required; see the /api page for terms.';
