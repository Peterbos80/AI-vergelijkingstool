/**
 * Duplicate agent: flags published tools that look like the same product
 * (same website, or the same normalised name/alias). Merging is a human
 * decision (R2); the item expires as P3 when ignored. Two product pages on one
 * shared host (adobe.com/products/photoshop and adobe.com/express) are
 * different products; a root site and a page on it are not.
 */
import { eq } from 'drizzle-orm';
import { tools } from '@/lib/db/schema';
import { normalize } from '@/lib/engine/text';
import type { AgentDefinition } from '../types';

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** The website's host and its path ('' for the root), lowercased, without a trailing slash or index page. */
export function siteKey(url: string): { host: string; path: string } | null {
  const host = hostOf(url);
  if (!host) return null;
  const path = new URL(url).pathname.toLowerCase().replace(/\/index\.html?$/, '/').replace(/\/+$/, '');
  return { host, path };
}

export function duplicatePairs(list: { id: string; slug: string; name: string; aliases: string[]; websiteUrl: string }[]): { a: string; b: string; reason: 'same_host' | 'same_name' }[] {
  const out: { a: string; b: string; reason: 'same_host' | 'same_name' }[] = [];
  const seen = new Set<string>();
  const push = (a: string, b: string, reason: 'same_host' | 'same_name') => {
    const [x, y] = [a, b].sort();
    const key = `${x}|${y}`;
    if (x === y || seen.has(key)) return;
    seen.add(key);
    out.push({ a: x!, b: y!, reason });
  };
  const byHost = new Map<string, { id: string; path: string }[]>();
  const byName = new Map<string, string>();
  for (const t of list) {
    const site = siteKey(t.websiteUrl);
    if (site) {
      const here = byHost.get(site.host) ?? [];
      for (const other of here) if (other.path === '' || site.path === '' || other.path === site.path) push(other.id, t.id, 'same_host');
      here.push({ id: t.id, path: site.path });
      byHost.set(site.host, here);
    }
    for (const n of [t.name, ...t.aliases].map(normalize).filter((x) => x.length >= 3)) {
      const other = byName.get(n);
      if (other && other !== t.id) push(other, t.id, 'same_name');
      else byName.set(n, t.id);
    }
  }
  return out;
}

export const duplicateAgent: AgentDefinition = {
  name: 'duplicate',
  description: 'Flags tools that share a website host or a normalised name; merging stays a human decision.',
  schedule: 'weekly:0:05:00',
  autonomy: 'auto',
  maxItems: 50,
  timeoutMs: 60_000,
  async run(ctx) {
    const list = await ctx.db
      .select({ id: tools.id, slug: tools.slug, name: tools.name, aliases: tools.aliases, websiteUrl: tools.websiteUrl })
      .from(tools)
      .where(eq(tools.published, true));
    const pairs = duplicatePairs(list).slice(0, ctx.limits.maxItems);
    const bySlug = new Map(list.map((t) => [t.id, t]));
    for (const p of pairs) {
      const a = bySlug.get(p.a)!;
      const b = bySlug.get(p.b)!;
      await ctx.inbox.escalate({
        kind: 'duplicate',
        severity: 'p3',
        category: 'data',
        toolId: a.id,
        title: `Possible duplicate: ${a.name} / ${b.name} (${p.reason})`,
        reasonCode: p.reason,
        payload: { tools: [a.slug, b.slug], reason: p.reason },
        defaultAction: 'expire_p3',
        dedupeKey: `duplicate:${a.id}:${b.id}`,
        createdBy: 'agent:duplicate',
      });
    }
    ctx.stat('pairs', pairs.length);
    return { status: 'success', summary: `${list.length} tools compared · ${pairs.length} possible duplicates` };
  },
};
