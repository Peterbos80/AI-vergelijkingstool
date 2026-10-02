/**
 * The hard gates of quarantine publication (docs/strategy/12 §4.4, brief B6).
 * Pure functions over data the caller fetched through the robots-aware
 * fetcher. Every gate must pass, and none is ever lowered to reach a number
 * of new tools:
 *  1. site       the official site is reachable over HTTPS, on the tool's own
 *                domain, without a redirect to another domain, robots.txt allows us;
 *  2. duplicate  no tool with the same domain, name or alias;
 *  3. content    not on the blocklist (categories or the owner's domains), not
 *                a parked domain, about AI, not a waitlist;
 *  4. name       the name is on the official site (title or description);
 *  5. popularity ≥ 2 independent signals (HN, GitHub, Product Hunt, a launch post);
 *  6. fact       ≥ 1 anchored fact with its source (pricing, free plan, license);
 *  7. function   the mapping to a function is certain (lexical engine).
 */
import type { Catalog } from '@/lib/catalog/types';
import type { DiscoverySignalKind } from '@/lib/db/schema';
import { detectIntent } from '@/lib/engine/intent';
import { normalize, stems } from '@/lib/engine/text';
import { sourceDomain } from '@/lib/provenance/confidence';
import { isGithubRepo } from '@/lib/validate';
import { normalizeText, type PageText } from '../../fetcher/text';
import type { FetchResult } from '../../fetcher/types';
import { POPULARITY, SCOUT_CONFIG } from './config';
import { candidateKey, cleanName, ownDomain } from './sources';

export type GateReason =
  | 'no_own_domain'
  | 'unreachable'
  | 'not_https'
  | 'foreign_redirect'
  | 'robots'
  | 'blocked_domain'
  | 'blocklist'
  | 'parked'
  | 'not_ai'
  | 'waitlist'
  | 'name_not_on_site'
  | 'duplicate_domain'
  | 'duplicate_name'
  | 'too_few_signals'
  | 'no_anchored_fact'
  | 'function_uncertain';

/** `hard`: a definite failure (reject or depublish now); otherwise it may be temporary (retry). */
export type GateResult = { ok: true } | { ok: false; reason: GateReason; hard: boolean };

const PASS: GateResult = { ok: true };
const fail = (reason: GateReason, hard = true): GateResult => ({ ok: false, reason, hard });

export const BLOCKLIST = /\b(casino|betting|sportsbook|porn|xxx|nsfw|onlyfans|escort|nudify|undress|deepnude|airdrop|pump\s*and\s*dump|guaranteed profits?|forex signals?|essay mill|fake reviews?)\b/i;
export const PARKED = /\b(domain (is )?for sale|buy this domain|this domain may be for sale|parked (free|domain)|domain parking)\b/i;
export const WAITLIST = /\b(join (the|our) waitlist|request (early )?access|coming soon|launching soon)\b/i;
export const AI_TERMS = /\b(ai|a\.i\.|artificial intelligence|gpt|llm|genai|generative|machine learning|neural|agent|copilot|chatbot|diffusion|text[- ]to[- ](speech|image|video)|voice (clone|cloning)|transcri(be|ption))\b/i;

/* ───────────── 1. Site ───────────── */

/** The official site: HTTPS, on the candidate's own registrable domain, robots.txt allowing us. */
export function siteGate(domain: string, res: FetchResult): GateResult {
  if (!ownDomain(domain)) return fail('no_own_domain');
  if (!res.ok) {
    if (res.errorKind === 'robots') return fail('robots');
    if (res.errorKind === 'ssrf' || res.errorKind === 'invalid_url' || res.status === 404 || res.status === 410) return fail('unreachable');
    return fail('unreachable', false);
  }
  let u: URL;
  try {
    u = new URL(res.finalUrl);
  } catch {
    return fail('unreachable');
  }
  if (u.protocol !== 'https:') return fail('not_https');
  if (sourceDomain(u.toString()) !== domain) return fail('foreign_redirect');
  return PASS;
}

/* ───────────── 2. Blocklist and content ───────────── */

