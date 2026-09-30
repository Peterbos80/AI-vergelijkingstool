/**
 * Monetization agent: affiliate link health (docs/strategy/12 §9).
 *  - validates each active link template (https, sane host, click-id slot);
 *  - follows the link weekly with our identifiable bot user agent (robots.txt
 *    respected; sub-id "linkcheck" so a network that counts it can filter it);
 *  - a link that fails twice in a row, or lands on another domain than the
 *    tool's website, is deactivated: /go then falls back to the direct link.
 *    Deactivation is logged and reversible; the owner gets a bundled P3 item
 *    (P2 when the tool is among the top-10 by outbound clicks).
 * It never changes which tools are recommended or in which order.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { affiliateLinks, outboundClicks, tools } from '@/lib/db/schema';
import { buildAffiliateUrl } from '@/lib/monetization/affiliate';
import { sourceDomain } from '@/lib/provenance/confidence';
import type { AgentDefinition } from '../types';

export const LINKCHECK_SUB_ID = 'linkcheck';

/** Static checks on a link template before any request is made. */
export function validateTemplate(template: string): string | null {
  const url = buildAffiliateUrl(template, LINKCHECK_SUB_ID);
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'invalid_url';
  }
  if (u.protocol !== 'https:') return 'not_https';
  if (u.username || u.password) return 'credentials_in_url';
  if (!u.hostname.includes('.')) return 'invalid_host';
  return null;
}

export const monetizationAgent: AgentDefinition = {
  name: 'monetization',
  description: 'Checks affiliate links weekly; deactivates broken ones (direct-link fallback) and reports them.',
  schedule: 'weekly:3:04:20',
  autonomy: 'auto',
  maxItems: 60,
  timeoutMs: 10 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const links = await db
      .select({ link: affiliateLinks, tool: tools })
      .from(affiliateLinks)
      .innerJoin(tools, eq(tools.id, affiliateLinks.toolId))
      .where(eq(affiliateLinks.active, true))
      .limit(ctx.limits.maxItems);
    if (!links.length) return { status: 'skipped', summary: 'no active affiliate links' };
    const top = await db
      .select({ toolId: outboundClicks.toolId, n: sql<number>`count(*)::int` })
      .from(outboundClicks)
      .where(gte(outboundClicks.ts, new Date(now.getTime() - 30 * 86_400_000)))
      .groupBy(outboundClicks.toolId)
      .orderBy(desc(sql`count(*)`))
      .limit(10);
    const topIds = new Set(top.map((x) => x.toolId));

    const results: { link: (typeof links)[number]['link']; tool: (typeof links)[number]['tool']; ok: boolean | null; status: number | null; reason: string | null; finalUrl: string | null }[] = [];
    for (const { link, tool } of links) {
      if (ctx.signal.aborted) break;
      const invalid = validateTemplate(link.urlTemplate);
      if (invalid) {
        results.push({ link, tool, ok: false, status: null, reason: invalid, finalUrl: null });
        continue;
      }
      const res = await ctx.fetcher.get(buildAffiliateUrl(link.urlTemplate, LINKCHECK_SUB_ID), { accept: 'any', light: true });
      if (res.errorKind === 'robots' || res.errorKind === 'ssrf') {
        results.push({ link, tool, ok: null, status: null, reason: res.errorKind, finalUrl: null });
        continue;
      }
      const landedOnTool = res.ok && sourceDomain(res.finalUrl) === sourceDomain(tool.websiteUrl);
      const ok = res.ok && landedOnTool;
      results.push({ link, tool, ok, status: res.status, reason: ok ? null : res.ok ? 'wrong_destination' : (res.errorKind ?? 'http'), finalUrl: res.finalUrl });
    }

    const checked = results.filter((r) => r.ok !== null);
    const failed = checked.filter((r) => r.ok === false && r.reason !== 'wrong_destination' && !['invalid_url', 'not_https', 'credentials_in_url', 'invalid_host'].includes(r.reason ?? ''));
    // Network sanity: most links failing at once points at our side.
    if (checked.length >= 6 && failed.length / checked.length >= 0.5) {
      return { status: 'partial', summary: `network suspected: ${failed.length}/${checked.length} affiliate checks failed — nothing deactivated` };
    }

    let deactivated = 0;
    for (const r of results) {
      if (r.ok === null) {
        ctx.stat('not_checkable');
        continue;
      }
      const previousFailed = r.link.lastCheckedAt !== null && (r.link.lastStatus === null || r.link.lastStatus >= 400);
      await db.update(affiliateLinks).set({ lastCheckedAt: now, lastStatus: r.ok ? (r.status ?? 200) : (r.status ?? null) }).where(eq(affiliateLinks.id, r.link.id));
      if (r.ok) {
        ctx.stat('ok');
        continue;
      }
      ctx.stat(`fail_${r.reason}`);
      // Structural problems act at once; transient HTTP/network failures need two checks in a row.
      const immediate = r.reason === 'wrong_destination' || r.reason === 'not_https' || r.reason === 'invalid_url' || r.reason === 'credentials_in_url' || r.reason === 'invalid_host';
      if (!immediate && !previousFailed) continue;
      await db.update(affiliateLinks).set({ active: false }).where(and(eq(affiliateLinks.id, r.link.id), eq(affiliateLinks.active, true)));
      await ctx.log.action({
        action: 'affiliate_link_deactivated',
        entityType: 'affiliate_link',
        entityId: r.link.id,
        toolId: r.tool.id,
        oldValue: { active: true },
        newValue: { active: false, finalUrl: r.finalUrl },
        decision: 'auto_published_flagged',
        reason: r.reason ?? 'failed',
      });
      await ctx.inbox.escalate({
        kind: 'broken_link',
        severity: topIds.has(r.tool.id) ? 'p2' : 'p3',
        category: 'commercial',
        toolId: r.tool.id,
        title: `Affiliate link for ${r.tool.name} deactivated (${r.reason}); direct link in use`,
        reasonCode: 'affiliate_link_broken',
        payload: { tool: r.tool.slug, linkId: r.link.id, reason: r.reason, status: r.status, finalUrl: r.finalUrl },
        defaultAction: 'keep_direct_link',
        dueInHours: 14 * 24,
        groupKey: topIds.has(r.tool.id) ? undefined : `affiliate-broken:${now.toISOString().slice(0, 7)}`,
        dedupeKey: `affiliate-broken:${r.link.id}:${now.toISOString().slice(0, 10)}`,
        createdBy: 'agent:monetization',
      });
      deactivated++;
    }
    return {
      status: 'success',
      summary: `${checked.length} affiliate links checked · ${deactivated} deactivated (direct-link fallback)`,
      dataChanged: deactivated > 0,
    };
  },
};
