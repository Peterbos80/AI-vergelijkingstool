/**
 * Lexical task index: every title, intent phrase and step label of every
 * task, in every language, as weighted terms (rare words weigh more). Built
 * once per catalog. Query words are matched exactly, by shared root
 * ("programmeurs" ~ "programmeren"), typo-tolerantly ("websiet") or as Dutch
 * compounds ("vergaderverslagen" → vergader + verslag). "Without coding"
 * ("zonder code", "kan niet programmeren") becomes one concept, so it points
 * to the no-code tasks instead of the coding ones.
 */
import type { Catalog } from '@/lib/catalog/types';
import { commonPrefix, containsPhrase, damerau, isStopword, normalize, splitCompound, stem } from './text';

/** Concept term for "without code / can't program". */
export const NO_CODE = '@nocode';

const NEGATORS = new Set(['niet', 'zonder', 'geen', 'no', 'not', 'without', 'cant', 'cannot', 'dont', 'nooit', 'never']);
const CODING = /^(programm|programeer|programmeur|programmeer|codeer|coderen|coder|coding|code|codes|developer|ontwikkelaar|technisch|technical)/;
const NO_CODE_TOKENS = new Set(['no-code', 'nocode', 'low-code', 'lowcode']);

/** Conversions keep their direction: "spraak naar tekst" is transcription, "tekst naar spraak" a voice-over. */
const INTO = new Set(['naar', 'to', 'into']);
const ARTICLES = new Set(['een', 'de', 'het', 'a', 'an', 'the']);
const TARGETS: [RegExp, string][] = [
  [/^(tekst|text|transcript|transcriptie)$/, '@totext'],
  [/^(spraak|speech|stem|voice|audio|geluid)$/, '@tospeech'],
  [/^(video|videos|filmpje|filmpjes|film|clip)$/, '@tovideo'],
];

interface Phrase {
  terms: string[];
  norm: string;
  weight: number;
}

interface TaskEntry {
  id: string;
  phrases: Phrase[];
  vocab: Set<string>;
}

export interface TaskIndex {
  tasks: TaskEntry[];
  idf: Map<string, number>;
  /** Vocabulary terms by first letter (for typo and root matching). */
  byInitial: Map<string, string[]>;
}

export interface QueryTerm {
  term: string;
  /** How sure the match is: 1 exact, lower for root, typo or compound matches. */
  strength: number;
  /** The word the visitor typed. */
  from: string;
}

export interface QueryAnalysis {
  terms: QueryTerm[];
  /** Content words the vocabulary does not know (context such as "kapsalon"). */
  unknown: string[];
}

/** Words without meaning for the task: stopwords, 1-letter tokens. */
function contentWord(w: string): boolean {
  if (w.length < 2 || isStopword(w) || /^[€$£]?\d+(?:[.,]\d+)?[€$£]?$/.test(w)) return false;
  return !(w.includes('-') && w.split('-').every((p) => !p || isStopword(p)));
}

function rawTokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .map((x) => x.replace(/^[.\-]+|[.\-]+$/g, ''))
    .filter(Boolean);
}

/**
 * Tokens → words and concepts, shared by phrases and queries: "zonder code",
 * "kan niet programmeren" and "no-code" become NO_CODE; stopwords go.
 */
function words(text: string): string[] {
  const toks = rawTokens(text);
  const out: string[] = [];
  const consumed = new Set<number>();
  toks.forEach((w, i) => {
    if (NO_CODE_TOKENS.has(w)) {
      out.push(NO_CODE);
      consumed.add(i);
      return;
    }
    if (INTO.has(w)) {
      let j = i + 1;
      while (j < toks.length && ARTICLES.has(toks[j]!)) j++;
      const target = TARGETS.find(([re]) => j < toks.length && re.test(toks[j]!));
      if (target) {
        out.push(target[1]);
        consumed.add(j);
      }
      return;
    }
    if (!NEGATORS.has(w)) return;
    for (let j = i + 1; j <= i + 3 && j < toks.length; j++) {
      if (CODING.test(toks[j]!)) {
        out.push(NO_CODE);
        consumed.add(j);
        return;
      }
    }
  });
  toks.forEach((w, i) => {
    if (!consumed.has(i) && !NEGATORS.has(w) && contentWord(w)) out.push(w);
  });
  return out;
}

function termOf(word: string): string {
  return word.startsWith('@') ? word : stem(word);
}

const cache = new WeakMap<Catalog, TaskIndex>();

