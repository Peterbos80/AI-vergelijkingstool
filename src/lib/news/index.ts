/**
 * AI news from media: the feeds the news agent reads (data/news/sources.json),
 * the experts it watches for (data/news/people.json), the rules it applies,
 * and the queries the pages use. Only headline, outlet, date and link are
 * stored and shown; the article text stays with the publisher.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Locale } from '@/i18n/config';
import type { Database } from '@/lib/db/client';
import { newsItems } from '@/lib/db/schema';
import { isYoutubeChannel } from '@/lib/validate';
import sourcesJson from '../../../data/news/sources.json';
import peopleJson from '../../../data/news/people.json';

const sourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  kind: z.enum(['article', 'video']),
  url: z.string().url().startsWith('https://'),
  homepage: z.string().url(),
  language: z.string().min(2).max(5),
  filter: z.enum(['all', 'ai']),
});
const personSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  aliases: z.array(z.string().min(3)),
  role: z.record(z.string(), z.string()),
});

export type NewsSource = z.infer<typeof sourceSchema>;
export type NewsPerson = z.infer<typeof personSchema>;

export const NEWS_SOURCES: NewsSource[] = z.array(sourceSchema).parse(sourcesJson.sources);
export const NEWS_PEOPLE: NewsPerson[] = z.array(personSchema).parse(peopleJson.people);

export function newsSource(id: string): NewsSource | undefined {
  return NEWS_SOURCES.find((s) => s.id === id);
}

export function newsPerson(id: string): NewsPerson | undefined {
  return NEWS_PEOPLE.find((p) => p.id === id);
}

/** The channel id of a YouTube channel feed source, else null. */
export function youtubeChannelOf(source: NewsSource): string | null {
  const u = new URL(source.url);
  const id = u.hostname === 'www.youtube.com' && u.pathname === '/feeds/videos.xml' ? u.searchParams.get('channel_id') : null;
  return isYoutubeChannel(id) ? id : null;
}

export function personRole(p: NewsPerson, locale: Locale): string {
  return p.role[locale] ?? p.role.en ?? p.role.nl ?? '';
}

const AI_WORDS =
  /\b(AI|A\.I\.|AGI|artificial intelligence|kunstmatige intelligentie|generative|generatieve|machine learning|deep learning|LLMs?|large language models?|taalmodel(?:len)?|chatbots?|ChatGPT|GPT-?\d|OpenAI|Anthropic|Claude|Gemini|DeepMind|Copilot|Mistral|Llama|superintelligence|superintelligentie|deepfakes?|neural networks?|neurale netwerken)\b/;

/** Is a headline about AI? (Used for general tech feeds; AI-only feeds keep everything.) */
export function isAboutAi(text: string): boolean {
  return AI_WORDS.test(text);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Watched people named in a text: full names case-insensitively, surnames as written. */
export function peopleIn(text: string): string[] {
  return NEWS_PEOPLE.filter(
    (p) => new RegExp(`\\b${escapeRe(p.name)}\\b`, 'i').test(text) || p.aliases.some((a) => new RegExp(`\\b${escapeRe(a)}\\b`).test(text)),
  ).map((p) => p.id);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };

/** Feed titles as plain text: tags removed, entities decoded, whitespace collapsed. */
export function cleanTitle(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** One URL per story: tracking parameters and fragments removed; YouTube as watch?v=. */
export function canonicalUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  u.protocol = 'https:';
  u.hash = '';
  const yt = u.hostname.endsWith('youtube.com') ? u.searchParams.get('v') : u.hostname === 'youtu.be' ? u.pathname.slice(1) : null;
  if (yt && /^[\w-]{11}$/.test(yt)) return `https://www.youtube.com/watch?v=${yt}`;
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|mc_|fbclid|gclid|at_|cmpid|__twitter)/i.test(k)) u.searchParams.delete(k);
  return u.toString();
}

export interface NewsItem {
  id: string;
  url: string;
  sourceId: string;
  sourceName: string;
  kind: 'article' | 'video';
  title: string;
  publishedAt: Date | null;
  people: string[];
  language: string | null;
}

/** Latest published news, newest first; optionally one kind or one person. */
export async function latestNews(db: Database, opts: { limit?: number; kind?: 'article' | 'video'; person?: string } = {}): Promise<NewsItem[]> {
  const where = [eq(newsItems.status, 'active')];
  if (opts.kind) where.push(eq(newsItems.kind, opts.kind));
  if (opts.person) where.push(sql`${opts.person} = ANY(${newsItems.people})`);
  const rows = await db
    .select()
    .from(newsItems)
    .where(and(...where))
    .orderBy(desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`))
    .limit(opts.limit ?? 30);
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    sourceId: r.sourceId,
    sourceName: newsSource(r.sourceId)?.name.replace(/ \(YouTube\)$/, '') ?? r.sourceId,
    kind: r.kind,
    title: r.title,
    publishedAt: r.publishedAt,
    people: r.people,
    language: r.language,
  }));
}

/** How many items name each watched person (for the people index). */
export async function peopleCounts(db: Database): Promise<Map<string, number>> {
  const rows = await db.execute(sql`SELECT p AS person, count(*)::int AS n FROM news_items, unnest(people) AS p WHERE status = 'active' GROUP BY p`);
  const out = new Map<string, number>();
  for (const r of (rows as unknown as { rows: { person: string; n: number }[] }).rows ?? []) out.set(r.person, Number(r.n));
  return out;
}
