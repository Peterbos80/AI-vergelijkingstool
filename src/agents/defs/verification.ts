/**
 * Verification agent: turns raw candidates into a dossier with hard gates
 * (docs/strategy/08 §3, 12 §5.5). New tools are never auto-published here:
 * a verified candidate becomes an owner decision with a safe default
 * ("not published; expires after 30 days, re-assessed on new signals").
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { toolCandidates, tools } from '@/lib/db/schema';
import { loadCatalog } from '@/lib/catalog/load';
import { detectIntent } from '@/lib/engine/intent';
import { normalize } from '@/lib/engine/text';
import { sourceDomain } from '@/lib/provenance/confidence';
import { readDataVersion } from '@/lib/settings';
import { htmlToText, type PageText } from '../fetcher/text';
import type { AgentContext, AgentDefinition } from '../types';

const BLOCKLIST = /\b(casino|betting|sportsbook|porn|xxx|nsfw|onlyfans|escort|nudify|undress|deepnude|airdrop|pump\s*and\s*dump|guaranteed profits?|forex signals?|essay mill|fake reviews?)\b/i;
const PARKED = /\b(domain (is )?for sale|buy this domain|this domain may be for sale|parked (free|domain)|domain parking)\b/i;
const WAITLIST = /\b(join (the|our) waitlist|request (early )?access|coming soon|launching soon)\b/i;
const AI_TERMS = /\b(ai|a\.i\.|artificial intelligence|gpt|llm|genai|generative|machine learning|neural|agent|copilot|chatbot|diffusion|text[- ]to[- ](speech|image|video)|voice (clone|cloning)|transcri(be|ption))\b/i;
const PRICE = /(?:[$€£]\s?\d{1,4}(?:[.,]\d{2})?|\d{1,4}(?:[.,]\d{2})?\s?(?:usd|eur|€|\$)\b)(?:\s?(?:\/|per)\s?(?:mo|month|maand|user|seat|year|yr))?/gi;

export interface Dossier {
  name: string;
  url: string;
  title: string | null;
  /** Verbatim meta description (short quote, with the URL as source). */
  description: string | null;
  capabilityIds: string[];
  pricing: { url: string | null; mentionsFree: boolean; amounts: string[] };
  legal: { privacy: boolean; terms: boolean };
  waitlist: boolean;
  signals: Record<string, unknown>;
  score: number;
  breakdown: Record<string, number>;
}

export function gate(page: PageText): 'blocklist' | 'parked' | 'not_ai' | null {
  const head = `${page.title ?? ''} ${page.description ?? ''} ${page.text.slice(0, 5000)}`;
  if (BLOCKLIST.test(head)) return 'blocklist';
  if (PARKED.test(head)) return 'parked';
  if (!AI_TERMS.test(head)) return 'not_ai';
  return null;
}

export function score(input: { https: boolean; description: boolean; pricingPage: boolean; legal: number; signals: Record<string, unknown> }): { score: number; breakdown: Record<string, number> } {
  const hn = Number(input.signals.hnPoints ?? 0);
  const stars = Number(input.signals.githubStars ?? 0);
  const breakdown: Record<string, number> = {
    reachable: 20,
    ai: 20,
    https: input.https ? 10 : 0,
    description: input.description ? 10 : 0,
    pricing: input.pricingPage ? 15 : 0,
    legal: Math.min(10, input.legal * 5),
    traction: hn >= 50 || stars >= 1000 ? 15 : hn >= 20 || stars >= 300 ? 10 : 0,
  };
  return { score: Object.values(breakdown).reduce((a, b) => a + b, 0), breakdown };
}

async function dossierFor(ctx: AgentContext, c: typeof toolCandidates.$inferSelect, page: PageText, finalUrl: string): Promise<Dossier> {
  const pricingLink = page.links.find((l) => /\/(pricing|prices|plans|prijzen|tarifs|preise)\b/i.test(l.href) && sourceDomain(l.href) === sourceDomain(finalUrl));
  let pricingText = '';
  if (pricingLink) {
    const res = await ctx.fetcher.get(pricingLink.href, { accept: 'html' });
    if (res.ok) pricingText = htmlToText(res.body, res.finalUrl).text.slice(0, 20_000);
  }
  const amounts = [...new Set((pricingText.match(PRICE) ?? []).map((s) => s.trim()))].slice(0, 5);
  const legalLinks = page.links.map((l) => `${l.href} ${l.text}`.toLowerCase());
  const legal = { privacy: legalLinks.some((l) => /privacy|privacidad|datenschutz/.test(l)), terms: legalLinks.some((l) => /terms|voorwaarden|agb|conditions/.test(l)) };
  const s = score({
    https: finalUrl.startsWith('https://'),
    description: Boolean(page.description),
    pricingPage: Boolean(pricingLink),
    legal: Number(legal.privacy) + Number(legal.terms),
    signals: c.signals,
  });
  return {
    name: c.name,
    url: finalUrl,
    title: page.title?.slice(0, 120) ?? null,
    description: page.description?.slice(0, 200) ?? null,
    capabilityIds: [],
    pricing: { url: pricingLink?.href ?? null, mentionsFree: /\bfree\b|\bgratis\b|€0|\$0/i.test(pricingText), amounts },
    legal,
    waitlist: WAITLIST.test(`${page.title ?? ''} ${page.text.slice(0, 3000)}`),
    signals: c.signals,
    score: s.score,
    breakdown: s.breakdown,
  };
}

