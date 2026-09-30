/**
 * Duplicate agent: flags published tools that look like the same product
 * (same website host, or the same normalised name/alias). Merging is a human
 * decision (R2); the item expires as P3 when ignored.
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
  const byHost = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const t of list) {
    const host = hostOf(t.websiteUrl);
    if (host) {
      const other = byHost.get(host);
      if (other) push(other, t.id, 'same_host');
      else byHost.set(host, t.id);
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
