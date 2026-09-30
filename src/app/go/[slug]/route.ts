/**
 * Outbound redirect with click tracking (docs/strategy/09 §3). The click id
 * doubles as the affiliate sub-id so network conversions can be attributed
 * to the page, position and Match that produced the click.
 */
import { after, NextResponse, type NextRequest } from 'next/server';
import { getCatalog } from '@/lib/catalog';
import { getDb } from '@/lib/db/client';
import { outboundClicks } from '@/lib/db/schema';
import { getActiveAffiliateLinks } from '@/lib/monetization/affiliate';
import { buildAffiliateUrl } from '@/lib/monetization/template';
import { clientIp, deviceOf, isBot, referrerDomain, visitorHash } from '@/lib/analytics/visitor';
import { ulid } from '@/lib/ids';
import { logError } from '@/lib/ops/errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, ctx: RouteContext<'/go/[slug]'>) {
  const { slug } = await ctx.params;
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(slug);
  if (!tool) return new NextResponse('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });

  const sp = request.nextUrl.searchParams;
  const clickId = ulid();
  const links = await getActiveAffiliateLinks();
  const link = links.get(tool.id);
  let target = tool.websiteUrl;
  let linkKind: 'affiliate' | 'direct' = 'direct';
  if (link) {
    const candidate = buildAffiliateUrl(link.urlTemplate, clickId);
    if (/^https?:\/\//i.test(candidate)) {
      target = candidate;
      linkKind = 'affiliate';
    }
  }

  const h = request.headers;
  const ua = h.get('user-agent');
  const host = h.get('host');
  let pagePath: string | null = null;
  const ref = h.get('referer');
  if (ref) {
    try {
      const u = new URL(ref);
      if (host && u.host === host) pagePath = u.pathname.slice(0, 300);
    } catch {
      /* ignore */
    }
  }
  const pos = Number(sp.get('pos'));
  const mq = sp.get('mq');
  if (!isBot(ua) && !h.get('x-aitw-synthetic')) {
    const row = {
      id: clickId,
      toolId: tool.id,
      linkKind,
      affiliateLinkId: linkKind === 'affiliate' ? link!.id : null,
      pagePath,
      pageType: sp.get('src')?.slice(0, 40) ?? null,
      locale: sp.get('l')?.slice(0, 5) ?? null,
      position: Number.isInteger(pos) && pos >= 0 && pos < 1000 ? pos : null,
      matchQueryId: mq && UUID.test(mq) ? mq : null,
      visitorHash: visitorHash(clientIp(h), ua!),
      referrerDomain: referrerDomain(h, host),
      device: deviceOf(ua!),
    };
    after(async () => {
      try {
        await getDb().insert(outboundClicks).values(row);
      } catch (err) {
        await logError('api', 'go: click insert failed', err);
      }
    });
  }

  return NextResponse.redirect(target, {
    status: 302,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
