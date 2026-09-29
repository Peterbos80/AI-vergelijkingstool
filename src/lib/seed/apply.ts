/**
 * Apply validated seed data to the database.
 *
 * Semantics ("sync", safe to re-run):
 *  - Taxonomy is editorial: categories, capabilities and tasks are upserted.
 *  - Tools are inserted when their slug does not exist yet. Existing tools are
 *    left alone: after the initial seed, agents own the data and its history.
 *  - Events are inserted once (dedupe key).
 *  - Computed alternatives and all tool snapshots are recomputed.
 *
 * Provenance rules: a seed status is clamped to what the evidence allows
 * (never VERIFIED without verbatim anchoring on an official source), and the
 * confidence is computed from the evidence, not taken from the seed.
 */
import { and, eq, notInArray, sql } from 'drizzle-orm';
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
  pricingPlans,
  sources,
  taskI18n,
  tasks,
  taskStepI18n,
  taskSteps,
  toolCapabilities,
  toolI18n,
  toolRelations,
  tools,
  type FactStatus,
  type SourceType,
} from '@/lib/db/schema';
import { clampStatus, computeConfidence, countIndependent, maxStatus, SOURCE_BASE } from '@/lib/provenance/confidence';
import { recomputeToolSnapshot } from '@/lib/provenance/snapshot';
import { monthlyEquivalentCents, toCents } from '@/lib/pricing/money';
import { computeAlternatives } from '@/lib/engine/alternatives';
import { bumpDataVersion, loadSettings } from '@/lib/settings';
import type { ResolvedProvenance, ResolvedTool, SeedBundle } from './load';
import type { SourceRef } from './schema';

export interface SeedReport {
  categories: number;
  capabilities: number;
  tasks: number;
  toolsInserted: number;
  toolsSkipped: number;
  facts: number;
  plans: number;
  historyRows: number;
  sources: number;
  events: number;
  relations: number;
  computedAlternatives: number;
  statusClamped: number;
  dataVersion: number;
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

function hostOf(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
}

type Tx = Database;

class SourceRegistry {
  private cache = new Map<string, string>();
  count = 0;
  constructor(private readonly db: Tx) {}

