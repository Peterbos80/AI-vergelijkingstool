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

/**
 * Very light stemming for nl/en: plural endings first, then -ing, then a
 * trailing -e, and y→i, so singular/plural and noun/verb forms usually meet
 * ("vergaderingen"/"vergadering" → "vergader", "stories"/"story" → "stori").
 */
export function stem(token: string): string {
  let t = token;
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
