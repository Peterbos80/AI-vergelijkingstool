/**
 * Worlds: every category is a place (docs/strategy/research-2026-10/05).
 * The home stage listens to the question box and shows the world the words
 * belong to. It runs in the browser, on the taxonomy's own words: category,
 * function names and synonyms, task titles and intent phrases. No model, no
 * network, and when the words are ambiguous the stage simply stays put.
 */
import type { Locale } from '@/i18n/config';
import type { Catalog } from '@/lib/catalog/types';
import { normalize, stems } from '@/lib/engine/text';
import { WORLDS, type WorldId } from '@/lib/world-ids';

/** Space-separated word stems per world. */
export type WorldLexicon = Partial<Record<WorldId, string>>;

/** A stem belongs to a world when at least this share of its uses is there ("video" is video, not writing). */
const MIN_SHARE = 0.25;

export function worldLexicon(catalog: Catalog, locale: Locale): WorldLexicon {
  const locales: Locale[] = locale === 'en' ? ['en'] : [locale, 'en'];
  // How often each stem is used per world, over names, synonyms, titles and intent phrases.
  const uses = new Map<string, Map<WorldId, number>>();
  const add = (world: string, text: string | null | undefined) => {
    if (!text || !(WORLDS as readonly string[]).includes(world)) return;
    for (const s of new Set(stems(text))) {
      if (s.length < 3 || /^\d+$/.test(s)) continue;
      const per = uses.get(s) ?? new Map<WorldId, number>();
      per.set(world as WorldId, (per.get(world as WorldId) ?? 0) + 1);
      uses.set(s, per);
    }
  };
  for (const l of locales) {
    for (const c of catalog.categories) add(c.id, c.text[l]?.name);
    for (const cap of catalog.capabilities) {
      const t = cap.text[l];
      add(cap.categoryId, t?.name);
      for (const syn of t?.synonyms ?? []) add(cap.categoryId, syn);
    }
    for (const task of catalog.tasks) {
      const t = task.text[l];
      add(task.categoryId, t?.title);
      for (const phrase of t?.intentPhrases ?? []) add(task.categoryId, phrase);
    }
  }
  const words = new Map<WorldId, string[]>();
  for (const [s, per] of uses) {
    const total = [...per.values()].reduce((a, b) => a + b, 0);
    for (const [w, n] of per) if (n / total >= MIN_SHARE) words.set(w, [...(words.get(w) ?? []), s]);
  }
  const out: WorldLexicon = {};
  for (const w of WORLDS) if (words.has(w)) out[w] = words.get(w)!.sort().join(' ');
  return out;
}

export interface WorldIndex {
  byStem: Map<string, WorldId[]>;
  stems: string[];
}

export function worldIndex(lexicon: WorldLexicon): WorldIndex {
  const byStem = new Map<string, WorldId[]>();
  for (const [world, list] of Object.entries(lexicon) as [WorldId, string][]) {
    for (const s of list.split(' ')) if (s) byStem.set(s, [...(byStem.get(s) ?? []), world]);
  }
  return { byStem, stems: [...byStem.keys()] };
}

export interface WorldGuess {
  world: WorldId;
  score: number;
}

/**
 * The world a question belongs to, or null when it is unclear. A word that
 * belongs to one world counts 1, to two worlds ½, and so on; the word being
 * typed counts ¾, shared over the words it could become ("vid" → video), from three letters on.
 */
export function detectWorld(query: string, index: WorldIndex): WorldGuess | null {
  const scores = new Map<WorldId, number>();
  const bump = (worlds: WorldId[] | undefined, weight: number) => {
    if (!worlds) return;
    for (const w of worlds) scores.set(w, (scores.get(w) ?? 0) + weight / worlds.length);
  };
  const done = stems(query);
  for (const s of new Set(done)) bump(index.byStem.get(s), 1);
  // The last word while it is still being typed.
  const raw = normalize(query);
  const typing = /\s$/.test(query) ? '' : (raw.split(' ').pop() ?? '');
  if (typing.length >= 3 && !index.byStem.has(typing)) {
    // Every word it could become, shared out: "vid" → video, "pod" → audio.
    const hits = index.stems.filter((s) => s.startsWith(typing));
    for (const hit of hits) bump(index.byStem.get(hit), 0.75 / hits.length);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] < 0.5) return null;
  if (second && best[1] - second[1] < 0.25) return null;
  return { world: best[0], score: best[1] };
}
