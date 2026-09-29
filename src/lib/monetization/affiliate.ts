/**
 * Affiliate link state for disclosure labels and the /go redirect.
 *
 * RANKING INDEPENDENCE: nothing in src/lib/engine may import this module.
 * The test `ranking-independence` enforces that boundary.
 */
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { affiliateLinks } from '@/lib/db/schema';
import { readDataVersion } from '@/lib/settings';

interface State {
  version: number;
  checkedAt: number;
  links: Map<string, { id: string; urlTemplate: string }>;
}

const g = globalThis as unknown as { __aitwAffiliate?: State };
const TTL = 15_000;

/** Active affiliate links by tool id (first active link wins). */
export async function getActiveAffiliateLinks(): Promise<Map<string, { id: string; urlTemplate: string }>> {
  const now = Date.now();
  const cur = g.__aitwAffiliate;
  if (cur && now - cur.checkedAt < TTL) return cur.links;
  const db = getDb();
  const version = await readDataVersion(db);
  if (cur && cur.version === version) {
    cur.checkedAt = now;
    return cur.links;
  }
  const rows = await db
    .select({ id: affiliateLinks.id, toolId: affiliateLinks.toolId, urlTemplate: affiliateLinks.urlTemplate })
    .from(affiliateLinks)
    .where(and(eq(affiliateLinks.active, true)));
  const links = new Map<string, { id: string; urlTemplate: string }>();
  for (const r of rows) if (!links.has(r.toolId)) links.set(r.toolId, { id: r.id, urlTemplate: r.urlTemplate });
  g.__aitwAffiliate = { version, checkedAt: now, links };
  return links;
}

export async function affiliateToolIds(): Promise<Set<string>> {
  return new Set((await getActiveAffiliateLinks()).keys());
}

/**
 * Build the outbound URL. `{click_id}` in the template is replaced by the
 * click id (the affiliate sub-id) so conversions can be attributed to pages.
 */
export function buildAffiliateUrl(template: string, clickId: string): string {
  return template.replaceAll('{click_id}', encodeURIComponent(clickId));
}
