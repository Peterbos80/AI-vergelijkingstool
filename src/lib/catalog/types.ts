import type {
  BillingPeriod,
  ChangeKind,
  FactStatus,
  Freshness,
  PriceUnit,
  PricingModel,
  RelationKind,
  SkillLevel,
  SourceType,
  Strength,
  ToolStatus,
} from '@/lib/db/schema';
import type { Locale } from '@/i18n/config';

export interface CatalogFact {
  value: unknown;
  status: FactStatus;
  confidence: number;
  observedAt: Date;
  verifiedAt: Date | null;
}

export interface CatalogPlan {
  key: string;
  name: string;
  position: number;
  priceCents: number | null;
  currency: string | null;
  period: BillingPeriod;
  unit: PriceUnit;
  monthlyCents: number | null;
  annualMonthlyCents: number | null;
  isFree: boolean;
  isCustom: boolean;
  quota: string | null;
  status: FactStatus;
  confidence: number;
  observedAt: Date;
  verifiedAt: Date | null;
  /** A different price was measured on the official page and is being confirmed (docs/strategy/12 §4.4). */
  pendingChange: boolean;
}

export interface ToolText {
  tagline: string;
  description: string;
  bestFor: string[];
  notFor: string[];
  limitations: string[];
  contentStatus: 'editorial' | 'ai_draft' | 'machine_translated' | 'reviewed';
}

export interface CatalogTool {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  websiteUrl: string;
  pricingUrl: string | null;
  githubRepo: string | null;
  companyName: string | null;
  companyCountry: string | null;
  status: ToolStatus;
  skillLevel: SkillLevel;
  audience: string[];
  platforms: string[];
  pricingModel: PricingModel;
  hasFreeTier: boolean | null;
  hasFreeTrial: boolean | null;
  apiAvailable: boolean | null;
  openSource: boolean | null;
  selfHostable: boolean | null;
  supportsDutch: boolean | null;
  euDataResidency: boolean | null;
  gdprDpa: boolean | null;
  trainsOnUserData: 'no' | 'opt_out' | 'yes' | null;
  commercialUseFreeTier: boolean | null;
  watermarkFreeTier: boolean | null;
  modelDependencies: string[];
  entryPriceCents: number | null;
  entryPriceCurrency: string | null;
  entryPlanName: string | null;
  confidence: number;
  freshness: Freshness;
  priceCheckedAt: Date | null;
  lastCheckedAt: Date | null;
  lastChangedAt: Date | null;
  websiteStatus: 'up' | 'down' | 'unknown';
  unreachableSince: Date | null;
  quarantineUntil: Date | null;
  qualityScore: number;
  indexable: { tool: boolean; pricing: boolean; alternatives: boolean };
  text: Partial<Record<Locale, ToolText>>;
  capabilities: { id: string; strength: Strength }[];
  plans: CatalogPlan[];
  facts: Record<string, CatalogFact>;
  /** Lowest status among current plans (null = no plans). */
  pricingStatus: FactStatus | null;
  alternatives: { id: string; score: number | null; source: 'editorial' | 'computed' | 'fact' }[];
  relations: { id: string; kind: Exclude<RelationKind, 'alternative'> }[];
}

export interface LocalizedName {
  name: string;
  slug: string;
  description: string | null;
}

export interface CatalogCategory {
  id: string;
  icon: string | null;
  position: number;
  text: Partial<Record<Locale, LocalizedName>>;
}

export interface CatalogCapability {
  id: string;
  categoryId: string;
  position: number;
  text: Partial<Record<Locale, LocalizedName & { synonyms: string[] }>>;
}

export interface CatalogTaskStep {
  key: string;
  position: number;
  capabilityIds: string[];
  required: boolean;
  text: Partial<Record<Locale, { label: string; hint: string | null }>>;
}

export interface CatalogTask {
  id: string;
  categoryId: string;
  position: number;
  text: Partial<Record<Locale, { title: string; slug: string; summary: string | null; intentPhrases: string[] }>>;
  steps: CatalogTaskStep[];
}

export interface CatalogEvent {
  id: string;
  toolId: string | null;
  kind: ChangeKind;
  title: Partial<Record<string, string>>;
  summary: Partial<Record<string, string>> | null;
  sourceUrl: string | null;
  sourceType: SourceType | null;
  occurredAt: Date | null;
  occurredPrecision: 'day' | 'month';
  detectedAt: Date;
  confidence: number;
  significance: number;
  oldValue: unknown;
  newValue: unknown;
}

export interface CatalogStats {
  tools: number;
  facts: number;
  plans: number;
  sources: number;
  /** Share of current facts + plans with status ≥ supported. */
  supportedShare: number;
  /** Share of current facts + plans observed or verified in the last 30 days. */
  checked30dShare: number;
  lastCheckAt: Date | null;
}

export interface Catalog {
  version: number;
  loadedAt: Date;
  tools: CatalogTool[];
  toolsBySlug: Map<string, CatalogTool>;
  toolsById: Map<string, CatalogTool>;
  categories: CatalogCategory[];
  categoriesById: Map<string, CatalogCategory>;
  capabilities: CatalogCapability[];
  capabilitiesById: Map<string, CatalogCapability>;
  tasks: CatalogTask[];
  tasksById: Map<string, CatalogTask>;
  fx: { day: string | null; rates: Map<string, number> };
  events: CatalogEvent[];
  stats: CatalogStats;
}
