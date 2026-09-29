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
  EMAIL_FROM: optional,
  OWNER_EMAIL: optional,
  HEARTBEAT_URL: optional,
  YOUTUBE_API_KEY: optional,
  GITHUB_TOKEN: optional,
  PRODUCTHUNT_TOKEN: optional,
  GITHUB_ISSUES_REPO: optional,
  AGENT_ENABLE_RENDERER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  AGENT_USER_AGENT: z.string().default('AIToolsWijzerBot/1.0 (+https://aitoolswijzer.nl/bot)'),
  LEGAL_NAME: optional,
  LEGAL_KVK: optional,
  LEGAL_ADDRESS: optional,
  LEGAL_EMAIL: optional,
  ENABLED_LOCALES: optional,
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

export function legalDetails() {
  const e = env();
  return {
    name: e.LEGAL_NAME,
    kvk: e.LEGAL_KVK,
    address: e.LEGAL_ADDRESS,
    email: e.LEGAL_EMAIL,
    complete: Boolean(e.LEGAL_NAME && e.LEGAL_KVK && e.LEGAL_ADDRESS && e.LEGAL_EMAIL),
  };
}
