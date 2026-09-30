/**
 * First-party, cookieless analytics. Page views are recorded server-side after
 * the response is sent (next/server `after`), so there is no client script,
 * no cookie and nothing for ad blockers to break. Prefetches, bots and
 * synthetic monitoring requests are excluded. The static edition records
 * nothing (docs/DEPLOYMENT.md).
 */
import { after } from 'next/server';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/client';
import { events } from '@/lib/db/schema';
import { staticSite } from '@/lib/env';
import { clientIp, deviceOf, isBot, referrerDomain, visitorHash } from './visitor';

export type PageType =
  | 'home'
  | 'match'
  | 'tools'
  | 'tool'
  | 'tool_pricing'
  | 'tool_alternatives'
  | 'compare'
  | 'fair_fight'
  | 'tasks'
  | 'task'
  | 'categories'
  | 'category'
  | 'capability'
  | 'doctor'
  | 'stack'
  | 'my_stack'
  | 'pulse'
  | 'news'
  | 'start'
  | 'learn'
  | 'static';

export interface TrackInput {
  type?: string;
  path: string;
  pageType: PageType;
  locale: string;
  entityId?: string | null;
  searchParams?: Record<string, string | string[] | undefined>;
  props?: Record<string, unknown>;
}

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function track(input: TrackInput): Promise<void> {
  // The static edition is rendered once at build time: there are no visits to count.
  if (staticSite()) return;
  const h = await headers();
  if (h.get('next-router-prefetch') || h.get('purpose') === 'prefetch' || h.get('x-aitw-synthetic')) return;
  const ua = h.get('user-agent');
  if (isBot(ua)) return;
  const ip = clientIp(h);
  const host = h.get('host');
  const row = {
    type: input.type ?? 'pageview',
    path: input.path.slice(0, 500),
    pageType: input.pageType,
    locale: input.locale,
    entityId: input.entityId ?? null,
    visitorHash: visitorHash(ip, ua!),
    referrerDomain: referrerDomain(h, host),
    utmSource: first(input.searchParams?.utm_source)?.slice(0, 100) ?? null,
    utmMedium: first(input.searchParams?.utm_medium)?.slice(0, 100) ?? null,
    utmCampaign: first(input.searchParams?.utm_campaign)?.slice(0, 100) ?? null,
    device: deviceOf(ua!),
    country: (h.get('x-vercel-ip-country') ?? h.get('cf-ipcountry'))?.slice(0, 2) ?? null,
    props: input.props ?? null,
  };
  after(async () => {
    try {
      await getDb().insert(events).values(row);
    } catch {
      // Analytics must never break a page.
    }
  });
}