export function taskIndex(catalog: Catalog): TaskIndex {
  const hit = cache.get(catalog);
  if (hit) return hit;
  const tasks: TaskEntry[] = catalog.tasks.map((task) => {
    const phrases: Phrase[] = [];
    const vocab = new Set<string>();
    for (const text of Object.values(task.text)) {
      if (!text) continue;
      for (const p of [text.title, ...text.intentPhrases]) {
        const terms = [...new Set(words(p).map(termOf))];
        if (!terms.length) continue;
        phrases.push({ terms, norm: normalize(p), weight: 0 });
        for (const t of terms) vocab.add(t);
      }
    }
    // Labels of required steps describe the task too; optional steps ("Inplannen") belong to other tasks.
    for (const s of task.steps.filter((x) => x.required)) {
      for (const label of Object.values(s.text)) {
        if (label) for (const w of words(label.label)) vocab.add(termOf(w));
      }
    }
    return { id: task.id, phrases, vocab };
  });
  const df = new Map<string, number>();
  for (const t of tasks) for (const term of t.vocab) df.set(term, (df.get(term) ?? 0) + 1);
  const n = Math.max(1, tasks.length);
  const idf = new Map<string, number>();
  for (const [term, d] of df) idf.set(term, Math.log(1 + n / d));
  for (const t of tasks) for (const p of t.phrases) p.weight = p.terms.reduce((s, x) => s + (idf.get(x) ?? 0), 0);
  const byInitial = new Map<string, string[]>();
  for (const term of idf.keys()) {
    if (term.startsWith('@')) continue;
    const list = byInitial.get(term[0]!) ?? [];
    list.push(term);
    byInitial.set(term[0]!, list);
  }
  const index = { tasks, idf, byInitial };
  cache.set(catalog, index);
  return index;
}

/** Best vocabulary term for a word the vocabulary does not know as such. */
function fuzzyTerm(s: string, index: TaskIndex): { term: string; strength: number } | null {
  if (s.length < 5) return null;
  let best: { term: string; strength: number; rank: number } | null = null;
  for (const v of index.byInitial.get(s[0]!) ?? []) {
    if (v.length < 4) continue;
    // Same root: "programmeur" ~ "programmer", "automati(es)" ~ "automatisch".
    const pre = commonPrefix(s, v);
    if (pre >= 5 && pre >= 0.7 * Math.max(s.length, v.length)) {
      const rank = 2 + pre / 100;
      if (!best || rank > best.rank) best = { term: v, strength: 0.85, rank };
      continue;
    }
    // Typo: one mistake in shorter words, two in long ones.
    const max = s.length >= 8 ? 2 : 1;
    const d = damerau(s, v, max);
    if (d <= max) {
      const rank = 1 + (max - d) / 10 + (index.idf.get(v) ?? 0) / 1000;
      if (!best || rank > best.rank) best = { term: v, strength: d === 1 ? 0.8 : 0.7, rank };
    }
  }
  return best ? { term: best.term, strength: best.strength } : null;
}

export function analyzeQuery(query: string, index: TaskIndex): QueryAnalysis {
  const terms = new Map<string, QueryTerm>();
  const unknown: string[] = [];
  const add = (term: string, strength: number, from: string) => {
    const prev = terms.get(term);
    if (!prev || strength > prev.strength) terms.set(term, { term, strength, from });
  };
  const known = (t: string) => index.idf.has(t);
  for (const w of words(query)) {
    if (w.startsWith('@')) {
      add(w, 1, w);
      continue;
    }
    const s = stem(w);
    if (known(s)) {
      add(s, 1, w);
      continue;
    }
    // "kaartje" can be kaart+je as well as kaar+tje.
    const alt = /tjes?$/.test(w) ? stem(w.replace(/jes?$/, '')) : null;
    if (alt && known(alt)) {
      add(alt, 1, w);
      continue;
    }
    const fuzzy = fuzzyTerm(s, index);
    if (fuzzy) {
      add(fuzzy.term, fuzzy.strength, w);
      continue;
    }
    const parts = splitCompound(w, (p) => known(stem(p)));
    if (parts) {
      for (const p of parts) add(stem(p), 0.8, w);
      continue;
    }
    unknown.push(w);
  }
  return { terms: [...terms.values()], unknown };
}

/** Mass of one word the vocabulary does not know: context dilutes, but does not erase, a match. */
const UNKNOWN_MASS = 0.8;

export interface TaskScore {
  id: string;
  score: number;
  phrase: string;
}

/**
 * Score every task: how well its best phrase and its whole vocabulary explain
 * the query's informative words (an F-measure of weighted overlap).
 */
export function scoreTasks(query: string, index: TaskIndex, analysis: QueryAnalysis = analyzeQuery(query, index)): TaskScore[] {
  const w = (t: string) => index.idf.get(t) ?? 0;
  const strength = new Map(analysis.terms.map((q) => [q.term, q.strength]));
  const mass = analysis.terms.reduce((s, q) => s + w(q.term) * q.strength, 0) + UNKNOWN_MASS * analysis.unknown.length;
  if (mass === 0 || analysis.terms.length === 0) return index.tasks.map((t) => ({ id: t.id, score: 0, phrase: '' }));
  const normQuery = normalize(query);
  return index.tasks.map((task) => {
    let best = 0;
    let bestPhrase = '';
    for (const p of task.phrases) {
      let matched = 0;
      for (const t of p.terms) matched += w(t) * (strength.get(t) ?? 0);
      if (matched === 0 || p.weight === 0) continue;
      const precision = matched / p.weight;
      const recall = matched / mass;
      let f = (2 * precision * recall) / (precision + recall);
      if (p.terms.length >= 2 && containsPhrase(normQuery, p.norm)) f = Math.min(1, f + 0.1);
      if (f > best) {
        best = f;
        bestPhrase = p.norm;
      }
    }
    let covered = 0;
    for (const q of analysis.terms) if (task.vocab.has(q.term)) covered += w(q.term) * q.strength;
    const coverage = covered / mass;
    return { id: task.id, score: Math.min(1, 0.6 * best + 0.4 * coverage), phrase: bestPhrase };
  });
}