/** A domain (or a sub-domain of one) the owner listed in data/discovery/sources.json. */
export function blockedDomainGate(domain: string, blocked: readonly string[] = SCOUT_CONFIG.blockedDomains): GateResult {
  const base = domain.split('/')[0]!;
  return blocked.some((b) => base === b || base.endsWith(`.${b}`)) ? fail('blocked_domain') : PASS;
}

/** Not a blocked category, not a parked domain, about AI, and usable now (the site does not say "waitlist"). */
export function contentGate(page: PageText): GateResult {
  const head = `${page.title ?? ''} ${page.description ?? ''} ${page.text.slice(0, 5000)}`;
  if (BLOCKLIST.test(head)) return fail('blocklist');
  if (PARKED.test(head)) return fail('parked');
  if (!AI_TERMS.test(head)) return fail('not_ai');
  if (WAITLIST.test(`${page.title ?? ''} ${page.description ?? ''}`)) return fail('waitlist');
  return PASS;
}

/* ───────────── 3. Name ───────────── */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A name as a whole word, its parts joined by optional separators ("browser-use" ~ "Browser Use"). */
function nameRegex(name: string): RegExp | null {
  const parts = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (!parts.length || parts.join('').length < 2) return null;
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${parts.map(escapeRe).join('[\\s._-]*')})(?=$|[^\\p{L}\\p{N}])`, 'iu');
}

/** The name must appear on the official site, in its title or description; returns the site's own spelling. */
export function nameGate(name: string, page: Pick<PageText, 'title' | 'description'>): { ok: true; name: string } | { ok: false; reason: 'name_not_on_site'; hard: true } {
  const re = nameRegex(name);
  if (!re) return { ok: false, reason: 'name_not_on_site', hard: true };
  for (const text of [page.title ?? '', page.description ?? '']) {
    const m = re.exec(text.normalize('NFKD').replace(/[̀-ͯ]/g, ''));
    if (m) return { ok: true, name: cleanName(text.normalize('NFKD').replace(/[̀-ͯ]/g, '').slice(m.index + m[0].length - m[1]!.length, m.index + m[0].length)) ?? name };
  }
  return { ok: false, reason: 'name_not_on_site', hard: true };
}

/* ───────────── 4. Duplicates ───────────── */

export interface KnownTool {
  id: string;
  name: string;
  aliases: string[];
  websiteUrl: string;
}

const squash = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, '');

/** No tool with the same domain, or the same name or alias (also "Vox Nova" = "VoxNova"). */
export function duplicateGate(domain: string, names: string[], known: readonly KnownTool[]): GateResult & { toolId?: string } {
  for (const k of known) {
    const kd = candidateKey(k.websiteUrl)?.domain ?? sourceDomain(k.websiteUrl);
    if (kd === domain) return { ...fail('duplicate_domain'), toolId: k.id };
  }
  const wanted = new Set(names.map(squash).filter((n) => n.length >= 2));
  for (const k of known) {
    if ([k.name, ...k.aliases].some((n) => wanted.has(squash(n)))) return { ...fail('duplicate_name'), toolId: k.id };
  }
  return PASS;
}

/* ───────────── 5. Popularity ───────────── */

export interface PopularitySignal {
  kind: DiscoverySignalKind;
  value: number | null;
  url: string;
  at: string | null;
  label: string | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const iso = (v: unknown) => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * The independent signals that reach their threshold, with their source link
 * and date, and a ranking value. Two signals from the same source count once.
 * `seenAt`: when the GitHub stars were last observed.
 */
export function popularity(signals: Record<string, unknown>, seenAt: Date | null = null): { ok: boolean; signals: PopularitySignal[]; score: number } {
  const out: PopularitySignal[] = [];
  let score = 0;
  if (num(signals.hnPoints) >= POPULARITY.hnPoints && typeof signals.hnId === 'string' && /^\d{1,12}$/.test(signals.hnId)) {
    out.push({ kind: 'hackernews', value: num(signals.hnPoints), url: `https://news.ycombinator.com/item?id=${signals.hnId}`, at: iso(signals.hnAt), label: null });
    score += Math.min(3, num(signals.hnPoints) / POPULARITY.hnPoints);
  }
  if (num(signals.githubStars) >= POPULARITY.githubStars && isGithubRepo(signals.githubRepo as string | undefined)) {
    out.push({ kind: 'github', value: num(signals.githubStars), url: `https://github.com/${signals.githubRepo as string}`, at: seenAt?.toISOString() ?? null, label: null });
    score += Math.min(3, num(signals.githubStars) / POPULARITY.githubStars);
  }
  if (num(signals.phVotes) >= POPULARITY.phVotes && typeof signals.phUrl === 'string' && /^https:\/\/www\.producthunt\.com\//.test(signals.phUrl)) {
    out.push({ kind: 'producthunt', value: num(signals.phVotes), url: signals.phUrl, at: iso(signals.phAt), label: null });
    score += Math.min(3, num(signals.phVotes) / POPULARITY.phVotes);
  }
  if (typeof signals.announcementUrl === 'string' && /^https:\/\//.test(signals.announcementUrl)) {
    const feed = SCOUT_CONFIG.officialFeeds.find((f) => f.id === signals.announcementFeed);
    out.push({ kind: 'announcement', value: null, url: signals.announcementUrl, at: iso(signals.announcementAt), label: feed?.maker ?? null });
    score += 1;
  }
  return { ok: new Set(out.map((s) => s.kind)).size >= 2, signals: out, score: Math.round(score * 100) / 100 };
}

