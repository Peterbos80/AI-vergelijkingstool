/**
 * Verify one candidate against the hard gates and build its dossier. Used by
 * the hourly verification agent and, freshly, right before the daily
 * publication. Every page is read through the robots-aware fetcher; page text
 * is used in memory and dropped, only short verbatim quotes with their source
 * are kept.
 */
import type { toolCandidates } from '@/lib/db/schema';
import type { Catalog } from '@/lib/catalog/types';
import { htmlToText, type PageText } from '../../fetcher/text';
import { pricingLinkOf } from '../tool-sources';
import { parseFeed } from '../../defs/change-detection';
import type { AgentContext } from '../../types';
import {
  anchoredFacts,
  blockedDomainGate,
  contentGate,
  duplicateGate,
  mapFunctions,
  nameGate,
  siteGate,
  siteQuote,
  skillLevelOf,
  type AnchoredFact,
  type FunctionMapping,
  type GateReason,
  type KnownTool,
} from './gates';
import { canonicalPostUrl, feedLinks, launchesIn, type CandidateSignals } from './sources';

type CandidateRow = typeof toolCandidates.$inferSelect;

const PRICE_AMOUNT = /(?:[$€£]\s?\d{1,4}(?:[.,]\d{2})?|\d{1,4}(?:[.,]\d{2})?\s?(?:usd|eur|€|\$)\b)(?:\s?(?:\/|per)\s?(?:mo|month|maand|user|seat|year|yr))?/gi;

/** The dossier on a candidate (stored in tool_candidates.signals.dossier; the owner sees it in queue mode). */
export interface ScoutDossier {
  version: 2;
  checkedAt: string;
  /** The name as the official site spells it. */
  name: string;
  /** The official site after redirects (same registrable domain). */
  url: string;
  domain: string;
  title: string | null;
  /** Kept for the owner's review in queue mode; never published (the quote below is). */
  description: string | null;
  /** The site's meta description as a literal quote (≤ 160 characters) with its URL. */
  quote: { text: string; url: string } | null;
  functions: FunctionMapping;
  capabilityIds: string[];
  facts: AnchoredFact[];
  pricing: { url: string | null; mentionsFree: boolean; amounts: string[] };
  legal: { privacy: boolean; terms: boolean };
  waitlist: boolean;
  skillLevel: 'intermediate' | 'advanced';
  /** A launch post on the tool's own site (its own feed). */
  ownAnnouncement: { url: string; at: string } | null;
  gates: Partial<Record<'site' | 'content' | 'name' | 'duplicate' | 'function' | 'fact', boolean>>;
}

export type VerifyOutcome =
  | { kind: 'pass'; dossier: ScoutDossier; signals: CandidateSignals }
  | { kind: 'fail'; reason: GateReason; hard: boolean; dossier: ScoutDossier | null; duplicateOf?: string };

async function readPricing(ctx: AgentContext, page: PageText, homeUrl: string): Promise<{ url: string; text: string } | null> {
  const link = pricingLinkOf(page, homeUrl);
  if (!link) return null;
  const res = await ctx.fetcher.get(link, { accept: 'html' });
  if (!res.ok) return null;
  return { url: res.finalUrl, text: htmlToText(res.body, res.finalUrl).text.slice(0, 50_000) };
}

/** A launch post about this tool in the feed its own home page announces. */
async function ownAnnouncement(ctx: AgentContext, html: string, homeUrl: string, name: string): Promise<{ url: string; at: string } | null> {
  const [feed] = feedLinks(html, homeUrl);
  if (!feed) return null;
  const res = await ctx.fetcher.get(feed, { accept: 'xml' });
  if (!res.ok) return null;
  let items: ReturnType<typeof parseFeed>;
  try {
    items = parseFeed(res.body.slice(0, 2_000_000));
  } catch {
    return null;
  }
  const since = new Date(ctx.now().getTime() - 90 * 86_400_000);
  const want = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const hit = launchesIn(items.slice(0, 50), since).find((l) => {
    const got = l.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    return want.length >= 2 && (got === want || got.startsWith(want));
  });
  const url = hit ? canonicalPostUrl(hit.postUrl) : null;
  return hit && url && new URL(url).protocol === 'https:' ? { url, at: hit.at.toISOString() } : null;
}

