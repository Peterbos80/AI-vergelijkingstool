/** Source bookkeeping shared by fetching agents: status, failures and a content hash per fetch. */
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';
import { sources, sourceSnapshots } from '@/lib/db/schema';
import { sourceDomain } from '@/lib/provenance/confidence';
import type { FetchResult } from '../fetcher/types';
import { contentHash, type PageText } from '../fetcher/text';

export async function recordFetch(
  db: Database,
  sourceId: string,
  res: FetchResult,
  text?: string,
  now: Date = new Date(),
): Promise<{ changed: boolean; hash: string | null }> {
  if (!res.ok) {
    const [s] = await db.select().from(sources).where(eq(sources.id, sourceId));
    await db
      .update(sources)
      .set({
        lastFetchedAt: now,
        lastStatus: res.status,
        lastError: `${res.errorKind ?? 'error'}: ${res.error ?? ''}`.slice(0, 300),
        failureCount: (s?.failureCount ?? 0) + 1,
        failingSince: s?.failingSince ?? now,
        robotsAllowed: res.errorKind === 'robots' ? false : (s?.robotsAllowed ?? null),
      })
      .where(eq(sources.id, sourceId));
    return { changed: false, hash: null };
  }
  const hash = text !== undefined ? contentHash(text) : null;
  const [s] = await db.select().from(sources).where(eq(sources.id, sourceId));
  const changed = Boolean(hash && s?.lastContentHash && s.lastContentHash !== hash);
  if (hash && (changed || !s?.lastContentHash) && text !== undefined) {
    await db.insert(sourceSnapshots).values({
      sourceId,
      fetchedAt: now,
      httpStatus: res.status,
      contentHash: hash,
      // Only a fingerprint of the page: its text is never stored or republished (docs/DATA_SOURCES.md).
      textLength: text.length,
      changed,
    });
  }
  await db
    .update(sources)
    .set({ lastFetchedAt: now, lastStatus: res.status, lastError: null, failureCount: 0, failingSince: null, robotsAllowed: true, lastContentHash: hash ?? s?.lastContentHash ?? null })
    .where(eq(sources.id, sourceId));
  return { changed, hash };
}

export async function toolSource(db: Database, toolId: string, role: 'pricing' | 'website' | 'changelog' | 'rss') {
  const [s] = await db.select().from(sources).where(and(eq(sources.toolId, toolId), eq(sources.role, role))).limit(1);
  return s ?? null;
}

/**
 * Every published tool with a pricing URL gets a pricing source, so the hourly
 * pricing agent checks its page (tools from the seed, the admin or the tool
 * scout alike). An existing source row for the same URL is claimed for the
 * pricing role when it belongs to no tool or to this tool. Returns the number
 * of sources added or claimed.
 */
export async function ensurePricingSources(db: Database): Promise<number> {
  const rows = await queryRows<{ id: string }>(
    db,
    sql`INSERT INTO sources (url, domain, source_type, tool_id, role, check_interval_hours)
        SELECT DISTINCT ON (t.pricing_url) t.pricing_url,
               regexp_replace(lower(substring(t.pricing_url from '^https?://([^/:?#]+)')), '^www[.]', ''),
               'official', t.id, 'pricing', 24
          FROM tools t
         WHERE t.published AND t.pricing_url ~ '^https?://[^/]+'
           AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.tool_id = t.id AND s.role = 'pricing')
         ORDER BY t.pricing_url, t.created_at
        ON CONFLICT (url) DO UPDATE SET role = 'pricing', tool_id = EXCLUDED.tool_id, source_type = 'official'
         WHERE sources.role IS DISTINCT FROM 'pricing' AND (sources.tool_id IS NULL OR sources.tool_id = EXCLUDED.tool_id)
        RETURNING id::text AS id`,
  );
  return rows.length;
}

const PRICING_PATH = /\/(pricing|prices|plans|prijzen|tarieven|tarifs|preise|precios)(\/|\.html?)?$/i;
const PRICING_TEXT = /^(pricing|prices|plans|plans (and|&) pricing|pricing plans|prijzen|tarieven|tarifs|preise|precios)$/i;

/**
 * The official pricing page a home page links to: https, on the tool's own
 * registrable domain, with a pricing path or a "Pricing" link text. A pricing
 * path wins over link text; fragments and tracking parameters are dropped.
 */
export function pricingLinkOf(page: Pick<PageText, 'links'>, homeUrl: string): string | null {
  const domain = sourceDomain(homeUrl);
  let best: { url: URL; byPath: boolean } | null = null;
  for (const l of page.links) {
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    if (u.protocol !== 'https:' || u.username || u.password || sourceDomain(u.toString()) !== domain) continue;
    const byPath = PRICING_PATH.test(u.pathname);
    if (!byPath && !PRICING_TEXT.test(l.text.trim())) continue;
    if (!best || (byPath && !best.byPath)) best = { url: u, byPath };
  }
  if (!best) return null;
  best.url.hash = '';
  for (const k of [...best.url.searchParams.keys()]) if (/^(utm_|ref$|source$)/i.test(k)) best.url.searchParams.delete(k);
  return best.url.toString();
}
