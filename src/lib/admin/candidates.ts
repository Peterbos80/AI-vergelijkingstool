/**
 * Promote a verified candidate to an unpublished draft tool (owner decision).
 * The draft gets official website/pricing sources and suggested capabilities;
 * texts come from the owner or the optional content agent, and publishing
 * requires the quality gates in lib/admin/tools.
 */
import { and, eq, like } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { capabilities, sources, toolCandidates, toolCapabilities, tools } from '@/lib/db/schema';
import { sourceDomain } from '@/lib/provenance/confidence';
import { isGithubRepo } from '@/lib/validate';

export function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'tool'
  );
}

export async function uniqueSlug(db: Database, base: string): Promise<string> {
  const taken = new Set((await db.select({ slug: tools.slug }).from(tools).where(like(tools.slug, `${base}%`))).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  throw new Error('no free slug');
}

interface DossierLike {
  url?: string;
  capabilityIds?: string[];
  pricing?: { url?: string | null };
  waitlist?: boolean;
}

export async function promoteCandidate(db: Database, candidateId: string): Promise<{ toolId: string } | null> {
  const [c] = await db.select().from(toolCandidates).where(eq(toolCandidates.id, candidateId));
  if (!c || c.status === 'promoted') return null;
  const dossier = (c.signals.dossier ?? {}) as DossierLike;
  const websiteUrl = dossier.url ?? c.url;
  const slug = await uniqueSlug(db, slugify(c.name));
  const [tool] = await db
    .insert(tools)
    .values({
      slug,
      name: c.name,
      websiteUrl,
      pricingUrl: dossier.pricing?.url ?? null,
      githubRepo: isGithubRepo(c.signals.githubRepo as string | undefined) ? (c.signals.githubRepo as string) : null,
      status: dossier.waitlist ? 'waitlist' : 'active',
      published: false,
    })
    .returning({ id: tools.id });
  const toolId = tool!.id;
  const addSource = async (url: string, role: 'website' | 'pricing') => {
    await db
      .insert(sources)
      .values({ url, domain: sourceDomain(url), sourceType: 'official', toolId, role, checkIntervalHours: role === 'pricing' ? 24 : 6 })
      .onConflictDoNothing({ target: sources.url });
  };
  await addSource(websiteUrl, 'website');
  if (dossier.pricing?.url) await addSource(dossier.pricing.url, 'pricing');
  const known = new Set((await db.select({ id: capabilities.id }).from(capabilities)).map((r) => r.id));
  const caps = (dossier.capabilityIds ?? []).filter((id) => known.has(id)).slice(0, 5);
  for (const [i, capabilityId] of caps.entries()) {
    await db
      .insert(toolCapabilities)
      .values({ toolId, capabilityId, strength: i === 0 ? 'primary' : 'secondary', note: 'suggested by the verification agent; check before publishing' })
      .onConflictDoNothing();
  }
  await db.update(toolCandidates).set({ status: 'promoted' }).where(and(eq(toolCandidates.id, c.id)));
  return { toolId };
}
