/**
 * Zod schemas for seed files in /data. Seed files are the editorial source for
 * the initial database. Every factual value carries provenance: sources, the
 * observation date, a status and (where available) evidence text.
 *
 * Status rules for seed data (see docs/strategy/08-agent-architecture.md §4):
 *  - verified   → only when confirmed on the official source with verbatim evidence
 *  - supported  → ≥2 independent secondary sources agree (e.g. web search summary
 *                 citing several pages, or the official page listed among results)
 *  - community  → community/social sources only
 *  - unverified → single secondary source or editorial knowledge pending checks
 */
import { z } from 'zod';

export const factStatus = z.enum(['verified', 'supported', 'community', 'unverified']);
export const sourceType = z.enum([
  'official',
  'official_docs',
  'official_blog',
  'changelog',
  'api',
  'github',
  'media',
  'secondary',
  'community',
  'social',
  'video',
]);
export const factMethod = z.enum(['editorial', 'agent', 'web_search', 'llm_extraction', 'vendor_submission', 'import']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const sourceRef = z.object({
  url: z.string().url(),
  type: sourceType,
  title: z.string().optional(),
  publisher: z.string().optional(),
});
export type SourceRef = z.infer<typeof sourceRef>;

const provenance = {
  status: factStatus,
  sources: z.array(sourceRef).min(1),
  evidence: z.string().max(600).optional(),
  method: factMethod.default('web_search'),
  observed: isoDate,
  note: z.string().max(400).optional(),
};

/**
 * Provenance fields may be omitted on plans and pricing-derived facts; they are
 * then inherited from the tool-level `pricingEvidence` block (see
 * lib/seed/load.ts → resolveProvenance). After resolution every value must
 * carry full provenance.
 */
const partialProvenance = {
  status: factStatus.optional(),
  sources: z.array(sourceRef).min(1).optional(),
  evidence: z.string().max(600).optional(),
  method: factMethod.optional(),
  observed: isoDate.optional(),
  note: z.string().max(400).optional(),
};

export const pricingEvidenceSeed = z.object(provenance);
export type PricingEvidenceSeed = z.infer<typeof pricingEvidenceSeed>;

export const factSeed = z.object({ value: z.unknown(), ...partialProvenance });
export type FactSeed = z.infer<typeof factSeed>;

export const FACT_KEYS = [
  'status',
  'has_free_tier',
  'has_free_trial',
  'pricing_public',
  'api_available',
  'open_source',
  'self_hostable',
  'platforms',
  'supports_dutch',
  'eu_data_residency',
  'gdpr_dpa',
  'trains_on_user_data',
  'commercial_use_free_tier',
  'watermark_free_tier',
  'model_dependencies',
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

export const planSeed = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Price in major units (e.g. 22 or 18.33); null for custom/contact pricing. */
  price: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  period: z.enum(['month', 'year', 'one_time', 'usage', 'custom']),
  unit: z.enum(['flat', 'per_user', 'per_seat', 'per_channel', 'usage']).default('flat'),
  /** Monthly price when billed annually (major units), if published. */
  annualMonthly: z.number().nonnegative().nullable().optional(),
  isFree: z.boolean().default(false),
  isCustom: z.boolean().default(false),
  quota: z.string().max(200).optional(),
  ...partialProvenance,
  /** Earlier observed prices for this plan (price history / Time Machine). */
  previous: z
    .array(
      z.object({
        price: z.number().nonnegative().nullable(),
        currency: z.string().length(3).nullable(),
        annualMonthly: z.number().nonnegative().nullable().optional(),
        quota: z.string().max(200).optional(),
        validTo: isoDate,
        ...provenance,
      }),
    )
    .default([]),
});
export type PlanSeed = z.infer<typeof planSeed>;

const localizedToolText = z.object({
  tagline: z.string().min(3).max(110),
  description: z.string().min(20).max(700),
  bestFor: z.array(z.string().max(140)).max(5).default([]),
  notFor: z.array(z.string().max(140)).max(4).default([]),
  limitations: z.array(z.string().max(180)).max(4).default([]),
});

export const videoSeed = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string(),
  channel: z.string().optional(),
  kind: z.enum(['official', 'review', 'tutorial', 'comparison', 'other']),
  observed: isoDate,
  sourceUrl: z.string().url(),
  language: z.string().optional(),
});

