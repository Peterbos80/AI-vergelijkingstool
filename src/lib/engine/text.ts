/**
 * Text normalisation shared by search and the lexical intent engine.
 * Deterministic, dependency-free, tuned for Dutch and English queries.
 */

const STOPWORDS = new Set([
  // nl
  'de', 'het', 'een', 'en', 'of', 'ik', 'wil', 'je', 'jij', 'mijn', 'me', 'mij', 'we', 'wij', 'ons', 'onze', 'voor',
  'van', 'met', 'om', 'te', 'in', 'op', 'aan', 'bij', 'die', 'dat', 'dit', 'deze', 'is', 'zijn', 'wat', 'welke',
  'hoe', 'kan', 'kun', 'kunnen', 'moet', 'moeten', 'graag', 'iets', 'maar', 'ook', 'nog', 'zo', 'als', 'dan', 'er',
  'naar', 'uit', 'over', 'door', 'tool', 'tools', 'ai', 'gebruiken', 'gebruik', 'weet', 'niet', 'geen', 'nodig',
  'hebben', 'heb', 'heeft', 'mee', 'zelf', 'even', 'beetje', 'best', 'beste', 'goede', 'goed',
  // en
  'the', 'a', 'an', 'and', 'or', 'i', 'want', 'to', 'you', 'my', 'me', 'we', 'our', 'for', 'of', 'with', 'in', 'on',
  'at', 'that', 'this', 'these', 'is', 'are', 'what', 'which', 'how', 'can', 'could', 'should', 'would', 'like',
  'some', 'something', 'but', 'also', 'so', 'as', 'than', 'then', 'there', 'from', 'about', 'by', 'use', 'using',
  'know', 'don', 't', 'dont', 'need', 'have', 'has', 'do', 'make', 'get', 'good', 'great', 'help', 'please',
]);

export function normalize(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9€$£.+#\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Is this (normalised) word a stopword? */
export function isStopword(word: string): boolean {
  return STOPWORDS.has(word);
}

/**
 * Dutch diminutives back to their base word, so "logootje", "filmpjes",
 * "bedrijfje" and "blogjes" meet "logo", "film", "bedrijf" and "blog".
 * The suffix depends on how the base word ends (-etje, -pje, -tje, -je).
 */
function undiminish(t: string): string {
  if (t.length < 5) return t;
  let m = /^(.{3,})etjes?$/.exec(t);
  if (m && /[^aeiou]$/.test(m[1]!)) return m[1]!.replace(/([^aeiou])\1$/, '$1');
  m = /^(.{2,}m)pjes?$/.exec(t);
  if (m) return m[1]!;
  // "plaatje", "beetje": the base ends in t (plaat); "logootje", "menuutje": a doubled final vowel (logo).
  m = /^(.{1,}(?:aa|ee))tjes?$/.exec(t);
  if (m) return `${m[1]!}t`;
  m = /^(.{2,}[aeiouylnrw])tjes?$/.exec(t);
  if (m) return m[1]!.replace(/([ou])\1$/, '$1');
  m = /^(.{2,}[bcdfgkpst])jes?$/.exec(t);
  if (m) return m[1]!;
  return t;
}

/**
 * Light stemming for nl/en: diminutives, plural endings, then -ing, a
 * trailing -e, and y→i, so singular/plural and noun/verb forms usually meet
 * ("vergaderingen"/"vergadering" → "vergader", "stories"/"story" → "stori").
 */
export function stem(token: string): string {
  let t = undiminish(token);
  if (t.length > 4 && t.endsWith('en')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  if (t.length > 5 && t.endsWith('ing')) t = t.slice(0, -3);
  if (t.length > 4 && t.endsWith('e')) t = t.slice(0, -1);
  if (t.length > 3 && t.endsWith('y')) t = `${t.slice(0, -1)}i`;
  return t;
}

export function tokens(input: string, opts: { keepStopwords?: boolean } = {}): string[] {
  return normalize(input)
    .split(' ')
    .map((x) => x.replace(/^[.\-]+|[.\-]+$/g, ''))
    .filter(
      (x) =>
        x.length > 1 &&
        (opts.keepStopwords || (!STOPWORDS.has(x) && !(x.includes('-') && x.split('-').every((p) => !p || STOPWORDS.has(p))))),
    );
}

export function stems(input: string): string[] {
  return tokens(input).map(stem);
}

/** Does `phrase` occur in `text` as whole words (both normalised)? */
export function containsPhrase(text: string, phrase: string): boolean {
  const t = ` ${normalize(text)} `;
  const p = normalize(phrase);
  return p.length > 0 && t.includes(` ${p} `);
}

/** Token-set similarity of two strings based on stems (0–1). */
export function stemOverlap(a: string, b: string): number {
  const sa = new Set(stems(a));
  const sb = new Set(stems(b));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / Math.min(sa.size, sb.size);
}

/** Levenshtein distance with an early exit (for typo-tolerant name search). */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}

/**
 * Damerau–Levenshtein distance (optimal string alignment: a swap of two
 * neighbouring letters counts as one typo), with an early exit above `max`.
 */
export function damerau(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1]![j]! + 1, row[j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, rows[i - 2]![j - 2]! + 1);
      row.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    rows.push(row);
  }
  return rows[a.length]![b.length]!;
}

/** Length of the common prefix of two strings. */
export function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Split a Dutch compound into the parts the vocabulary knows
 * ("vergaderverslagen" → vergader + verslagen, "bedrijfslogo" → bedrijf + logo),
 * allowing a linking s or e between parts. Returns the known parts, or null
 * when they cover less than half of the word.
 */
export function splitCompound(word: string, known: (part: string) => boolean): string[] | null {
  const n = word.length;
  if (n < 7) return null;
  const memo = new Map<number, { cover: number; parts: string[] }>();
  const seg = (i: number): { cover: number; parts: string[] } => {
    if (i === n) return { cover: 0, parts: [] };
    const hit = memo.get(i);
    if (hit) return hit;
    let best = { cover: -1, parts: [] as string[] };
    for (let j = i + 3; j <= n; j++) {
      const part = word.slice(i, j);
      const k = known(part);
      for (const skip of j < n && /[se]/.test(word[j]!) ? [0, 1] : [0]) {
        const next = j + skip;
        if (next !== n && n - next < 3) continue;
        const rest = seg(next);
        const cover = (k ? part.length : 0) + rest.cover;
        if (cover > best.cover) best = { cover, parts: k ? [part, ...rest.parts] : rest.parts };
      }
    }
    memo.set(i, best);
    return best;
  };
  const r = seg(0);
  if (!r.parts.length || r.cover < n / 2 || !r.parts.some((p) => p.length >= 4)) return null;
  return r.parts;
}