/**
 * Run the candidate gates in order (cheapest first): own domain, owner's
 * blocklist, duplicate, the official site, content, name, function and an
 * anchored fact. Popularity is checked at publication, when signals have grown.
 */
export async function verifyCandidate(ctx: AgentContext, c: CandidateRow, known: readonly KnownTool[], catalog: Catalog): Promise<VerifyOutcome> {
  const signals = { ...(c.signals as CandidateSignals & Record<string, unknown>) };
  delete (signals as Record<string, unknown>).dossier;
  const early = blockedDomainGate(c.domain);
  if (!early.ok) return { kind: 'fail', reason: early.reason, hard: true, dossier: null };
  const dup0 = duplicateGate(c.domain, [c.name], known);
  if (!dup0.ok) return { kind: 'fail', reason: dup0.reason, hard: true, dossier: null, duplicateOf: dup0.toolId };

  const res = await ctx.fetcher.get(c.url, { accept: 'html' });
  const site = siteGate(c.domain, res);
  if (!site.ok) return { kind: 'fail', reason: site.reason, hard: site.hard, dossier: null };
  const page = htmlToText(res.body, res.finalUrl);
  const content = contentGate(page);
  const named = nameGate(c.name, page);
  const name = named.ok ? named.name : c.name;
  const dup = duplicateGate(c.domain, [c.name, name], known);
  const pricing = await readPricing(ctx, page, res.finalUrl);
  const functions = mapFunctions(`${page.title ?? ''}. ${page.description ?? ''}`, catalog);
  const facts = anchoredFacts({ pricing, home: { url: res.finalUrl, text: page.text }, githubRepo: signals.githubRepo, githubLicense: signals.githubLicense });
  const own = await ownAnnouncement(ctx, res.body, res.finalUrl, name);
  if (own && !signals.announcementUrl) Object.assign(signals, { announcementUrl: own.url, announcementAt: own.at, announcementFeed: 'own-site' });
  const quote = siteQuote(page.description);
  const legalLinks = page.links.map((l) => `${l.href} ${l.text}`.toLowerCase());
  const dossier: ScoutDossier = {
    version: 2,
    checkedAt: ctx.now().toISOString(),
    name,
    url: `${new URL(res.finalUrl).origin}/`,
    domain: c.domain,
    title: page.title?.slice(0, 120) ?? null,
    description: page.description?.slice(0, 200) ?? null,
    quote: quote ? { text: quote, url: res.finalUrl } : null,
    functions,
    capabilityIds: functions.capabilityIds,
    facts,
    pricing: {
      url: pricing?.url ?? null,
      mentionsFree: facts.some((f) => f.key === 'has_free_tier'),
      amounts: [...new Set((pricing?.text.match(PRICE_AMOUNT) ?? []).map((s) => s.trim()))].slice(0, 5),
    },
    legal: { privacy: legalLinks.some((l) => /privacy|privacidad|datenschutz/.test(l)), terms: legalLinks.some((l) => /terms|voorwaarden|agb|conditions/.test(l)) },
    waitlist: !content.ok && content.reason === 'waitlist',
    skillLevel: skillLevelOf(page, false),
    ownAnnouncement: own,
    gates: { site: true, content: content.ok, name: named.ok, duplicate: dup.ok, function: functions.certain, fact: facts.length > 0 },
  };
  if (!content.ok) return { kind: 'fail', reason: content.reason, hard: true, dossier };
  if (!named.ok) return { kind: 'fail', reason: named.reason, hard: true, dossier };
  if (!dup.ok) return { kind: 'fail', reason: dup.reason, hard: true, dossier, duplicateOf: dup.toolId };
  if (!functions.certain) return { kind: 'fail', reason: 'function_uncertain', hard: true, dossier };
  if (!facts.length) return { kind: 'fail', reason: 'no_anchored_fact', hard: true, dossier };
  return { kind: 'pass', dossier, signals };
}