export const toolSeed = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Former or alternative names (search matches these). */
  aliases: z.array(z.string()).default([]),
  website: z.string().url(),
  pricingUrl: z.string().url().optional(),
  changelogUrl: z.string().url().optional(),
  rssUrl: z.string().url().optional(),
  githubRepo: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .optional(),
  youtubeChannelId: z.string().optional(),
  company: z.object({
    name: z.string(),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    country: z.string().length(2).optional(),
    website: z.string().url().optional(),
  }),
  launchYear: z.number().int().min(1990).max(2030).optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  audience: z.array(z.string()).default([]),
  capabilities: z
    .array(z.object({ id: z.string(), strength: z.enum(['primary', 'secondary']) }))
    .min(1),
  /** Default provenance for plans and pricing-derived facts. */
  pricingEvidence: pricingEvidenceSeed.optional(),
  facts: z.partialRecord(z.enum(FACT_KEYS), factSeed).default({}),
  plans: z.array(planSeed).default([]),
  i18n: z.object({ nl: localizedToolText, en: localizedToolText }).and(
    z.object({ de: localizedToolText.optional(), fr: localizedToolText.optional() }),
  ),
  relations: z
    .array(z.object({ tool: z.string(), kind: z.enum(['alternative', 'integrates_with', 'built_on', 'complements']) }))
    .default([]),
  videos: z.array(videoSeed).default([]),
  published: z.boolean().default(true),
});
export type ToolSeed = z.infer<typeof toolSeed>;

/* ───────── Taxonomy ───────── */

const localizedName = z.object({ name: z.string(), slug: z.string().regex(/^[a-z0-9-]+$/), description: z.string().optional() });

export const categorySeed = z.object({
  id: z.string(),
  icon: z.string(),
  i18n: z.record(z.string(), localizedName),
});

export const capabilitySeed = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  category: z.string(),
  i18n: z.record(z.string(), localizedName.extend({ synonyms: z.array(z.string()).default([]) })),
});

export const taskSeed = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  category: z.string(),
  i18n: z.record(
    z.string(),
    z.object({
      title: z.string(),
      slug: z.string().regex(/^[a-z0-9-]+$/),
      summary: z.string(),
      intentPhrases: z.array(z.string()).min(1),
    }),
  ),
  steps: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9-]+$/),
        capabilities: z.array(z.string()).min(1),
        required: z.boolean().default(true),
        i18n: z.record(z.string(), z.object({ label: z.string(), hint: z.string().optional() })),
      }),
    )
    .min(1),
});

export const taxonomySeed = z.object({
  categories: z.array(categorySeed),
  capabilities: z.array(capabilitySeed),
  tasks: z.array(taskSeed),
});
export type TaxonomySeed = z.infer<typeof taxonomySeed>;

/* ───────── Pulse events (editorial, sourced) ───────── */

export const eventSeed = z.object({
  tool: z.string().nullable(),
  kind: z.enum([
    'price_increase',
    'price_decrease',
    'plan_added',
    'plan_removed',
    'free_tier_added',
    'free_tier_removed',
    'feature',
    'release',
    'status_change',
    'rename',
    'shutdown',
    'new_tool',
    'buzz',
    'video',
    'policy',
    'funding',
    'acquisition',
    'news',
  ]),
  title: z.object({ nl: z.string(), en: z.string() }),
  summary: z.object({ nl: z.string(), en: z.string() }).optional(),
  /** YYYY-MM-DD, or YYYY-MM when only the month is known. */
  occurred: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
  significance: z.number().int().min(0).max(100).default(50),
  status: factStatus,
  sources: z.array(sourceRef).min(1),
  observed: isoDate,
});
export type EventSeed = z.infer<typeof eventSeed>;

/* ───────── Affiliate links (owner, data/affiliates.json) ───────── */

/**
 * An approved affiliate link, added by the owner after the programme accepted
 * them. Only the outbound "visit" link changes (/go/<tool>); recommendations
 * and their order never see this file.
 */
export const affiliateSeed = z.object({
  /** Tool slug, as in data/tools/<slug>.json. */
  tool: z.string().regex(/^[a-z0-9-]+$/),
  /** Where the programme runs, e.g. "partnerstack", "impact", "awin", "direct". */
  network: z.string().regex(/^[a-z0-9-]{2,40}$/),
  /** The personal link from the programme; may contain {click_id} where the network takes a sub-id. */
  url: z.string().min(12).max(1000),
  /** false switches the link off without deleting it. */
  active: z.boolean().default(true),
  /** The programme's terms page. */
  terms: z.string().url().startsWith('https://').optional(),
  note: z.string().max(300).optional(),
});
export type AffiliateSeed = z.infer<typeof affiliateSeed>;
export const affiliatesFile = z.object({ note: z.string().optional(), links: z.array(affiliateSeed) });
