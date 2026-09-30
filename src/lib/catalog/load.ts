/**
 * Loads the published catalog into memory. At the current scale (~100 tools)
 * the whole read model fits comfortably in memory; heavy per-tool data
 * (provenance drawers, history, videos) is loaded per page in lib/catalog/detail.
 */
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';
import {
  capabilities,
  capabilityI18n,
  categories,
  categoryI18n,
  changeEvents,
  companies,
  facts,
  fxRates,
  pendingChanges,
  pricingPlans,
  taskI18n,
  tasks,
  taskStepI18n,
  taskSteps,
  toolCapabilities,
  toolI18n,
  toolRelations,
  tools,
  type FactStatus,
} from '@/lib/db/schema';
import { isLocale, type Locale } from '@/i18n/config';
import { statusRank } from '@/lib/provenance/confidence';
import type {
  Catalog,
  CatalogCapability,
  CatalogCategory,
  CatalogEvent,
  CatalogPlan,
  CatalogTask,
  CatalogTool,
} from './types';

function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export async function loadCatalog(db: Database, version: number, now: Date = new Date()): Promise<Catalog> {
  const toolRows = await db
    .select({ tool: tools, companyName: companies.name, companyCountry: companies.country })
    .from(tools)
    .leftJoin(companies, eq(companies.id, tools.companyId))
    .where(eq(tools.published, true));
  const ids = toolRows.map((r) => r.tool.id);
  const safeIds = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];

  const [i18nRows, capRows, planRows, factRows, relRows, pendingRows] = await Promise.all([
    db.select().from(toolI18n).where(inArray(toolI18n.toolId, safeIds)),
    db.select().from(toolCapabilities).where(inArray(toolCapabilities.toolId, safeIds)),
    db
      .select()
      .from(pricingPlans)
      .where(
        and(inArray(pricingPlans.toolId, safeIds), isNull(pricingPlans.validTo), eq(pricingPlans.reviewStatus, 'published')),
      ),
    db
      .select()
      .from(facts)
      .where(and(inArray(facts.toolId, safeIds), isNull(facts.validTo), eq(facts.reviewStatus, 'published'))),
    db.select().from(toolRelations).where(inArray(toolRelations.toolId, safeIds)),
    db
      .select({ toolId: pendingChanges.toolId, key: pendingChanges.key })
      .from(pendingChanges)
      .where(and(inArray(pendingChanges.toolId, safeIds), eq(pendingChanges.status, 'pending'))),
  ]);
  const pendingPlans = new Set(pendingRows.filter((r) => r.key.startsWith('plan:')).map((r) => `${r.toolId}|${r.key.slice(5)}`));

  const i18nBy = groupBy(i18nRows, (r) => r.toolId);
  const capsBy = groupBy(capRows, (r) => r.toolId);
  const plansBy = groupBy(planRows, (r) => r.toolId);
  const factsBy = groupBy(factRows, (r) => r.toolId);
  const relBy = groupBy(relRows, (r) => r.toolId);
  const published = new Set(ids);

  const catalogTools: CatalogTool[] = toolRows.map(({ tool: t, companyName, companyCountry }) => {
    const plans: CatalogPlan[] = (plansBy.get(t.id) ?? [])
      .map((p) => ({
        key: p.planKey,
        name: p.name,
        position: p.position,
        priceCents: p.priceCents,
        currency: p.currency,
        period: p.billingPeriod,
        unit: p.priceUnit,
        monthlyCents: p.monthlyEquivalentCents,
        annualMonthlyCents: p.annualMonthlyCents,
        isFree: p.isFree,
        isCustom: p.isCustom,
        quota: p.quota,
        status: p.status,
        confidence: p.confidence,
        observedAt: p.observedAt,
        verifiedAt: p.verifiedAt,
        pendingChange: pendingPlans.has(`${t.id}|${p.planKey}`),
      }))
      .sort((a, b) => a.position - b.position);
    const pricingStatus = plans.reduce<FactStatus | null>(
      (acc, p) => (acc === null || statusRank(p.status) < statusRank(acc) ? p.status : acc),
      null,
    );
    const text: CatalogTool['text'] = {};
    for (const r of i18nBy.get(t.id) ?? []) {
      if (!isLocale(r.locale)) continue;
      text[r.locale] = {
        tagline: r.tagline,
        description: r.description,
        bestFor: r.bestFor,
        notFor: r.notFor,
        limitations: r.limitations,
        contentStatus: r.contentStatus,
      };
    }
    const factMap: CatalogTool['facts'] = {};
    for (const f of factsBy.get(t.id) ?? []) {
      factMap[f.key] = {
        value: f.value,
        status: f.status,
        confidence: f.confidence,
        observedAt: f.observedAt,
        verifiedAt: f.verifiedAt,
      };
    }
    const rels = (relBy.get(t.id) ?? []).filter((r) => published.has(r.relatedToolId));
    const altMap = new Map<string, CatalogTool['alternatives'][number]>();
    for (const r of rels.filter((x) => x.kind === 'alternative')) {
      const prev = altMap.get(r.relatedToolId);
      // Editorial relations win over computed ones; keep the best score.
      if (!prev || (prev.source === 'computed' && r.source !== 'computed')) {
        altMap.set(r.relatedToolId, { id: r.relatedToolId, score: r.score ?? prev?.score ?? null, source: r.source });
      }
    }
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      aliases: t.aliases,
      websiteUrl: t.websiteUrl,
      pricingUrl: t.pricingUrl,
      githubRepo: t.githubRepo,
      companyName: companyName ?? null,
      companyCountry: companyCountry ?? null,
      status: t.status,
      skillLevel: t.skillLevel,
      audience: t.audience,
      platforms: t.platforms,
      pricingModel: t.pricingModel,
      hasFreeTier: t.hasFreeTier,
      hasFreeTrial: t.hasFreeTrial,
      apiAvailable: t.apiAvailable,
      openSource: t.openSource,
      selfHostable: t.selfHostable,
      supportsDutch: t.supportsDutch,
      euDataResidency: t.euDataResidency,
      gdprDpa: t.gdprDpa,
      trainsOnUserData: t.trainsOnUserData ?? null,
      commercialUseFreeTier: t.commercialUseFreeTier,
      watermarkFreeTier: t.watermarkFreeTier,
      modelDependencies: t.modelDependencies,
      entryPriceCents: t.entryPriceCents,
      entryPriceCurrency: t.entryPriceCurrency,
      entryPlanName: t.entryPlanName,
      confidence: t.confidence,
      freshness: t.freshness,
      priceCheckedAt: t.priceCheckedAt,
      lastCheckedAt: t.lastCheckedAt,
      lastChangedAt: t.lastChangedAt,
      websiteStatus: t.websiteStatus,
      unreachableSince: t.unreachableSince,
      quarantineUntil: t.quarantineUntil,
      qualityScore: t.qualityScore,
      indexable: t.indexable,
      text,
      capabilities: (capsBy.get(t.id) ?? [])
        .map((c) => ({ id: c.capabilityId, strength: c.strength }))
        .sort((a, b) => (a.strength === b.strength ? a.id.localeCompare(b.id) : a.strength === 'primary' ? -1 : 1)),
      plans,
      facts: factMap,
      pricingStatus,
      alternatives: [...altMap.values()].sort(
        (a, b) =>
          (a.source === 'editorial' ? 0 : 1) - (b.source === 'editorial' ? 0 : 1) || (b.score ?? 1) - (a.score ?? 1),
      ),
      relations: rels
        .filter((r) => r.kind !== 'alternative')
        .map((r) => ({ id: r.relatedToolId, kind: r.kind as Exclude<typeof r.kind, 'alternative'> })),
    };
  });
  catalogTools.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  // Taxonomy
  const [catRows, catI18nRows, capabilityRows, capI18nRows, taskRows, taskI18nRows, stepRows, stepI18nRows] =
    await Promise.all([
      db.select().from(categories),
      db.select().from(categoryI18n),
      db.select().from(capabilities),
      db.select().from(capabilityI18n),
      db.select().from(tasks).where(eq(tasks.status, 'published')),
      db.select().from(taskI18n),
      db.select().from(taskSteps),
      db.select().from(taskStepI18n),
    ]);

  const catText = groupBy(catI18nRows, (r) => r.categoryId);
  const cats: CatalogCategory[] = catRows
    .map((c) => {
      const text: CatalogCategory['text'] = {};
      for (const r of catText.get(c.id) ?? [])
        if (isLocale(r.locale)) text[r.locale] = { name: r.name, slug: r.slug, description: r.description };
      return { id: c.id, icon: c.icon, position: c.position, text };
    })
    .sort((a, b) => a.position - b.position);

  const capText = groupBy(capI18nRows, (r) => r.capabilityId);
  const caps: CatalogCapability[] = capabilityRows
    .map((c) => {
      const text: CatalogCapability['text'] = {};
      for (const r of capText.get(c.id) ?? [])
        if (isLocale(r.locale))
          text[r.locale] = { name: r.name, slug: r.slug, description: r.description, synonyms: r.synonyms };
      return { id: c.id, categoryId: c.categoryId, position: c.position, text };
    })
    .sort((a, b) => a.position - b.position);

  const taskText = groupBy(taskI18nRows, (r) => r.taskId);
  const stepText = groupBy(stepI18nRows, (r) => r.stepId);
  const stepsBy = groupBy(stepRows, (r) => r.taskId);
  const taskList: CatalogTask[] = taskRows
    .map((t) => {
      const text: CatalogTask['text'] = {};
      for (const r of taskText.get(t.id) ?? [])
        if (isLocale(r.locale))
          text[r.locale] = { title: r.title, slug: r.slug, summary: r.summary, intentPhrases: r.intentPhrases };
      const steps = (stepsBy.get(t.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((s) => {
          const st: CatalogTask['steps'][number]['text'] = {};
          for (const r of stepText.get(s.id) ?? []) if (isLocale(r.locale)) st[r.locale] = { label: r.label, hint: r.hint };
          return { key: s.key, position: s.position, capabilityIds: s.capabilityIds, required: s.required, text: st };
        });
      return { id: t.id, categoryId: t.categoryId, position: t.position, text, steps };
    })
    .sort((a, b) => a.position - b.position);

  // FX: latest ECB day
  const latest = await db.select({ day: sql<string>`max(${fxRates.day})` }).from(fxRates);
  const fxDay = latest[0]?.day ?? null;
  const rates = new Map<string, number>();
  if (fxDay) {
    for (const r of await db.select().from(fxRates).where(eq(fxRates.day, fxDay))) rates.set(r.quote, Number(r.rate));
  }

  // Pulse events (published, last 365 days by detection or occurrence)
  const since = new Date(now.getTime() - 365 * 86_400_000);
  const eventRows = await db
    .select()
    .from(changeEvents)
    .where(and(eq(changeEvents.status, 'published'), gte(changeEvents.detectedAt, since)))
    .orderBy(desc(sql`coalesce(${changeEvents.occurredAt}, ${changeEvents.detectedAt})`))
    .limit(400);
  const events: CatalogEvent[] = eventRows
    .filter((e) => !e.toolId || published.has(e.toolId))
    .map((e) => ({
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
    }));

  // Stats (real counts for the home "proof line")
  const all = [...planRows, ...factRows];
  const supported = all.filter((x) => statusRank(x.status) >= statusRank('supported')).length;
  const cutoff = now.getTime() - 30 * 86_400_000;
  const checked = all.filter((x) => (x.verifiedAt ?? x.observedAt).getTime() >= cutoff).length;
  const srcCount = await queryRows<{ n: string }>(db, sql`SELECT count(*)::text AS n FROM sources`);
  const lastCheck = all.reduce<Date | null>((acc, x) => {
    const d = x.verifiedAt ?? x.observedAt;
    return !acc || d > acc ? d : acc;
  }, null);

  const toolsBySlug = new Map(catalogTools.map((t) => [t.slug, t]));
  const toolsById = new Map(catalogTools.map((t) => [t.id, t]));
  return {
    version,
    loadedAt: now,
    tools: catalogTools,
    toolsBySlug,
    toolsById,
    categories: cats,
    categoriesById: new Map(cats.map((c) => [c.id, c])),
    capabilities: caps,
    capabilitiesById: new Map(caps.map((c) => [c.id, c])),
    tasks: taskList,
    tasksById: new Map(taskList.map((t) => [t.id, t])),
    fx: { day: fxDay, rates },
    events,
    stats: {
      tools: catalogTools.length,
      facts: factRows.length,
      plans: planRows.length,
      sources: Number(srcCount[0]?.n ?? 0),
      supportedShare: all.length ? supported / all.length : 0,
      checked30dShare: all.length ? checked / all.length : 0,
      lastCheckAt: lastCheck,
    },
  };
}

export type { Locale };
