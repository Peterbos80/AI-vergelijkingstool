/**
 * Typed environment access. Optional integrations are `undefined` when not
 * configured; features that depend on them degrade honestly (and report it in
 * the dependency register) instead of faking results.
 */
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /**
   * 'server' (default): the full platform with a database at request time.
   * 'static': the free edition, rendered once and published as static files
   * (GitHub Pages). Server-only features are left out, not faked.
   */
  SITE_MODE: z.enum(['server', 'static']).default('server'),
  SITE_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: optional,
  APP_SECRET: optional,
  CRON_SECRET: optional,
  ANTHROPIC_API_KEY: optional,
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  LLM_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(5),
  LLM_MATCH_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  RESEND_API_KEY: optional,
  /** 'log' keeps e-mail in the outbox only (development/tests); never set in production. */
  EMAIL_MODE: z.enum(['send', 'log']).default('send'),
  EMAIL_FROM: optional,
  OWNER_EMAIL: optional,
  HEARTBEAT_URL: optional,
  YOUTUBE_API_KEY: optional,
  GITHUB_TOKEN: optional,
  /**
   * Optional: lets the tool scout read Product Hunt launches through its API.
   * Set it only once Product Hunt has allowed commercial use (their API terms).
   */
  PRODUCTHUNT_TOKEN: optional,
  /**
   * New tools: 'queue' (every candidate is an owner decision) or 'quarantine'
   * (the tool scout publishes the best candidates that pass every hard gate,
   * labelled "new, being checked", noindex and outside the recommendations).
   * Overrides the `policy.newToolMode` setting; the free edition sets 'quarantine'.
   */
  NEW_TOOL_MODE: z
    .enum(['queue', 'quarantine', ''])
    .optional()
    .transform((v) => (v ? v : undefined)),
  AGENT_USER_AGENT: z.string().default('AIToolsWijzerBot/1.0 (+https://aitoolswijzer.nl/bot)'),
  /** Reverse proxies in front of the app that append to X-Forwarded-For (lib/analytics/visitor.ts). */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(5).default(1),
  LEGAL_NAME: optional,
  LEGAL_KVK: optional,
  /** Btw-identificatienummer (VAT ID), shown on /about. */
  LEGAL_VAT: optional,
  LEGAL_ADDRESS: optional,
  LEGAL_EMAIL: optional,
  ENABLED_LOCALES: optional,
  /** Static edition: where visitors report corrections (e.g. a GitHub "new issue" link). */
  PUBLIC_ISSUES_URL: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached && process.env.NODE_ENV !== 'test') return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  cached = parsed.data;
  return cached;
}

export function siteUrl(path = ''): string {
  const base = env().SITE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') || path === '' ? path : `/${path}`}`;
}

/** APP_SECRET is required in production (sessions, visitor salts, tokens). */
export function appSecret(): string {
  const secret = env().APP_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (env().NODE_ENV === 'production') throw new Error('APP_SECRET (≥ 32 chars) is required in production');
  return 'development-only-insecure-secret-change-me-0123456789';
}

/** The free, static edition (docs/DEPLOYMENT.md): no request-time server features. */
export function staticSite(): boolean {
  return env().SITE_MODE === 'static';
}

/** E-mail features (Watch, newsletter) are only offered when mail can actually be delivered. */
export function emailEnabled(): boolean {
  const e = env();
  if (e.SITE_MODE === 'static') return false;
  return Boolean(e.RESEND_API_KEY) || (e.EMAIL_MODE === 'log' && e.NODE_ENV !== 'production');
}

export function legalDetails() {
  const e = env();
  return {
    name: e.LEGAL_NAME,
    kvk: e.LEGAL_KVK,
    vat: e.LEGAL_VAT,
    address: e.LEGAL_ADDRESS,
    email: e.LEGAL_EMAIL,
    complete: Boolean(e.LEGAL_NAME && e.LEGAL_KVK && e.LEGAL_ADDRESS && e.LEGAL_EMAIL),
  };
}
