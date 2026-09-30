/**
 * Broken Link agent: website reachability. A site is marked "unreachable since
 * <date>" only after ≥ 3 failed checks spanning ≥ 24 h (R1, reversible). If a
 * large share of sites fails in one run, the problem is probably ours (network)
 * → nothing is marked and a dependency item is raised instead.
 */
import { and, eq } from 'drizzle-orm';
import { changeEvents, sources, tools } from '@/lib/db/schema';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import { recordFetch } from '../lib/tool-sources';
import type { AgentDefinition } from '../types';
import { eventText } from '../lib/event-text';

export const brokenLinkAgent: AgentDefinition = {
  name: 'broken-link',
  description: 'Checks tool websites; marks tools unreachable after repeated failures and restores them automatically.',
  schedule: 'every:6h',
  autonomy: 'auto',
  maxItems: 40,
  timeoutMs: 10 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const list = await db
      .select({ tool: tools, source: sources })
      .from(tools)
      .innerJoin(sources, and(eq(sources.toolId, tools.id), eq(sources.role, 'website')))
      .where(eq(tools.published, true));
    const due = list
      .filter(({ source }) => !source.lastFetchedAt || now.getTime() - source.lastFetchedAt.getTime() > 5.5 * 3600_000)
      .sort((a, b) => (a.source.lastFetchedAt?.getTime() ?? 0) - (b.source.lastFetchedAt?.getTime() ?? 0))
      .slice(0, ctx.limits.maxItems);
    const results: { tool: (typeof list)[number]['tool']; source: (typeof list)[number]['source']; ok: boolean; kind?: string }[] = [];
    for (const { tool, source } of due) {
      if (ctx.signal.aborted) break;
      const res = await ctx.fetcher.get(source.url, { accept: 'any', light: true });
      results.push({ tool, source, ok: res.ok || (res.status !== null && res.status < 500 && res.status !== 404 && res.status !== 410), kind: res.errorKind });
    }
    const failing = results.filter((r) => !r.ok);
    // Network sanity: ≥ 50% failures of ≥ 6 checks → our side, do not mark anything.
    if (results.length >= 6 && failing.length / results.length >= 0.5) {
      await ctx.inbox.escalate({
        kind: 'dependency',
        severity: 'p2',
        category: 'technical',
        title: `Outbound network looks broken: ${failing.length}/${results.length} website checks failed`,
        reasonCode: 'network_suspected',
        payload: { sample: failing.slice(0, 10).map((f) => ({ tool: f.tool.slug, kind: f.kind })) },
        defaultAction: 'auto_resolve_when_checks_pass',
        dedupeKey: `dependency:network:${now.toISOString().slice(0, 10)}`,
        createdBy: 'agent:broken-link',
      });
      return { status: 'partial', summary: `network suspected: ${failing.length}/${results.length} failed — no status changes made` };
    }
    let changed = 0;
    for (const r of results) {
      const before = changed;
      const res = { ok: r.ok, url: r.source.url, finalUrl: r.source.url, status: r.ok ? 200 : null, contentType: null, body: '', durationMs: 0, redirects: [], errorKind: r.kind as never, error: r.kind };
      await recordFetch(db, r.source.id, res, undefined, now);
      const [src] = await db.select().from(sources).where(eq(sources.id, r.source.id));
      await db.update(tools).set({ websiteCheckedAt: now }).where(eq(tools.id, r.tool.id));
      if (r.ok && r.tool.websiteStatus !== 'up') {
        await db.update(tools).set({ websiteStatus: 'up', unreachableSince: null }).where(eq(tools.id, r.tool.id));
        await ctx.log.action({
          action: 'website_status',
          toolId: r.tool.id,
          field: 'website_status',
          oldValue: { websiteStatus: r.tool.websiteStatus, unreachableSince: r.tool.unreachableSince?.toISOString() ?? null },
          newValue: { websiteStatus: 'up' },
          sourceUrl: r.source.url,
          decision: 'auto_published',
          reason: 'reachable',
        });
        if (r.tool.websiteStatus === 'down') {
          await db.insert(changeEvents).values({
            toolId: r.tool.id,
            kind: 'website_up',
            title: eventText('websiteUp'),
            sourceUrl: r.source.url,
            sourceType: 'official',
            detectedAt: now,
            occurredAt: now,
            detectedBy: 'agent:broken-link',
            confidence: 95,
            significance: 40,
            dedupeKey: `up:${r.tool.id}:${now.toISOString().slice(0, 13)}`,
          }).onConflictDoNothing({ target: changeEvents.dedupeKey });
        }
        changed++;
      } else if (!r.ok && r.tool.websiteStatus !== 'down' && src && src.failureCount >= 3 && src.failingSince && now.getTime() - src.failingSince.getTime() >= 24 * 3600_000) {
        await db.update(tools).set({ websiteStatus: 'down', unreachableSince: src.failingSince }).where(eq(tools.id, r.tool.id));
        await ctx.log.action({
          action: 'website_status',
          toolId: r.tool.id,
          field: 'website_status',
          oldValue: { websiteStatus: r.tool.websiteStatus, unreachableSince: null },
          newValue: { websiteStatus: 'down', unreachableSince: src.failingSince.toISOString() },
          sourceUrl: r.source.url,
          decision: 'auto_published_flagged',
          reason: `failed ${src.failureCount}x since ${src.failingSince.toISOString()}`,
        });
        await db.insert(changeEvents).values({
          toolId: r.tool.id,
          kind: 'website_down',
          title: eventText('websiteDown'),
          sourceUrl: r.source.url,
          sourceType: 'official',
          detectedAt: now,
          occurredAt: src.failingSince,
          detectedBy: 'agent:broken-link',
          confidence: 90,
          significance: 60,
          dedupeKey: `down:${r.tool.id}:${src.failingSince.toISOString().slice(0, 10)}`,
        }).onConflictDoNothing({ target: changeEvents.dedupeKey });
        await ctx.inbox.escalate({
          kind: 'broken_link',
          severity: 'p3',
          category: 'data',
          toolId: r.tool.id,
          title: `Unreachable: ${r.tool.name}`,
          reasonCode: 'website_down',
          payload: { tool: r.tool.slug, since: src.failingSince.toISOString(), url: r.source.url },
          defaultAction: 'auto_resolve_when_up',
          groupKey: `unreachable:${now.toISOString().slice(0, 10)}`,
          createdBy: 'agent:broken-link',
        });
        changed++;
      }
      if (changed > before) await recomputeToolSnapshot(db, r.tool.id, ctx.settings.freshness, now);
    }
    ctx.stat('checked', results.length);
    ctx.stat('failing', failing.length);
    return { status: 'success', summary: `${results.length} sites checked · ${failing.length} failing · ${changed} status changes`, dataChanged: changed > 0 };
  },
};
