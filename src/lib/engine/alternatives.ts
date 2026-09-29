/**
 * Alternatives by capability overlap (weighted Jaccard). Used by the
 * Recommendation agent and the seed to compute `tool_relations` (computed).
 * Monetisation data is never an input here (ranking independence).
 */
export interface CapabilityProfile {
  id: string;
  capabilities: ReadonlyArray<{ id: string; strength: 'primary' | 'secondary' }>;
  status?: string;
}

const W = { primary: 1, secondary: 0.5 } as const;

function weights(p: CapabilityProfile): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of p.capabilities) m.set(c.id, Math.max(m.get(c.id) ?? 0, W[c.strength]));
  return m;
}

/** Weighted Jaccard similarity, with the requirement that a primary capability overlaps. */
export function similarity(a: CapabilityProfile, b: CapabilityProfile): number {
  const wa = weights(a);
  const wb = weights(b);
  const primaryA = new Set(a.capabilities.filter((c) => c.strength === 'primary').map((c) => c.id));
  const primaryB = new Set(b.capabilities.filter((c) => c.strength === 'primary').map((c) => c.id));
  const primaryOverlap = [...primaryA].some((id) => wb.has(id)) || [...primaryB].some((id) => wa.has(id));
  if (!primaryOverlap) return 0;
  let inter = 0;
  let union = 0;
  for (const id of new Set([...wa.keys(), ...wb.keys()])) {
    const x = wa.get(id) ?? 0;
    const y = wb.get(id) ?? 0;
    inter += Math.min(x, y);
    union += Math.max(x, y);
  }
  return union === 0 ? 0 : inter / union;
}

export interface Alternative {
  id: string;
  score: number;
}

export function computeAlternatives(
  target: CapabilityProfile,
  all: readonly CapabilityProfile[],
  opts: { min?: number; limit?: number } = {},
): Alternative[] {
  const min = opts.min ?? 0.25;
  const limit = opts.limit ?? 8;
  return all
    .filter((t) => t.id !== target.id && t.status !== 'shutdown')
    .map((t) => ({ id: t.id, score: Math.round(similarity(target, t) * 1000) / 1000 }))
    .filter((x) => x.score >= min)
    .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
    .slice(0, limit);
}
