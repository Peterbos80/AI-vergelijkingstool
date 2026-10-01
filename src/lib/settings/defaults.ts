/**
 * Owner-configurable settings with safe defaults (docs/strategy/08 §5–6 and
 * docs/strategy/12). Values live in the `settings` table as one JSON document
 * per key; anything missing falls back to these defaults.
 */
import { z } from 'zod';

const days = z.tuple([z.number().int().positive(), z.number().int().positive()]);

export const settingsSchema = z.object({
  policy: z.object({
    /** Confidence bands: ≥ autoPublish → auto, ≥ autoFlag → auto + flag, ≥ queue → queue, else human. */
    autoPublish: z.number().int().min(0).max(100),
    autoFlag: z.number().int().min(0).max(100),
    queue: z.number().int().min(0).max(100),
    priceIncreasePct: z.number().positive(),
    priceDecreasePct: z.number().positive(),
    /**
     * New tools (docs/strategy/12 §4.4): 'queue' = every candidate is an owner
     * decision; 'quarantine' = the tool scout publishes the best candidates that
     * pass every hard gate, labelled "new, being checked", noindex and outside
     * the recommendations for 7 days. NEW_TOOL_MODE in the environment overrides
     * this (the free edition on GitHub Pages sets 'quarantine').
     */
    newToolMode: z.enum(['queue', 'quarantine']),
    /**
     * Quarantine publication: at most this many new tools per day, the most
     * popular that pass every gate (fewer when fewer pass; the gates are never
     * lowered to reach the number). NEW_TOOLS_PER_DAY overrides. More than 25
     * publications in 24 hours is an anomaly: nothing is published and the
     * owner gets one escalation.
     */
    newToolsPerDay: z.number().int().min(0).max(25),
  }),
  freshness: z.object({
    price: days,
    website: days,
    features: days,
    social: days,
    video: days,
  }),
  autonomy: z.object({
    escalationBudgetPerWeek: z.number().int().positive(),
    slaDays: z.number().int().positive(),
    largePriceDefaultHours: z.number().int().positive(),
    p3ExpiryDays: z.number().int().positive(),
    opportunityMinEvCents: z.number().int().nonnegative(),
    auditSampleSize: z.number().int().positive(),
  }),
  anomaly: z.object({
    maxToolsPct: z.number().positive(),
    maxPriceChanges: z.number().int().positive(),
    maxStatusChanges: z.number().int().positive(),
    p1Pct: z.number().positive(),
  }),
  price: z.object({
    confirmations: z.number().int().min(1),
    confirmHours: z.number().positive(),
  }),
  llm: z.object({
    dailyBudgetUsd: z.number().nonnegative(),
    /** Lexical confidence below which the LLM intent engine is consulted (bounded autonomy). */
    gatingThreshold: z.number().min(0).max(1),
    gatingMin: z.number().min(0).max(1),
    gatingMax: z.number().min(0).max(1),
  }),
  report: z.object({
    weekday: z.number().int().min(0).max(6),
    hour: z.number().int().min(0).max(23),
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'unknown time zone'),
  }),
  revenue: z.object({
    goalCentsPerMonth: z.number().int().nonnegative(),
    currency: z.string().length(3),
    staleImportDays: z.number().int().positive(),
  }),
  owner: z.object({
    /** Language of Admin, the weekly report and owner alerts. */
    locale: z.enum(['nl', 'en']),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  policy: {
    autoPublish: 95,
    autoFlag: 80,
    queue: 60,
    priceIncreasePct: 50,
    priceDecreasePct: 70,
    newToolMode: 'queue',
    newToolsPerDay: 10,
  },
  freshness: {
    price: [14, 45],
    website: [7, 21],
    features: [60, 120],
    social: [7, 30],
    video: [30, 90],
  },
  autonomy: {
    escalationBudgetPerWeek: 5,
    slaDays: 7,
    largePriceDefaultHours: 72,
    p3ExpiryDays: 30,
    opportunityMinEvCents: 2500,
    auditSampleSize: 20,
  },
  anomaly: {
    maxToolsPct: 10,
    maxPriceChanges: 5,
    maxStatusChanges: 3,
    p1Pct: 25,
  },
  price: {
    confirmations: 2,
    confirmHours: 6,
  },
  llm: {
    dailyBudgetUsd: 5,
    gatingThreshold: 0.55,
    gatingMin: 0.3,
    gatingMax: 0.7,
  },
  report: {
    weekday: 1,
    hour: 7,
    timezone: 'Europe/Amsterdam',
  },
  revenue: {
    goalCentsPerMonth: 50_000,
    currency: 'EUR',
    staleImportDays: 35,
  },
  owner: {
    locale: 'nl',
  },
};

/** Merge a partial stored value onto the default for one key; invalid values fall back. */
export function mergeSetting<K extends SettingsKey>(key: K, stored: unknown): Settings[K] {
  const base = DEFAULT_SETTINGS[key];
  if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return base;
  const candidate = { ...base, ...(stored as Record<string, unknown>) };
  const parsed = settingsSchema.shape[key].safeParse(candidate);
  return (parsed.success ? parsed.data : base) as Settings[K];
}
