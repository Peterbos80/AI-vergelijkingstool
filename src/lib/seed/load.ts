/**
 * Loads and validates seed data from /data.
 *
 * - data/taxonomy.json   categories, capabilities, tasks (editorial)
 * - data/tools/*.json    one file per tool, with provenance per value
 * - data/events/*.json   sourced Pulse events
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  eventSeed,
  type factSeed,
  type planSeed,
  taxonomySeed,
  toolSeed,
  type EventSeed,
  type FactKey,
  type PricingEvidenceSeed,
  type TaxonomySeed,
  type ToolSeed,
} from './schema';
import { z } from 'zod';

type Provenanced = {
  status?: string;
  sources?: unknown[];
  observed?: string;
  method?: string;
  evidence?: string;
};

export interface ResolvedProvenance {
  status: 'verified' | 'supported' | 'community' | 'unverified';
  sources: { url: string; type: string; title?: string; publisher?: string }[];
  observed: string;
  method: 'editorial' | 'agent' | 'web_search' | 'llm_extraction' | 'vendor_submission' | 'import';
  evidence?: string;
  note?: string;
}

export type ResolvedPlan = z.infer<typeof planSeed> & ResolvedProvenance;
export type ResolvedFact = z.infer<typeof factSeed> & ResolvedProvenance;
export type ResolvedTool = Omit<ToolSeed, 'plans' | 'facts'> & {
  plans: ResolvedPlan[];
  facts: Partial<Record<FactKey, ResolvedFact>>;
};

export class SeedError extends Error {}

function resolve<T extends Provenanced>(item: T, fallback: PricingEvidenceSeed | undefined, where: string): T & ResolvedProvenance {
  const merged = {
    ...item,
    status: item.status ?? fallback?.status,
    sources: item.sources ?? fallback?.sources,
    observed: item.observed ?? fallback?.observed,
    method: item.method ?? fallback?.method ?? 'web_search',
    evidence: item.evidence ?? fallback?.evidence,
  };
  if (!merged.status || !merged.sources || merged.sources.length === 0 || !merged.observed) {
    throw new SeedError(`${where}: missing provenance (status/sources/observed) and no pricingEvidence to inherit from`);
  }
  return merged as T & ResolvedProvenance;
}

export function resolveTool(seed: ToolSeed): ResolvedTool {
  const plans = seed.plans.map((p) => resolve(p, seed.pricingEvidence, `${seed.slug}.plans.${p.key}`) as ResolvedPlan);
  const facts: Partial<Record<FactKey, ResolvedFact>> = {};
  for (const [key, fact] of Object.entries(seed.facts) as [FactKey, z.infer<typeof factSeed>][]) {
    facts[key] = resolve(fact, seed.pricingEvidence, `${seed.slug}.facts.${key}`) as ResolvedFact;
  }
  return { ...seed, plans, facts };
}

export interface SeedBundle {
  taxonomy: TaxonomySeed;
  tools: ResolvedTool[];
  events: EventSeed[];
  warnings: string[];
}

export function loadSeedData(dataDir = path.join(process.cwd(), 'data')): SeedBundle {
  const warnings: string[] = [];
  const taxonomy = taxonomySeed.parse(JSON.parse(readFileSync(path.join(dataDir, 'taxonomy.json'), 'utf8')));

  const categoryIds = new Set(taxonomy.categories.map((c) => c.id));
  const capabilityIds = new Set(taxonomy.capabilities.map((c) => c.id));
  for (const cap of taxonomy.capabilities) {
    if (!categoryIds.has(cap.category)) throw new SeedError(`capability ${cap.id}: unknown category ${cap.category}`);
  }
  for (const task of taxonomy.tasks) {
    if (!categoryIds.has(task.category)) throw new SeedError(`task ${task.id}: unknown category ${task.category}`);
    for (const step of task.steps) {
      for (const c of step.capabilities) {
        if (!capabilityIds.has(c)) throw new SeedError(`task ${task.id}.${step.key}: unknown capability ${c}`);
      }
    }
  }

  const toolDir = path.join(dataDir, 'tools');
  const tools: ResolvedTool[] = [];
  const slugs = new Set<string>();
  for (const file of readdirSync(toolDir).filter((f) => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(path.join(toolDir, file), 'utf8'));
    const parsed = toolSeed.safeParse(raw);
    if (!parsed.success) {
      throw new SeedError(`${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    const tool = resolveTool(parsed.data);
    if (`${tool.slug}.json` !== file) throw new SeedError(`${file}: slug "${tool.slug}" must match file name`);
    if (slugs.has(tool.slug)) throw new SeedError(`duplicate slug ${tool.slug}`);
    slugs.add(tool.slug);
    for (const c of tool.capabilities) {
      if (!capabilityIds.has(c.id)) throw new SeedError(`${tool.slug}: unknown capability ${c.id}`);
    }
    if (!tool.capabilities.some((c) => c.strength === 'primary')) {
      throw new SeedError(`${tool.slug}: needs at least one primary capability`);
    }
    tools.push(tool);
  }
  for (const tool of tools) {
    for (const rel of tool.relations) {
      if (!slugs.has(rel.tool)) warnings.push(`${tool.slug}: relation to unknown tool "${rel.tool}" (skipped)`);
    }
  }

  const events: EventSeed[] = [];
  const eventsDir = path.join(dataDir, 'events');
  if (existsSync(eventsDir)) {
    for (const file of readdirSync(eventsDir).filter((f) => f.endsWith('.json')).sort()) {
      const list = z.array(eventSeed).parse(JSON.parse(readFileSync(path.join(eventsDir, file), 'utf8')));
      for (const ev of list) {
        if (ev.tool && !slugs.has(ev.tool)) warnings.push(`event "${ev.title.en}": unknown tool ${ev.tool}`);
        events.push(ev);
      }
    }
  }

  // Coverage check: every required task step should have ≥ 2 candidate tools.
  for (const task of taxonomy.tasks) {
    for (const step of task.steps.filter((s) => s.required)) {
      const candidates = tools.filter((t) => t.published && t.capabilities.some((c) => step.capabilities.includes(c.id)));
      if (candidates.length < 2) {
        warnings.push(`task ${task.id}.${step.key}: only ${candidates.length} candidate tool(s)`);
      }
    }
  }

  return { taxonomy, tools, events, warnings };
}