/* ───────────── 6. Anchored facts ───────────── */

export interface AnchoredFact {
  key: 'has_free_tier' | 'pricing_public' | 'open_source';
  value: true;
  /** A short verbatim quote from the source (≤ 160 characters). */
  evidence: string;
  url: string;
  sourceType: 'official' | 'github';
}

const FREE_PLAN = /\b(free (plan|tier|version|forever)|forever free)\b|\bfree\b[^.]{0,40}?(?:\$\s?0|€\s?0|0\s?€)(?![.,]?\d)|(?:\$\s?0|€\s?0)(?![.,]?\d)[^.]{0,30}\bfree\b/i;
const PRICE = /(?:[$€£]\s?\d{1,4}(?:[.,]\d{2})?|\d{1,4}(?:[.,]\d{2})?\s?(?:usd|eur|€))\s?(?:\/|per)\s?(?:mo|month|maand|user|seat|year|yr|jaar)\b/i;
const OSI_LICENSES = new Set(['MIT', 'Apache-2.0', 'GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'AGPL-3.0', 'BSD-2-Clause', 'BSD-3-Clause', 'MPL-2.0', 'ISC', 'EPL-2.0', 'Unlicense', '0BSD', 'Zlib']);

/** A quote around a match, on word boundaries, at most 160 characters. */
export function quoteAround(text: string, index: number, length: number, max = 160): string {
  const from = Math.max(0, text.lastIndexOf(' ', Math.max(0, index - 40)) + 1);
  let to = Math.min(text.length, index + length + 60);
  if (to < text.length) to = text.lastIndexOf(' ', to) > index + length ? text.lastIndexOf(' ', to) : to;
  return text.slice(from, to).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Facts anchored verbatim on the official pricing page (or home page) and the GitHub API. */
export function anchoredFacts(input: { pricing: { url: string; text: string } | null; home: { url: string; text: string }; githubRepo?: unknown; githubLicense?: unknown }): AnchoredFact[] {
  const out: AnchoredFact[] = [];
  const where = input.pricing ?? input.home;
  const text = normalizeText(where.text).slice(0, 50_000);
  const free = FREE_PLAN.exec(text);
  if (free) out.push({ key: 'has_free_tier', value: true, evidence: quoteAround(text, free.index, free[0].length), url: where.url, sourceType: 'official' });
  if (input.pricing) {
    const price = PRICE.exec(text);
    if (price) out.push({ key: 'pricing_public', value: true, evidence: quoteAround(text, price.index, price[0].length), url: input.pricing.url, sourceType: 'official' });
  }
  if (typeof input.githubLicense === 'string' && OSI_LICENSES.has(input.githubLicense) && isGithubRepo(input.githubRepo as string | undefined)) {
    out.push({ key: 'open_source', value: true, evidence: `License: ${input.githubLicense} (GitHub API)`, url: `https://github.com/${input.githubRepo as string}`, sourceType: 'github' });
  }
  return out;
}

/* ───────────── 7. Function ───────────── */

export interface FunctionMapping {
  capabilityIds: string[];
  primary: string | null;
  certain: boolean;
  /** The words on the site that matched (evidence for the "functions" fact). */
  phrases: string[];
  taskId: string | null;
}

/**
 * Map the site's own title and description to functions with the lexical
 * engine (synonyms and the task index). Certain only when:
 *  A. the task index is sure (confidence ≥ 0.8): the task's functions that
 *     were named, else the task's single core function;
 *  B. the task (confidence ≥ 0.7) and a named function agree on a required
 *     step of that task;
 *  C. exactly one function is named clearly (a phrase of two or more words,
 *     or the function's own name) and at most one other matches.
 * Vague "all-in-one" descriptions (more than four functions) are never
 * certain; without a certain function nothing is published.
 */
export function mapFunctions(text: string, catalog: Catalog): FunctionMapping {
  const intent = detectIntent(text.slice(0, 600), catalog, 'en');
  const caps = intent.signals.filter((s) => s.kind === 'capability');
  const phrases = caps.map((s) => s.phrase);
  const all = intent.capabilityIds;
  const result = (ids: string[], certain: boolean): FunctionMapping => ({ capabilityIds: ids.slice(0, 3), primary: ids[0] ?? null, certain: certain && ids.length > 0, phrases, taskId: intent.taskId });
  if (all.length > 4) return result(all, false);
  const task = intent.taskId ? catalog.tasksById.get(intent.taskId) : undefined;
  if (task) {
    const taskCaps = new Set(task.steps.flatMap((st) => st.capabilityIds));
    const required = task.steps.filter((st) => st.required);
    const requiredCaps = new Set(required.flatMap((st) => st.capabilityIds));
    // Required functions first, then the other functions of the task.
    const inTask = all.filter((c) => taskCaps.has(c)).sort((a, b) => Number(requiredCaps.has(b)) - Number(requiredCaps.has(a)));
    if (intent.confidence >= 0.8) {
      if (inTask.length) return result(inTask, true);
      if (required.length === 1 && required[0]!.capabilityIds.length === 1) return result([...required[0]!.capabilityIds], true);
    }
    if (intent.confidence >= 0.7 && all.length <= 3 && inTask.some((c) => requiredCaps.has(c))) return result(inTask, true);
  }
  const strong = caps.filter((s) => {
    const cap = catalog.capabilitiesById.get(s.id);
    const ownName = cap ? Object.values(cap.text).some((t) => t && normalize(t.name) === normalize(s.phrase)) : false;
    return ownName || stems(s.phrase).length >= 2;
  });
  if (strong.length === 1 && all.length <= 2) {
    const primary = strong[0]!.id;
    return result([primary, ...all.filter((c) => c !== primary)], true);
  }
  return result(all, false);
}

/* ───────────── Skill level and quote ───────────── */

const DEVELOPER_TERMS = /\b(api|sdk|cli|npm|pip install|docker|self[- ]host(ed|ing)?|open[- ]source|developers?|framework|library|terminal|ide)\b/i;

/**
 * The level shown for a new tool: "advanced" when the site describes itself
 * in developer terms (or the product is a repository), otherwise
 * "intermediate". Never "beginner": that is an editorial judgement.
 */
export function skillLevelOf(page: Pick<PageText, 'title' | 'description'>, isRepository: boolean): 'intermediate' | 'advanced' {
  return isRepository || DEVELOPER_TERMS.test(`${page.title ?? ''} ${page.description ?? ''}`) ? 'advanced' : 'intermediate';
}

/** The site's own meta description as a literal quote (≤ 160 characters, plain text). */
export function siteQuote(description: string | null): string | null {
  if (!description) return null;
  const text = normalizeText(description.replace(/<[^>]*>/g, ' ')).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 12) return null;
  if (text.length <= 160) return text;
  const cut = text.slice(0, 159);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 100)).trim()}…`;
}
