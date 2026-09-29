/**
 * Data quality score and indexability gates (docs/strategy/05 §SEO gates,
 * docs/strategy/12 C4). A page is only indexable when it carries enough
 * unique, sourced data — thin pages stay `noindex` automatically.
 */
import type { FactStatus, Freshness, ToolStatus } from '@/lib/db/schema';

export interface QualityInput {
  published: boolean;
  status: ToolStatus;
  locales: string[];
  planCount: number;
  /** Lowest status among current pricing plans (null = no plans). */
  pricingStatus: FactStatus | null;
  primaryCapabilities: number;
  alternatives: number;
  freshness: Freshness;
  websiteStatus: 'up' | 'down' | 'unknown';
  confidence: number;
}

export type QualityIssue =
  | 'unpublished'
  | 'missing_nl'
  | 'missing_en'
  | 'no_plans'
  | 'pricing_unverified'
  | 'no_primary_capability'
  | 'few_alternatives'
  | 'stale'
  | 'website_down'
  | 'low_confidence'
  | 'discontinued';

export interface QualityResult {
  score: number;
  issues: QualityIssue[];
  indexable: { tool: boolean; pricing: boolean; alternatives: boolean };
}

const WEIGHTS: Record<QualityIssue, number> = {
  unpublished: 0,
  missing_nl: 20,
  missing_en: 20,
  no_plans: 20,
  pricing_unverified: 10,
  no_primary_capability: 25,
  few_alternatives: 5,
  stale: 15,
  website_down: 15,
  low_confidence: 10,
  discontinued: 0,
};

export function computeQuality(q: QualityInput): QualityResult {
  const issues: QualityIssue[] = [];
  if (!q.published) issues.push('unpublished');
  if (!q.locales.includes('nl')) issues.push('missing_nl');
  if (!q.locales.includes('en')) issues.push('missing_en');
  if (q.planCount === 0) issues.push('no_plans');
  if (q.pricingStatus === 'unverified' || q.pricingStatus === 'community') issues.push('pricing_unverified');
  if (q.primaryCapabilities === 0) issues.push('no_primary_capability');
  if (q.alternatives < 3) issues.push('few_alternatives');
  if (q.freshness === 'stale') issues.push('stale');
  if (q.websiteStatus === 'down') issues.push('website_down');
  if (q.confidence < 40) issues.push('low_confidence');
  if (q.status === 'shutdown' || q.status === 'deprecated') issues.push('discontinued');

  const score = Math.max(0, 100 - issues.reduce((sum, i) => sum + WEIGHTS[i], 0));
  const live = q.published && q.status !== 'shutdown';
  const hasText = q.locales.includes('nl') || q.locales.includes('en');
  const tool = live && hasText && q.primaryCapabilities > 0 && score >= 60;
  const pricing =
    tool && q.planCount > 0 && q.pricingStatus !== null && q.pricingStatus !== 'unverified' && q.freshness !== 'stale';
  const alternatives = tool && q.alternatives >= 3;
  return { score, issues, indexable: { tool, pricing, alternatives } };
}
