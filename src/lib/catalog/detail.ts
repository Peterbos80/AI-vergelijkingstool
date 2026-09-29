/**
 * Per-tool provenance for the receipts drawer, the price Time Machine and the
 * change timeline. Cached per (data_version, tool) in memory.
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { changeEvents, facts, pricingPlans, sources, videos, type FactMethod, type FactStatus, type SourceType } from '@/lib/db/schema';
import { getCatalog } from './index';
import type { CatalogEvent } from './types';

export interface SourceRef {
  id: string;
  url: string;
  domain: string;
  type: SourceType;
  title: string | null;
  publisher: string | null;
  lastFetchedAt: Date | null;
  lastStatus: number | null;
}

export interface Receipt {
  status: FactStatus;
  confidence: number;
  method: FactMethod;
  evidence: string | null;
  observedAt: Date;
  verifiedAt: Date | null;
  note: string | null;
  sources: SourceRef[];
}

export interface FactReceipt extends Receipt {
  key: string;
  value: unknown;
}

export interface PlanHistoryRow {
  planKey: string;
  name: string;
  priceCents: number | null;
  currency: string | null;
  period: string;
  isFree: boolean;
  isCustom: boolean;
  validFrom: Date;
  validTo: Date | null;
  status: FactStatus;
  sourceUrl: string | null;
}

export interface ToolDetail {
  facts: Record<string, FactReceipt>;
  plans: Record<string, Receipt>;
  history: PlanHistoryRow[];
  events: CatalogEvent[];
  videos: {
    videoId: string;
    title: string;
    channelTitle: string | null;
    kind: string;
    publishedAt: Date | null;
    language: string | null;
    source: string;
  }[];
  sources: SourceRef[];
}

const cache = new Map<string, ToolDetail>();
const MAX = 200;

export async function getToolDetail(toolId: string): Promise<ToolDetail> {
  const catalog = await getCatalog();
  const key = `${catalog.version}:${toolId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const db = getDb();

  const [factRows, planRows, eventRows, videoRows, sourceRows] = await Promise.all([
    db.select().from(facts).where(and(eq(facts.toolId, toolId), eq(facts.reviewStatus, 'published'))),
    db
      .select()
      .from(pricingPlans)
      .where(and(eq(pricingPlans.toolId, toolId), eq(pricingPlans.reviewStatus, 'published')))
      .orderBy(asc(pricingPlans.position), desc(pricingPlans.validFrom)),
    db
      .select()
      .from(changeEvents)
      .where(and(eq(changeEvents.toolId, toolId), eq(changeEvents.status, 'published')))
      .orderBy(desc(changeEvents.detectedAt))
      .limit(50),
    db
      .select()
      .from(videos)
      .where(and(eq(videos.toolId, toolId), eq(videos.status, 'active')))
      .orderBy(desc(videos.relevance))
      .limit(6),
    db.select().from(sources).where(eq(sources.toolId, toolId)),
  ]);

  // Resolve every referenced source id (including shared sources of other tools).
  const ids = new Set<string>();
  for (const r of [...factRows, ...planRows]) {
    if (r.sourceId) ids.add(r.sourceId);
    for (const x of r.extraSourceIds) ids.add(x);
  }
  const extra = ids.size ? await db.select().from(sources).where(inArray(sources.id, [...ids])) : [];
  const byId = new Map([...sourceRows, ...extra].map((s) => [s.id, s]));
  const ref = (id: string): SourceRef | null => {
    const s = byId.get(id);
    return s
      ? {
          id: s.id,
          url: s.url,
          domain: s.domain,
          type: s.sourceType,
          title: s.title,
          publisher: s.publisher,
          lastFetchedAt: s.lastFetchedAt,
          lastStatus: s.lastStatus,
        }
      : null;
  };
  const refs = (primary: string | null, extras: string[]) =>
    [primary, ...extras].filter((x): x is string => Boolean(x)).map(ref).filter((x): x is SourceRef => x !== null);

  const factMap: Record<string, FactReceipt> = {};
  for (const f of factRows.filter((x) => x.validTo === null)) {
    factMap[f.key] = {
      key: f.key,
      value: f.value,
      status: f.status,
      confidence: f.confidence,
      method: f.method,
      evidence: f.evidence,
      observedAt: f.observedAt,
      verifiedAt: f.verifiedAt,
      note: f.note,
      sources: refs(f.sourceId, f.extraSourceIds),
    };
  }
  const planMap: Record<string, Receipt> = {};
  for (const p of planRows.filter((x) => x.validTo === null)) {
    planMap[p.planKey] = {
      status: p.status,
      confidence: p.confidence,
      method: p.method,
      evidence: p.evidence,
      observedAt: p.observedAt,
      verifiedAt: p.verifiedAt,
      note: null,
      sources: refs(p.sourceId, p.extraSourceIds),
    };
  }

  const detail: ToolDetail = {
    facts: factMap,
    plans: planMap,
    history: planRows.map((p) => ({
      planKey: p.planKey,
      name: p.name,
      priceCents: p.priceCents,
      currency: p.currency,
      period: p.billingPeriod,
      isFree: p.isFree,
      isCustom: p.isCustom,
      validFrom: p.validFrom,
      validTo: p.validTo,
      status: p.status,
      sourceUrl: p.sourceId ? (byId.get(p.sourceId)?.url ?? null) : null,
    })),
    events: eventRows.map((e) => ({
      id: e.id,
      toolId: e.toolId,
      kind: e.kind,
      title: e.title,
      summary: e.summary,
      sourceUrl: e.sourceUrl,
      sourceType: e.sourceType,
      occurredAt: e.occurredAt,
      occurredPrecision: e.occurredPrecision,
      detectedAt: e.detectedAt,
      confidence: e.confidence,
      significance: e.significance,
      oldValue: e.oldValue,
      newValue: e.newValue,
    })),
    videos: videoRows.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelTitle: v.channelTitle,
      kind: v.kind,
      publishedAt: v.publishedAt,
      language: v.language,
      source: v.source,
    })),
    sources: sourceRows
      .map((s) => ref(s.id))
      .filter((x): x is SourceRef => x !== null)
      .sort((a, b) => a.type.localeCompare(b.type)),
  };
  if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, detail);
  return detail;
}