  async ensure(
    ref: { url: string; type: SourceType; title?: string; publisher?: string },
    toolId: string | null,
    role: 'pricing' | 'website' | 'changelog' | 'rss' | 'docs' | 'reference' | 'other',
  ): Promise<string> {
    const hit = this.cache.get(ref.url);
    if (hit) return hit;
    const inserted = await this.db
      .insert(sources)
      .values({
        url: ref.url,
        domain: hostOf(ref.url),
        sourceType: ref.type,
        title: ref.title ?? null,
        publisher: ref.publisher ?? null,
        toolId,
        role,
        checkIntervalHours: role === 'pricing' ? 24 : role === 'website' ? 6 : 24,
      })
      .onConflictDoNothing({ target: sources.url })
      .returning({ id: sources.id });
    let id = inserted[0]?.id;
    if (!id) {
      const [row] = await this.db.select({ id: sources.id }).from(sources).where(eq(sources.url, ref.url)).limit(1);
      id = row!.id;
    } else {
      this.count++;
    }
    this.cache.set(ref.url, id);
    return id;
  }
}

interface Evidence {
  status: FactStatus;
  confidence: number;
  sourceId: string | null;
  extraSourceIds: string[];
  evidence: string | null;
  method: ResolvedProvenance['method'];
  observedAt: Date;
  clamped: boolean;
}

async function evidenceFor(
  reg: SourceRegistry,
  prov: Pick<ResolvedProvenance, 'status' | 'sources' | 'observed' | 'method' | 'evidence'>,
  toolId: string | null,
  role: 'pricing' | 'reference',
  now: Date,
): Promise<Evidence> {
  const refs = prov.sources as SourceRef[];
  // Best source first (highest base weight).
  const ordered = [...refs].sort((a, b) => SOURCE_BASE[b.type] - SOURCE_BASE[a.type]);
  const ids: string[] = [];
  for (const ref of ordered) ids.push(await reg.ensure(ref, toolId, ref.type === 'official' ? role : 'reference'));
  const types = ordered.map((r) => r.type);
  const independent = countIndependent(ordered.map((r) => r.url));
  const observedAt = day(prov.observed);
  // Seed evidence was not re-read on the page by our fetcher: not anchored.
  const confidence = computeConfidence({
    sourceTypes: types,
    anchor: 'none',
    observedAt,
    now,
    method: prov.method,
    independentSources: independent,
  });
  const ceiling = maxStatus({ sourceTypes: types, anchor: 'none', confidence, independentSources: independent });
  const status = clampStatus(prov.status, ceiling);
  return {
    status,
    confidence,
    sourceId: ids[0] ?? null,
    extraSourceIds: ids.slice(1),
    evidence: prov.evidence ?? null,
    method: prov.method,
    observedAt,
    clamped: status !== prov.status,
  };
}

async function syncTaxonomy(db: Tx, bundle: SeedBundle) {
  const { taxonomy } = bundle;
  let pos = 0;
  for (const c of taxonomy.categories) {
    await db
      .insert(categories)
      .values({ id: c.id, icon: c.icon, position: pos })
      .onConflictDoUpdate({ target: categories.id, set: { icon: c.icon, position: pos } });
    pos++;
    await db.delete(categoryI18n).where(eq(categoryI18n.categoryId, c.id));
    const rows = Object.entries(c.i18n).map(([locale, t]) => ({
      categoryId: c.id,
      locale,
      name: t.name,
      slug: t.slug,
      description: t.description ?? null,
    }));
    if (rows.length) await db.insert(categoryI18n).values(rows);
  }
  pos = 0;
  for (const cap of taxonomy.capabilities) {
    await db
      .insert(capabilities)
      .values({ id: cap.id, categoryId: cap.category, position: pos })
      .onConflictDoUpdate({ target: capabilities.id, set: { categoryId: cap.category, position: pos } });
    pos++;
    await db.delete(capabilityI18n).where(eq(capabilityI18n.capabilityId, cap.id));
    const rows = Object.entries(cap.i18n).map(([locale, t]) => ({
      capabilityId: cap.id,
      locale,
      name: t.name,
      slug: t.slug,
      description: t.description ?? null,
      synonyms: t.synonyms,
    }));
    if (rows.length) await db.insert(capabilityI18n).values(rows);
  }
  pos = 0;
  for (const task of taxonomy.tasks) {
    await db
      .insert(tasks)
      .values({ id: task.id, categoryId: task.category, position: pos, status: 'published' })
      .onConflictDoUpdate({ target: tasks.id, set: { categoryId: task.category, position: pos } });
    pos++;
    await db.delete(taskI18n).where(eq(taskI18n.taskId, task.id));
    await db.insert(taskI18n).values(
      Object.entries(task.i18n).map(([locale, t]) => ({
        taskId: task.id,
        locale,
        title: t.title,
        slug: t.slug,
        summary: t.summary,
        intentPhrases: t.intentPhrases,
      })),
    );
    const keys = task.steps.map((s) => s.key);
    await db.delete(taskSteps).where(and(eq(taskSteps.taskId, task.id), notInArray(taskSteps.key, keys)));
    let stepPos = 0;
    for (const step of task.steps) {
      const [row] = await db
        .insert(taskSteps)
        .values({
          taskId: task.id,
          key: step.key,
          position: stepPos,
          capabilityIds: step.capabilities,
          required: step.required,
        })
        .onConflictDoUpdate({
          target: [taskSteps.taskId, taskSteps.key],
          set: { position: stepPos, capabilityIds: step.capabilities, required: step.required },
        })
        .returning({ id: taskSteps.id });
      stepPos++;
      await db.delete(taskStepI18n).where(eq(taskStepI18n.stepId, row!.id));
      await db.insert(taskStepI18n).values(
        Object.entries(step.i18n).map(([locale, t]) => ({
          stepId: row!.id,
          locale,
          label: t.label,
          hint: t.hint ?? null,
        })),
      );
    }
  }
}

async function insertTool(db: Tx, reg: SourceRegistry, tool: ResolvedTool, now: Date, report: SeedReport) {
  const [company] = await db
    .insert(companies)
    .values({
      slug: tool.company.slug,
      name: tool.company.name,
      country: tool.company.country ?? null,
      website: tool.company.website ?? null,
    })
    .onConflictDoUpdate({ target: companies.slug, set: { name: tool.company.name } })
    .returning({ id: companies.id });

  const [row] = await db
    .insert(tools)
    .values({
      slug: tool.slug,
      name: tool.name,
      aliases: tool.aliases,
      websiteUrl: tool.website,
      pricingUrl: tool.pricingUrl ?? null,
      changelogUrl: tool.changelogUrl ?? null,
      rssUrl: tool.rssUrl ?? null,
      githubRepo: tool.githubRepo ?? null,
      youtubeChannelId: tool.youtubeChannelId ?? null,
      companyId: company!.id,
      published: tool.published,
      launchYear: tool.launchYear ?? null,
      skillLevel: tool.skillLevel,
      audience: tool.audience,
    })
    .returning({ id: tools.id });
  const toolId = row!.id;

  // Monitoring targets for agents (official pages), even when not cited as evidence.
  await reg.ensure({ url: tool.website, type: 'official', title: `${tool.name} website` }, toolId, 'website');
  if (tool.pricingUrl) await reg.ensure({ url: tool.pricingUrl, type: 'official', title: `${tool.name} pricing` }, toolId, 'pricing');
  if (tool.changelogUrl) await reg.ensure({ url: tool.changelogUrl, type: 'changelog' }, toolId, 'changelog');
  if (tool.rssUrl) await reg.ensure({ url: tool.rssUrl, type: 'changelog' }, toolId, 'rss');

  for (const [locale, text] of Object.entries(tool.i18n)) {
    if (!text) continue;
    await db.insert(toolI18n).values({
      toolId,
      locale,
      tagline: text.tagline,
      description: text.description,
      bestFor: text.bestFor,
      notFor: text.notFor,
      limitations: text.limitations,
      contentStatus: 'editorial',
    });
  }
  await db
    .insert(toolCapabilities)
    .values(tool.capabilities.map((c) => ({ toolId, capabilityId: c.id, strength: c.strength })));

  for (const [key, fact] of Object.entries(tool.facts)) {
    if (!fact) continue;
    const ev = await evidenceFor(reg, fact, toolId, 'reference', now);
    if (ev.clamped) report.statusClamped++;
    await db.insert(facts).values({
      toolId,
      key,
      value: fact.value as never,
      status: ev.status,
      confidence: ev.confidence,
      sourceId: ev.sourceId,
      extraSourceIds: ev.extraSourceIds,
      evidence: ev.evidence,
      method: ev.method,
      observedAt: ev.observedAt,
      verifiedAt: ev.status === 'verified' ? ev.observedAt : null,
      validFrom: ev.observedAt,
      createdBy: 'seed',
      note: fact.note ?? null,
    });
    report.facts++;
  }

  let position = 0;
  for (const plan of tool.plans) {
    const ev = await evidenceFor(reg, plan, toolId, 'pricing', now);
    if (ev.clamped) report.statusClamped++;
    const priceCents = toCents(plan.price);
    const previous = [...plan.previous].sort((a, b) => a.validTo.localeCompare(b.validTo));
    // The current row is effective from the last known transition, else from the observation.
    const currentFrom = previous.length ? day(previous[previous.length - 1]!.validTo) : ev.observedAt;
    await db.insert(pricingPlans).values({
      toolId,
      planKey: plan.key,
      name: plan.name,
      position,
      priceCents,
      currency: plan.currency,
      billingPeriod: plan.period,
      priceUnit: plan.unit,
      monthlyEquivalentCents: monthlyEquivalentCents(priceCents, plan.period),
      annualMonthlyCents: toCents(plan.annualMonthly ?? null),
      isFree: plan.isFree,
      isCustom: plan.isCustom,
      quota: plan.quota ?? null,
      status: ev.status,
      confidence: ev.confidence,
      sourceId: ev.sourceId,
      extraSourceIds: ev.extraSourceIds,
      evidence: ev.evidence,
      method: ev.method,
      observedAt: ev.observedAt,
      verifiedAt: ev.status === 'verified' ? ev.observedAt : null,
      validFrom: currentFrom,
      createdBy: 'seed',
    });
    report.plans++;

    for (const prev of previous) {
      const pev = await evidenceFor(reg, prev, toolId, 'pricing', now);
      const prevCents = toCents(prev.price);
      // Start of a historical price is unknown in the seed: valid_from = valid_to
      // marks "valid until" only (rendered without a start date).
      await db.insert(pricingPlans).values({
        toolId,
        planKey: plan.key,
        name: plan.name,
        position,
        priceCents: prevCents,
        currency: prev.currency,
        billingPeriod: plan.period,
        priceUnit: plan.unit,
        monthlyEquivalentCents: monthlyEquivalentCents(prevCents, plan.period),
        annualMonthlyCents: toCents(prev.annualMonthly ?? null),
        isFree: prevCents === 0,
        isCustom: false,
        quota: prev.quota ?? null,
        status: pev.status,
        confidence: pev.confidence,
        sourceId: pev.sourceId,
        extraSourceIds: pev.extraSourceIds,
        evidence: pev.evidence,
        method: pev.method,
        observedAt: pev.observedAt,
        verifiedAt: null,
        validFrom: day(prev.validTo),
        validTo: day(prev.validTo),
        createdBy: 'seed',
      });
      report.historyRows++;
    }
    position++;
  }
  return toolId;
}

export async function applySeed(db: Database, bundle: SeedBundle, now: Date = new Date()): Promise<SeedReport> {
  const report: SeedReport = {
    categories: bundle.taxonomy.categories.length,
    capabilities: bundle.taxonomy.capabilities.length,
    tasks: bundle.taxonomy.tasks.length,
    toolsInserted: 0,
    toolsSkipped: 0,
    facts: 0,
    plans: 0,
    historyRows: 0,
    sources: 0,
    events: 0,
    relations: 0,
    computedAlternatives: 0,
    statusClamped: 0,
    dataVersion: 0,
  };

  await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Tx;
    const reg = new SourceRegistry(tx);
    await syncTaxonomy(tx, bundle);

    const existing = new Map(
      (await tx.select({ id: tools.id, slug: tools.slug }).from(tools)).map((r) => [r.slug, r.id] as const),
    );
    for (const tool of bundle.tools) {
      if (existing.has(tool.slug)) {
        report.toolsSkipped++;
        continue;
      }
      const id = await insertTool(tx, reg, tool, now, report);
      existing.set(tool.slug, id);
      report.toolsInserted++;
    }

    // Editorial relations (alternatives are symmetric).
    for (const tool of bundle.tools) {
      const from = existing.get(tool.slug)!;
      for (const rel of tool.relations) {
        const to = existing.get(rel.tool);
        if (!to) continue;
        const pairs = rel.kind === 'alternative' ? [[from, to], [to, from]] : [[from, to]];
        for (const [a, b] of pairs) {
          const res = await tx
            .insert(toolRelations)
            .values({ toolId: a!, relatedToolId: b!, kind: rel.kind, source: 'editorial' })
            .onConflictDoNothing()
            .returning({ id: toolRelations.id });
          report.relations += res.length;
        }
      }
    }

    // Snapshots first, so computed alternatives see current statuses (e.g. shutdown).
    const settings = await loadSettings(tx);
    for (const id of existing.values()) await recomputeToolSnapshot(tx, id, settings.freshness, now);

    // Computed alternatives from capability overlap (same engine as the Recommendation agent).
    const capRows = await tx
      .select({ toolId: toolCapabilities.toolId, id: toolCapabilities.capabilityId, strength: toolCapabilities.strength })
      .from(toolCapabilities);
    const statusRows = await tx.select({ id: tools.id, status: tools.status, published: tools.published }).from(tools);
    const profiles = statusRows
      .filter((t) => t.published)
      .map((t) => ({
        id: t.id,
        status: t.status,
        capabilities: capRows.filter((c) => c.toolId === t.id).map((c) => ({ id: c.id, strength: c.strength })),
      }));
    await tx.delete(toolRelations).where(eq(toolRelations.source, 'computed'));
    for (const p of profiles) {
      for (const alt of computeAlternatives(p, profiles)) {
        const res = await tx
          .insert(toolRelations)
          .values({ toolId: p.id, relatedToolId: alt.id, kind: 'alternative', source: 'computed', score: alt.score })
          .onConflictDoNothing()
          .returning({ id: toolRelations.id });
        report.computedAlternatives += res.length;
      }
    }

    // Pulse events.
    for (const ev of bundle.events) {
      const toolId = ev.tool ? (existing.get(ev.tool) ?? null) : null;
      if (ev.tool && !toolId) continue;
      const e = await evidenceFor(reg, { ...ev, method: 'web_search', evidence: undefined }, toolId, 'reference', now);
      const monthOnly = ev.occurred.length === 7;
      const res = await tx
        .insert(changeEvents)
        .values({
          toolId,
          kind: ev.kind,
          title: ev.title,
          summary: ev.summary ?? null,
          sourceId: e.sourceId,
          sourceUrl: (ev.sources[0] as SourceRef).url,
          sourceType: (ev.sources[0] as SourceRef).type,
          occurredAt: day(monthOnly ? `${ev.occurred}-01` : ev.occurred),
          occurredPrecision: monthOnly ? 'month' : 'day',
          detectedAt: day(ev.observed),
          detectedBy: 'seed',
          confidence: e.confidence,
          significance: ev.significance,
          status: 'published',
          dedupeKey: `seed:${ev.tool ?? 'general'}:${ev.kind}:${ev.occurred}:${ev.title.en.slice(0, 60)}`,
        })
        .onConflictDoNothing({ target: changeEvents.dedupeKey })
        .returning({ id: changeEvents.id });
      report.events += res.length;
    }

    // Recompute again: quality and indexability depend on the alternatives count.
    for (const id of existing.values()) await recomputeToolSnapshot(tx, id, settings.freshness, now);
    report.sources = reg.count;
    report.dataVersion = await bumpDataVersion(tx, 'seed');
  });

  return report;
}

/** Remove catalog data only (never analytics, revenue or users). Dev/test helper. */
export async function truncateCatalog(db: Database): Promise<void> {
  await db.execute(sql`TRUNCATE change_events, videos, social_signals, pricing_plans, facts, source_snapshots,
    tool_relations, tool_capabilities, tool_i18n, pending_changes, review_items, tool_candidates, sources RESTART IDENTITY CASCADE`);
  await db.execute(sql`DELETE FROM tools`);
  await db.execute(sql`DELETE FROM companies`);
}

export async function catalogCounts(db: Database) {
  const one = async (table: string) =>
    Number((await queryRows<{ n: string }>(db, sql.raw(`SELECT count(*)::text AS n FROM ${table}`)))[0]?.n ?? 0);
  return {
    tools: await one('tools'),
    facts: await one('facts'),
    plans: await one('pricing_plans'),
    sources: await one('sources'),
    events: await one('change_events'),
    relations: await one('tool_relations'),
  };
}