export const verificationAgent: AgentDefinition = {
  name: 'verification',
  description: 'Checks new candidates (reachability, AI relevance, blocklist, duplicates, pricing, legal pages) and hands verified ones to the owner with a dossier.',
  schedule: 'daily:03:20',
  autonomy: 'auto',
  maxItems: 15,
  timeoutMs: 10 * 60_000,
  async run(ctx) {
    const { db } = ctx;
    const now = ctx.now();
    const list = await db.select().from(toolCandidates).where(inArray(toolCandidates.status, ['new'])).orderBy(asc(toolCandidates.firstSeenAt)).limit(ctx.limits.maxItems);
    if (!list.length) return { status: 'skipped', summary: 'no new candidates' };
    const existing = await db.select({ id: tools.id, name: tools.name, aliases: tools.aliases, url: tools.websiteUrl }).from(tools);
    const byName = new Map<string, string>();
    for (const t of existing) for (const n of [t.name, ...t.aliases]) byName.set(normalize(n), t.id);
    const byDomain = new Map(existing.map((t) => [sourceDomain(t.url), t.id]));
    const catalog = await loadCatalog(db, await readDataVersion(db), now);
    let verified = 0;
    for (const c of list) {
      if (ctx.signal.aborted) break;
      const dup = byDomain.get(c.domain) ?? byName.get(normalize(c.name));
      if (dup) {
        await db.update(toolCandidates).set({ status: 'duplicate', duplicateOfToolId: dup, notes: 'matches an existing tool' }).where(eq(toolCandidates.id, c.id));
        ctx.stat('duplicate');
        continue;
      }
      await db.update(toolCandidates).set({ status: 'verifying' }).where(eq(toolCandidates.id, c.id));
      const res = await ctx.fetcher.get(c.url, { accept: 'html' });
      if (!res.ok) {
        const failures = Number(c.signals.verifyFailures ?? 0) + 1;
        const reject = failures >= 2 || res.errorKind === 'robots' || res.errorKind === 'ssrf' || res.errorKind === 'invalid_url';
        await db
          .update(toolCandidates)
          .set({ status: reject ? 'rejected' : 'new', signals: { ...c.signals, verifyFailures: failures }, notes: `unreachable: ${res.errorKind ?? 'error'}` })
          .where(eq(toolCandidates.id, c.id));
        ctx.stat(reject ? 'rejected_unreachable' : 'retry_later');
        continue;
      }
      const page = htmlToText(res.body, res.finalUrl);
      const blocked = gate(page);
      if (blocked) {
        await db.update(toolCandidates).set({ status: 'rejected', notes: blocked, confidence: 0 }).where(eq(toolCandidates.id, c.id));
        ctx.stat(`rejected_${blocked}`);
        continue;
      }
      const d = await dossierFor(ctx, c, page, res.finalUrl);
      d.capabilityIds = detectIntent(`${d.title ?? ''}. ${d.description ?? ''}`, catalog, 'en').capabilityIds.slice(0, 5);
      const ok = d.score >= 60;
      await db
        .update(toolCandidates)
        .set({ status: ok ? 'verified' : 'rejected', confidence: d.score, notes: ok ? null : `score ${d.score} < 60`, signals: { ...c.signals, dossier: d } })
        .where(and(eq(toolCandidates.id, c.id)));
      if (!ok) {
        ctx.stat('rejected_low_score');
        continue;
      }
      await ctx.inbox.escalate({
        kind: 'new_tool',
        severity: 'p3',
        category: 'data',
        title: `New tool candidate: ${d.name} (score ${d.score})`,
        reasonCode: 'new_tool_needs_review',
        payload: { candidateId: c.id, dossier: d },
        confidence: d.score,
        defaultAction: 'reject_after_30d',
        dueInHours: 30 * 24,
        dedupeKey: `new_tool:${c.domain}`,
        createdBy: 'agent:verification',
      });
      verified++;
    }
    ctx.stat('verified', verified);
    return { status: 'success', summary: `${list.length} candidates checked · ${verified} verified for review` };
  },
};
