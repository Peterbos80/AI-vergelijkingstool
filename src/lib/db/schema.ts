/**
 * AIToolsWijzer database schema (PostgreSQL, Drizzle ORM).
 *
 * Design rules (see docs/strategy/07-database-schema.md):
 *  - Facts carry provenance (source, verbatim evidence, status, confidence,
 *    observed/verified timestamps) and a validity range for history.
 *  - `tools` holds a denormalised snapshot of current fact values for reads.
 *  - All human-facing text lives in *_i18n tables keyed by locale.
 *  - Monetisation tables are never read by the ranking engine.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () => ts('updated_at').notNull().defaultNow();

/* ───────────────────────────── Shared literal types ───────────────────────────── */

export type FactStatus = 'verified' | 'supported' | 'community' | 'unverified';
export type SourceType =
  | 'official'
  | 'official_docs'
  | 'official_blog'
  | 'changelog'
  | 'api'
  | 'github'
  | 'media'
  | 'secondary'
  | 'community'
  | 'social'
  | 'video';
export type FactMethod =
  | 'editorial'
  | 'agent'
  | 'web_search'
  | 'llm_extraction'
  | 'vendor_submission'
  | 'import';
export type ReviewStatus = 'published' | 'pending' | 'rejected';
export type ToolStatus = 'active' | 'beta' | 'waitlist' | 'deprecated' | 'shutdown' | 'unknown';
export type PricingModel = 'free' | 'freemium' | 'paid' | 'open_source' | 'contact' | 'unknown';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type Freshness = 'fresh' | 'aging' | 'stale' | 'unknown';
export type BillingPeriod = 'month' | 'year' | 'one_time' | 'usage' | 'custom';
export type PriceUnit = 'flat' | 'per_user' | 'per_seat' | 'per_channel' | 'usage';
export type Strength = 'primary' | 'secondary';
export type RelationKind = 'alternative' | 'integrates_with' | 'built_on' | 'complements';
export type ChangeKind =
  | 'price_increase'
  | 'price_decrease'
  | 'plan_added'
  | 'plan_removed'
  | 'free_tier_added'
  | 'free_tier_removed'
  | 'feature'
  | 'release'
  | 'status_change'
  | 'rename'
  | 'shutdown'
  | 'new_tool'
  | 'website_down'
  | 'website_up'
  | 'buzz'
  | 'video'
  | 'policy'
  | 'funding'
  | 'acquisition'
  | 'news';
export type Decision =
  | 'auto_published'
  | 'auto_published_flagged'
  | 'queued'
  | 'needs_human'
  | 'rejected'
  | 'info';
export type LocalizedText = Partial<Record<string, string>>;

/* ───────────────────────────── A. Taxonomy ───────────────────────────── */

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  position: integer('position').notNull().default(0),
  icon: text('icon'),
  createdAt: createdAt(),
});

export const categoryI18n = pgTable(
  'category_i18n',
  {
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.locale] }),
    uniqueIndex('category_i18n_locale_slug').on(t.locale, t.slug),
  ],
);

export const capabilities = pgTable('capabilities', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id),
  position: integer('position').notNull().default(0),
  createdAt: createdAt(),
});

export const capabilityI18n = pgTable(
  'capability_i18n',
  {
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    synonyms: text('synonyms').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [
    primaryKey({ columns: [t.capabilityId, t.locale] }),
    uniqueIndex('capability_i18n_locale_slug').on(t.locale, t.slug),
  ],
);

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id),
  position: integer('position').notNull().default(0),
  status: text('status').$type<'published' | 'draft'>().notNull().default('published'),
  createdAt: createdAt(),
});

export const taskI18n = pgTable(
  'task_i18n',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    summary: text('summary'),
    intentPhrases: text('intent_phrases').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.locale] }), uniqueIndex('task_i18n_locale_slug').on(t.locale, t.slug)],
);

export const taskSteps = pgTable(
  'task_steps',
  {
    id: serial('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    key: text('key').notNull(),
    capabilityIds: text('capability_ids').array().notNull(),
    required: boolean('required').notNull().default(true),
  },
  (t) => [uniqueIndex('task_steps_task_key').on(t.taskId, t.key)],
);

export const taskStepI18n = pgTable(
  'task_step_i18n',
  {
    stepId: integer('step_id')
      .notNull()
      .references(() => taskSteps.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    label: text('label').notNull(),
    hint: text('hint'),
  },
  (t) => [primaryKey({ columns: [t.stepId, t.locale] })],
);

/* ───────────────────────────── B. Tools & facts ───────────────────────────── */

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  website: text('website'),
  country: text('country'),
  createdAt: createdAt(),
});

