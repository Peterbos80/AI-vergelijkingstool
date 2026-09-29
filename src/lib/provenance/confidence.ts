/**
 * Evidence-based confidence (docs/strategy/08-agent-architecture.md §4).
 *
 *   confidence = clamp(base(best source) × anchor × recency × method
 *                      + corroboration − penalties, 0, 1) × 100
 *
 * A model's self-reported confidence is never an input.
 */
import type { FactMethod, FactStatus, SourceType } from '@/lib/db/schema';

export const SOURCE_BASE: Record<SourceType, number> = {
  official: 0.95,
  official_docs: 0.92,
  official_blog: 0.92,
  changelog: 0.9,
  api: 0.9,
  github: 0.85,
  media: 0.7,
  secondary: 0.62,
  video: 0.6,
  community: 0.45,
  social: 0.35,
};

export const OFFICIAL_SOURCE_TYPES: ReadonlySet<SourceType> = new Set<SourceType>([
  'official',
  'official_docs',
  'official_blog',
  'changelog',
  'api',
]);

export type Anchor = 'verbatim' | 'fuzzy' | 'none';

const ANCHOR_FACTOR: Record<Anchor, number> = { verbatim: 1, fuzzy: 0.9, none: 0.6 };

export const METHOD_FACTOR: Record<FactMethod, number> = {
  agent: 1,
  editorial: 1,
  import: 1,
  llm_extraction: 0.95,
  web_search: 0.9,
  vendor_submission: 0.85,
};

export function recencyFactor(ageDays: number): number {
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.97;
  if (ageDays <= 90) return 0.9;
  return 0.8;
}

export interface ConfidenceInput {
  /** Types of all sources that support the value. */
  sourceTypes: readonly SourceType[];
  /** Was the evidence snippet found on the (best) source page? */
  anchor: Anchor;
  observedAt: Date;
  now?: Date;
  method: FactMethod;
  /** Independent sources (distinct domains) that agree, including the best one. */
  independentSources?: number;
  /** A sanity check failed (negative price, impossible jump, unknown currency…). */
  sanityFailed?: boolean;
}

const DAY_MS = 86_400_000;

export function computeConfidence(input: ConfidenceInput): number {
  if (input.sourceTypes.length === 0) return 0;
  const now = input.now ?? new Date();
  const base = Math.max(...input.sourceTypes.map((t) => SOURCE_BASE[t]));
  const ageDays = Math.max(0, (now.getTime() - input.observedAt.getTime()) / DAY_MS);
  const independent = input.independentSources ?? input.sourceTypes.length;
  const corroboration = Math.min(0.08, Math.max(0, independent - 1) * 0.04);
  let value = base * ANCHOR_FACTOR[input.anchor] * recencyFactor(ageDays) * METHOD_FACTOR[input.method] + corroboration;
  if (input.sanityFailed) value = Math.min(value, 0.4);
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

const STATUS_RANK: Record<FactStatus, number> = { unverified: 0, community: 1, supported: 2, verified: 3 };

/**
 * The highest status the evidence allows (§4 status table). Seed data and
 * agents may claim a lower status, never a higher one.
 */
export function maxStatus(input: {
  sourceTypes: readonly SourceType[];
  anchor: Anchor;
  confidence: number;
  independentSources?: number;
}): FactStatus {
  const hasOfficial = input.sourceTypes.some((t) => OFFICIAL_SOURCE_TYPES.has(t));
  if (hasOfficial && input.anchor === 'verbatim' && input.confidence >= 90) return 'verified';
  const nonCommunity = input.sourceTypes.filter((t) => t !== 'community' && t !== 'social');
  const independent = input.independentSources ?? input.sourceTypes.length;
  if (hasOfficial || (nonCommunity.length >= 2 && independent >= 2)) return 'supported';
  if (input.sourceTypes.length > 0 && nonCommunity.length === 0) return 'community';
  return 'unverified';
}

export function clampStatus(claimed: FactStatus, ceiling: FactStatus): FactStatus {
  return STATUS_RANK[claimed] <= STATUS_RANK[ceiling] ? claimed : ceiling;
}

export function statusRank(status: FactStatus): number {
  return STATUS_RANK[status];
}

/** Registrable-ish domain used to count independent sources. */
export function sourceDomain(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.');
    // Keep the last two labels, or three for common second-level suffixes.
    const twoLevel = new Set(['co.uk', 'com.au', 'co.jp', 'com.br', 'co.nz', 'co.za']);
    const lastTwo = parts.slice(-2).join('.');
    if (parts.length >= 3 && twoLevel.has(lastTwo)) return parts.slice(-3).join('.');
    return lastTwo;
  } catch {
    return url;
  }
}

export function countIndependent(urls: readonly string[]): number {
  return new Set(urls.map(sourceDomain)).size;
}