export const tools = pgTable(
  'tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
    websiteUrl: text('website_url').notNull(),
    pricingUrl: text('pricing_url'),
    changelogUrl: text('changelog_url'),
    rssUrl: text('rss_url'),
    githubRepo: text('github_repo'),
    youtubeChannelId: text('youtube_channel_id'),
    companyId: uuid('company_id').references(() => companies.id),
    status: text('status').$type<ToolStatus>().notNull().default('active'),
    published: boolean('published').notNull().default(false),
    launchYear: integer('launch_year'),
    skillLevel: text('skill_level').$type<SkillLevel>().notNull().default('beginner'),
    audience: text('audience').array().notNull().default(sql`'{}'::text[]`),
    // ── snapshot of current facts (recomputed; see lib/provenance/snapshot.ts)
    platforms: text('platforms').array().notNull().default(sql`'{}'::text[]`),
    pricingModel: text('pricing_model').$type<PricingModel>().notNull().default('unknown'),
    hasFreeTier: boolean('has_free_tier'),
    hasFreeTrial: boolean('has_free_trial'),
    pricingPublic: boolean('pricing_public'),
    apiAvailable: boolean('api_available'),
    openSource: boolean('open_source'),
    selfHostable: boolean('self_hostable'),
    supportsDutch: boolean('supports_dutch'),
    euDataResidency: boolean('eu_data_residency'),
    gdprDpa: boolean('gdpr_dpa'),
    trainsOnUserData: text('trains_on_user_data').$type<'no' | 'opt_out' | 'yes'>(),
    commercialUseFreeTier: boolean('commercial_use_free_tier'),
    watermarkFreeTier: boolean('watermark_free_tier'),
    modelDependencies: text('model_dependencies').array().notNull().default(sql`'{}'::text[]`),
    entryPriceCents: integer('entry_price_cents'),
    entryPriceCurrency: text('entry_price_currency'),
    entryPricePeriod: text('entry_price_period').$type<BillingPeriod>(),
    entryPlanName: text('entry_plan_name'),
    confidence: integer('confidence').notNull().default(0),
    freshness: text('freshness').$type<Freshness>().notNull().default('unknown'),
    lastCheckedAt: ts('last_checked_at'),
    lastChangedAt: ts('last_changed_at'),
    lastVerifiedAt: ts('last_verified_at'),
    priceCheckedAt: ts('price_checked_at'),
    websiteCheckedAt: ts('website_checked_at'),
    featuresCheckedAt: ts('features_checked_at'),
    socialCheckedAt: ts('social_checked_at'),
    videoCheckedAt: ts('video_checked_at'),
    websiteStatus: text('website_status').$type<'up' | 'down' | 'unknown'>().notNull().default('unknown'),
    qualityScore: integer('quality_score').notNull().default(0),
    qualityIssues: jsonb('quality_issues').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    indexable: jsonb('indexable')
      .$type<{ tool: boolean; pricing: boolean; alternatives: boolean }>()
      .notNull()
      .default(sql`'{"tool":false,"pricing":false,"alternatives":false}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('tools_published_idx').on(t.published), index('tools_company_idx').on(t.companyId)],
);

export const toolI18n = pgTable(
  'tool_i18n',
  {
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    tagline: text('tagline').notNull(),
    description: text('description').notNull(),
    bestFor: text('best_for').array().notNull().default(sql`'{}'::text[]`),
    notFor: text('not_for').array().notNull().default(sql`'{}'::text[]`),
    limitations: text('limitations').array().notNull().default(sql`'{}'::text[]`),
    contentStatus: text('content_status')
      .$type<'editorial' | 'ai_draft' | 'machine_translated' | 'reviewed'>()
      .notNull()
      .default('editorial'),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.toolId, t.locale] })],
);

export const toolCapabilities = pgTable(
  'tool_capabilities',
  {
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilities.id),
    strength: text('strength').$type<Strength>().notNull().default('primary'),
    note: text('note'),
  },
  (t) => [primaryKey({ columns: [t.toolId, t.capabilityId] }), index('tool_capabilities_cap_idx').on(t.capabilityId)],
);

export const toolRelations = pgTable(
  'tool_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    relatedToolId: uuid('related_tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<RelationKind>().notNull(),
    source: text('source').$type<'editorial' | 'computed' | 'fact'>().notNull().default('editorial'),
    score: real('score'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('tool_relations_unique').on(t.toolId, t.relatedToolId, t.kind)],
);

export const sources = pgTable(
  'sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull().unique(),
    domain: text('domain').notNull(),
    sourceType: text('source_type').$type<SourceType>().notNull(),
    title: text('title'),
    publisher: text('publisher'),
    toolId: uuid('tool_id').references(() => tools.id, { onDelete: 'set null' }),
    role: text('role').$type<'pricing' | 'website' | 'changelog' | 'rss' | 'docs' | 'reference' | 'other'>(),
    firstSeenAt: createdAt(),
    lastFetchedAt: ts('last_fetched_at'),
    lastStatus: integer('last_status'),
    lastError: text('last_error'),
    lastContentHash: text('last_content_hash'),
    robotsAllowed: boolean('robots_allowed'),
    fetchMode: text('fetch_mode').$type<'http' | 'render'>().notNull().default('http'),
    checkIntervalHours: integer('check_interval_hours').notNull().default(24),
    failureCount: integer('failure_count').notNull().default(0),
    notes: text('notes'),
  },
  (t) => [index('sources_tool_idx').on(t.toolId), index('sources_domain_idx').on(t.domain)],
);

export const sourceSnapshots = pgTable(
  'source_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    fetchedAt: ts('fetched_at').notNull().defaultNow(),
    httpStatus: integer('http_status'),
    contentHash: text('content_hash'),
    textLength: integer('text_length'),
    text: text('text'),
    changed: boolean('changed').notNull().default(false),
  },
  (t) => [index('source_snapshots_source_idx').on(t.sourceId, t.fetchedAt)],
);

export const facts = pgTable(
  'facts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value').$type<unknown>().notNull(),
    status: text('status').$type<FactStatus>().notNull(),
    confidence: integer('confidence').notNull(),
    sourceId: uuid('source_id').references(() => sources.id),
    extraSourceIds: uuid('extra_source_ids').array().notNull().default(sql`'{}'::uuid[]`),
    evidence: text('evidence'),
    method: text('method').$type<FactMethod>().notNull(),
    observedAt: ts('observed_at').notNull(),
    verifiedAt: ts('verified_at'),
    validFrom: ts('valid_from').notNull().defaultNow(),
    validTo: ts('valid_to'),
    createdBy: text('created_by').notNull(),
    reviewStatus: text('review_status').$type<ReviewStatus>().notNull().default('published'),
    note: text('note'),
  },
  (t) => [
    index('facts_current_idx')
      .on(t.toolId, t.key)
      .where(sql`${t.validTo} IS NULL`),
    index('facts_tool_history_idx').on(t.toolId, t.key, t.validFrom),
  ],
);

export const pricingPlans = pgTable(
  'pricing_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    planKey: text('plan_key').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    priceCents: integer('price_cents'),
    currency: text('currency'),
    billingPeriod: text('billing_period').$type<BillingPeriod>().notNull().default('month'),
    priceUnit: text('price_unit').$type<PriceUnit>().notNull().default('flat'),
    monthlyEquivalentCents: integer('monthly_equivalent_cents'),
    annualMonthlyCents: integer('annual_monthly_cents'),
    isFree: boolean('is_free').notNull().default(false),
    isCustom: boolean('is_custom').notNull().default(false),
    quota: text('quota'),
    status: text('status').$type<FactStatus>().notNull(),
    confidence: integer('confidence').notNull(),
    sourceId: uuid('source_id').references(() => sources.id),
    extraSourceIds: uuid('extra_source_ids').array().notNull().default(sql`'{}'::uuid[]`),
    evidence: text('evidence'),
    method: text('method').$type<FactMethod>().notNull(),
    observedAt: ts('observed_at').notNull(),
    verifiedAt: ts('verified_at'),
    validFrom: ts('valid_from').notNull().defaultNow(),
    validTo: ts('valid_to'),
    createdBy: text('created_by').notNull(),
    reviewStatus: text('review_status').$type<ReviewStatus>().notNull().default('published'),
  },
  (t) => [
    index('pricing_plans_current_idx')
      .on(t.toolId)
      .where(sql`${t.validTo} IS NULL`),
    index('pricing_plans_history_idx').on(t.toolId, t.planKey, t.validFrom),
  ],
);

export const changeEvents = pgTable(
  'change_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id').references(() => tools.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<ChangeKind>().notNull(),
    title: jsonb('title').$type<LocalizedText>().notNull(),
    summary: jsonb('summary').$type<LocalizedText>(),
    oldValue: jsonb('old_value').$type<unknown>(),
    newValue: jsonb('new_value').$type<unknown>(),
    sourceId: uuid('source_id').references(() => sources.id),
    sourceUrl: text('source_url'),
    sourceType: text('source_type').$type<SourceType>(),
    occurredAt: ts('occurred_at'),
    occurredPrecision: text('occurred_precision').$type<'day' | 'month'>().notNull().default('day'),
    detectedAt: ts('detected_at').notNull().defaultNow(),
    detectedBy: text('detected_by').notNull(),
    confidence: integer('confidence').notNull(),
    significance: integer('significance').notNull().default(50),
    status: text('status').$type<ReviewStatus>().notNull().default('published'),
    dedupeKey: text('dedupe_key'),
  },
  (t) => [
    index('change_events_feed_idx').on(t.status, t.detectedAt),
    index('change_events_tool_idx').on(t.toolId, t.detectedAt),
    uniqueIndex('change_events_dedupe').on(t.dedupeKey),
  ],
);

export const videos = pgTable(
  'videos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    provider: text('provider').$type<'youtube'>().notNull().default('youtube'),
    videoId: text('video_id').notNull(),
    title: text('title').notNull(),
    channelTitle: text('channel_title'),
    channelId: text('channel_id'),
    kind: text('kind').$type<'official' | 'review' | 'tutorial' | 'comparison' | 'other'>().notNull(),
    publishedAt: ts('published_at'),
    language: text('language'),
    source: text('source').$type<'youtube_api' | 'rss' | 'editorial' | 'web_search'>().notNull(),
    sourceUrl: text('source_url'),
    status: text('status').$type<'active' | 'removed' | 'pending'>().notNull().default('active'),
    relevance: real('relevance').notNull().default(0.5),
    fetchedAt: ts('fetched_at').notNull().defaultNow(),
    verifiedAt: ts('verified_at'),
  },
  (t) => [uniqueIndex('videos_unique').on(t.provider, t.videoId, t.toolId)],
);

export const socialSignals = pgTable(
  'social_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    provider: text('provider').$type<'github' | 'hackernews' | 'youtube' | 'producthunt'>().notNull(),
    metric: text('metric').notNull(),
    value: real('value').notNull(),
    observedAt: ts('observed_at').notNull().defaultNow(),
    url: text('url'),
  },
  (t) => [index('social_signals_series_idx').on(t.toolId, t.provider, t.metric, t.observedAt)],
);

export const fxRates = pgTable(
  'fx_rates',
  {
    day: date('day', { mode: 'string' }).notNull(),
    quote: text('quote').notNull(),
    rate: numeric('rate', { precision: 14, scale: 6 }).notNull(),
    sourceUrl: text('source_url').notNull(),
    fetchedAt: ts('fetched_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.quote] })],
);

/* ───────────────────────────── C. Agents & operations ───────────────────────────── */

export const agentConfigs = pgTable('agent_configs', {
  agent: text('agent').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  schedule: text('schedule').notNull(),
  autonomy: text('autonomy').$type<'auto' | 'queue_only' | 'off'>().notNull().default('auto'),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  nextRunAt: ts('next_run_at'),
  lastRunAt: ts('last_run_at'),
  updatedAt: updatedAt(),
});

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agent: text('agent').notNull(),
    trigger: text('trigger').$type<'schedule' | 'manual' | 'api' | 'cli' | 'test'>().notNull(),
    status: text('status').$type<'running' | 'success' | 'partial' | 'failed' | 'skipped'>().notNull(),
    startedAt: ts('started_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
    stats: jsonb('stats').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    summary: text('summary'),
    error: text('error'),
  },
  (t) => [index('agent_runs_agent_idx').on(t.agent, t.startedAt)],
);

export const agentActions = pgTable(
  'agent_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'cascade' }),
    agent: text('agent').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    toolId: uuid('tool_id').references(() => tools.id, { onDelete: 'set null' }),
    field: text('field'),
    oldValue: jsonb('old_value').$type<unknown>(),
    newValue: jsonb('new_value').$type<unknown>(),
    sourceUrl: text('source_url'),
    confidence: integer('confidence'),
    decision: text('decision').$type<Decision>().notNull().default('info'),
    reason: text('reason'),
    createdAt: createdAt(),
  },
  (t) => [index('agent_actions_run_idx').on(t.runId), index('agent_actions_created_idx').on(t.createdAt)],
);

export const reviewItems = pgTable(
  'review_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind')
      .$type<
        | 'fact_change'
        | 'price_change'
        | 'new_tool'
        | 'duplicate'
        | 'content_draft'
        | 'broken_link'
        | 'correction'
        | 'status_change'
        | 'video'
      >()
      .notNull(),
    toolId: uuid('tool_id').references(() => tools.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    confidence: integer('confidence'),
    priority: integer('priority').notNull().default(50),
    status: text('status').$type<'pending' | 'approved' | 'rejected' | 'auto_resolved'>().notNull().default('pending'),
    createdBy: text('created_by').notNull(),
    runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
    dedupeKey: text('dedupe_key'),
    createdAt: createdAt(),
    reviewedBy: text('reviewed_by'),
    reviewedAt: ts('reviewed_at'),
    reviewNote: text('review_note'),
  },
  (t) => [
    index('review_items_queue_idx').on(t.status, t.priority),
    uniqueIndex('review_items_dedupe').on(t.dedupeKey),
  ],
);

export const toolCandidates = pgTable(
  'tool_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    domain: text('domain').notNull(),
    source: text('source').$type<'hackernews' | 'github' | 'producthunt' | 'rss' | 'submission'>().notNull(),
    sourceUrl: text('source_url'),
    signals: jsonb('signals').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    firstSeenAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    status: text('status')
      .$type<'new' | 'verifying' | 'verified' | 'rejected' | 'promoted' | 'duplicate'>()
      .notNull()
      .default('new'),
    confidence: integer('confidence').notNull().default(0),
    duplicateOfToolId: uuid('duplicate_of_tool_id').references(() => tools.id, { onDelete: 'set null' }),
    notes: text('notes'),
  },
  (t) => [uniqueIndex('tool_candidates_domain').on(t.domain)],
);

export const errorLog = pgTable(
  'error_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    at: ts('at').notNull().defaultNow(),
    scope: text('scope').$type<'agent' | 'app' | 'api' | 'email' | 'llm'>().notNull(),
    agent: text('agent'),
    message: text('message').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    fingerprint: text('fingerprint').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    count: integer('count').notNull().default(1),
  },
  (t) => [uniqueIndex('error_log_fingerprint_day').on(t.fingerprint, t.day), index('error_log_at_idx').on(t.at)],
);

export const llmUsage = pgTable(
  'llm_usage',
  {
    day: date('day', { mode: 'string' }).notNull(),
    purpose: text('purpose').notNull(),
    calls: integer('calls').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    estCostMicros: integer('est_cost_micros').notNull().default(0),
    failures: integer('failures').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.purpose] })],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: updatedAt(),
  updatedBy: text('updated_by'),
});

export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: ts('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/* ───────────────────────────── D. Users, stacks, relations ───────────────────────────── */

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'owner' | 'editor' | 'viewer'>().notNull().default('editor'),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: createdAt(),
  lastLoginAt: ts('last_login_at'),
});

export const adminSessions = pgTable('admin_sessions', {
  id: text('id').primaryKey(), // sha256 of the session token
  userId: uuid('user_id')
    .notNull()
    .references(() => adminUsers.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
  expiresAt: ts('expires_at').notNull(),
  userAgent: text('user_agent'),
});

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    at: ts('at').notNull().defaultNow(),
    userId: uuid('user_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
  },
  (t) => [index('audit_log_at_idx').on(t.at)],
);

export const stacks = pgTable('stacks', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicId: text('public_id').notNull().unique(),
  editTokenHash: text('edit_token_hash').notNull(),
  title: text('title'),
  locale: text('locale').notNull(),
  origin: text('origin').$type<'match' | 'doctor' | 'manual'>().notNull(),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  queryText: text('query_text'),
  constraints: jsonb('constraints').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const stackItems = pgTable(
  'stack_items',
  {
    stackId: uuid('stack_id')
      .notNull()
      .references(() => stacks.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull().default('general'),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.stackId, t.toolId, t.stepKey] }), index('stack_items_tool_idx').on(t.toolId)],
);

export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  locale: text('locale').notNull(),
  status: text('status').$type<'pending' | 'confirmed' | 'unsubscribed'>().notNull().default('pending'),
  confirmTokenHash: text('confirm_token_hash'),
  unsubscribeToken: text('unsubscribe_token').notNull().unique(),
  consentText: text('consent_text').notNull(),
  consentAt: ts('consent_at').notNull().defaultNow(),
  confirmedAt: ts('confirmed_at'),
  unsubscribedAt: ts('unsubscribed_at'),
  source: text('source').$type<'newsletter' | 'stack_watch' | 'tool_watch'>().notNull(),
  newsletter: boolean('newsletter').notNull().default(false),
  createdAt: createdAt(),
});

export const watches = pgTable(
  'watches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    stackId: uuid('stack_id').references(() => stacks.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id').references(() => tools.id, { onDelete: 'cascade' }),
    frequency: text('frequency').$type<'weekly' | 'daily'>().notNull().default('weekly'),
    createdAt: createdAt(),
    lastNotifiedAt: ts('last_notified_at'),
  },
  (t) => [index('watches_subscriber_idx').on(t.subscriberId)],
);

export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toEmail: text('to_email').notNull(),
    subject: text('subject').notNull(),
    bodyText: text('body_text').notNull(),
    bodyHtml: text('body_html'),
    kind: text('kind').$type<'confirm' | 'digest' | 'alert' | 'lead_ack' | 'other'>().notNull(),
    status: text('status').$type<'queued' | 'sent' | 'failed' | 'logged'>().notNull().default('queued'),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    createdAt: createdAt(),
    sentAt: ts('sent_at'),
  },
  (t) => [index('email_outbox_status_idx').on(t.status, t.createdAt)],
);

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').$type<'stack_advice' | 'vendor' | 'other'>().notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  company: text('company'),
  companySize: text('company_size'),
  message: text('message'),
  locale: text('locale').notNull(),
  stackId: uuid('stack_id').references(() => stacks.id, { onDelete: 'set null' }),
  consentAt: ts('consent_at').notNull().defaultNow(),
  status: text('status').$type<'new' | 'contacted' | 'qualified' | 'won' | 'lost'>().notNull().default('new'),
  valueCents: integer('value_cents'),
  currency: text('currency').default('EUR'),
  notes: text('notes'),
  createdAt: createdAt(),
});

/* ───────────────────────────── E. Analytics & monetisation ───────────────────────────── */

export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: ts('ts').notNull().defaultNow(),
    type: text('type').notNull(),
    path: text('path'),
    pageType: text('page_type'),
    locale: text('locale'),
    entityId: text('entity_id'),
    visitorHash: text('visitor_hash'),
    referrerDomain: text('referrer_domain'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    device: text('device').$type<'mobile' | 'tablet' | 'desktop'>(),
    country: text('country'),
    props: jsonb('props').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('events_ts_idx').on(t.ts),
    index('events_type_ts_idx').on(t.type, t.ts),
    index('events_page_type_ts_idx').on(t.pageType, t.ts),
  ],
);

export const matchQueries = pgTable(
  'match_queries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ts: ts('ts').notNull().defaultNow(),
    locale: text('locale').notNull(),
    queryScrubbed: text('query_scrubbed'),
    queryHash: text('query_hash').notNull(),
    engine: text('engine').$type<'llm' | 'lexical'>().notNull(),
    taskId: text('task_id'),
    capabilityIds: text('capability_ids').array().notNull().default(sql`'{}'::text[]`),
    constraints: jsonb('constraints').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    confidence: integer('confidence').notNull(),
    clarified: boolean('clarified').notNull().default(false),
    resultToolIds: text('result_tool_ids').array().notNull().default(sql`'{}'::text[]`),
    visitorHash: text('visitor_hash'),
    latencyMs: integer('latency_ms'),
  },
  (t) => [index('match_queries_ts_idx').on(t.ts), index('match_queries_task_idx').on(t.taskId)],
);

export const affiliatePrograms = pgTable('affiliate_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),
  network: text('network').notNull(),
  status: text('status')
    .$type<'researching' | 'applied' | 'approved' | 'rejected' | 'paused' | 'closed'>()
    .notNull()
    .default('researching'),
  commissionType: text('commission_type')
    .$type<'recurring_percent' | 'first_payment_percent' | 'flat' | 'cpc' | 'unknown'>()
    .notNull()
    .default('unknown'),
  commissionValue: real('commission_value'),
  commissionDurationMonths: integer('commission_duration_months'),
  cookieDays: integer('cookie_days'),
  programUrl: text('program_url'),
  termsUrl: text('terms_url'),
  infoSourceUrl: text('info_source_url'),
  infoStatus: text('info_status').$type<FactStatus>().notNull().default('unverified'),
  notes: text('notes'),
  lastCheckedAt: ts('last_checked_at'),
  createdAt: createdAt(),
});

export const affiliateLinks = pgTable('affiliate_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').references(() => affiliatePrograms.id, { onDelete: 'set null' }),
  urlTemplate: text('url_template').notNull(),
  active: boolean('active').notNull().default(false),
  createdAt: createdAt(),
  createdBy: text('created_by'),
  lastCheckedAt: ts('last_checked_at'),
  lastStatus: integer('last_status'),
});

export const outboundClicks = pgTable(
  'outbound_clicks',
  {
    id: text('id').primaryKey(), // click_id, also used as affiliate sub-id
    ts: ts('ts').notNull().defaultNow(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    linkKind: text('link_kind').$type<'affiliate' | 'direct'>().notNull(),
    affiliateLinkId: uuid('affiliate_link_id').references(() => affiliateLinks.id, { onDelete: 'set null' }),
    pagePath: text('page_path'),
    pageType: text('page_type'),
    locale: text('locale'),
    position: integer('position'),
    matchQueryId: uuid('match_query_id'),
    visitorHash: text('visitor_hash'),
    referrerDomain: text('referrer_domain'),
    device: text('device'),
  },
  (t) => [
    index('outbound_clicks_ts_idx').on(t.ts),
    index('outbound_clicks_tool_idx').on(t.toolId, t.ts),
    index('outbound_clicks_page_idx').on(t.pagePath),
  ],
);

export const conversions = pgTable(
  'conversions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clickId: text('click_id'),
    programId: uuid('program_id').references(() => affiliatePrograms.id, { onDelete: 'set null' }),
    toolId: uuid('tool_id').references(() => tools.id, { onDelete: 'set null' }),
    externalId: text('external_id').notNull(),
    occurredAt: ts('occurred_at').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    status: text('status').$type<'pending' | 'approved' | 'reversed' | 'paid'>().notNull().default('pending'),
    source: text('source').$type<'csv' | 'api' | 'manual'>().notNull(),
    importedAt: ts('imported_at').notNull().defaultNow(),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
  },
  (t) => [uniqueIndex('conversions_external').on(t.programId, t.externalId), index('conversions_click_idx').on(t.clickId)],
);

export const revenueEntries = pgTable('revenue_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').$type<'sponsorship' | 'newsletter' | 'lead' | 'data' | 'other'>().notNull(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('EUR'),
  day: date('day', { mode: 'string' }).notNull(),
  description: text('description'),
  toolId: uuid('tool_id').references(() => tools.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  createdBy: text('created_by'),
  createdAt: createdAt(),
});

export const placements = pgTable('placements', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),
  slot: text('slot').$type<'home_sponsored' | 'newsletter' | 'task_sponsored'>().notNull(),
  message: jsonb('message').$type<LocalizedText>().notNull(),
  startsAt: ts('starts_at').notNull(),
  endsAt: ts('ends_at').notNull(),
  priceCents: integer('price_cents'),
  currency: text('currency').default('EUR'),
  status: text('status').$type<'scheduled' | 'active' | 'ended' | 'cancelled'>().notNull().default('scheduled'),
  notes: text('notes'),
  createdAt: createdAt(),
});

/* ───────────────────────────── Row types ───────────────────────────── */

export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type Fact = typeof facts.$inferSelect;
export type PricingPlan = typeof pricingPlans.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type ChangeEvent = typeof changeEvents.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AgentAction = typeof agentActions.$inferSelect;
export type ReviewItem = typeof reviewItems.$inferSelect;
export type Video = typeof videos.$inferSelect;
