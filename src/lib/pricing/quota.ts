/**
 * Plan limits ("quota") are free text in the catalog, written as the maker
 * states them ("300 minutes per month", "€10 per audio hour"). This parser
 * reads only what the text says unambiguously:
 *
 *  - an allowance: amount + unit + period ("9 hours per month"), with the
 *    subject it measures ("of voice generation", "AI minutes"), whether it is
 *    approximate ("About …", a range, "(reported)") and whether it is per user;
 *  - "Unlimited …" (as the maker calls it);
 *  - a usage price ("€10 per audio hour").
 *
 * Normalisation to minutes per month happens only for time units per month or
 * per year ("24 hours … per year" → 120 min/month). Daily and weekly limits and
 * one-off/lifetime allowances are never turned into a monthly budget; they keep
 * their own period so callers can say why a plan cannot be computed. Credits,
 * tokens and other maker-specific units are never converted. Anything else is
 * left unparsed: unknown stays unknown.
 *
 * Pure module: no database, no monetisation input (it may run in the browser).
 */

export type QuotaUnit =
  | 'minute'
  | 'hour'
  | 'credit'
  | 'token'
  | 'unit'
  | 'message'
  | 'image'
  | 'video'
  | 'email'
  | 'task'
  | 'execution'
  | 'export'
  | 'document'
  | 'article'
  | 'conversation'
  | 'report'
  | 'review'
  | 'summary'
  | 'chat'
  | 'post'
  | 'file'
  | 'song'
  | 'word';

export type QuotaPer = 'month' | 'year' | 'week' | 'day' | 'total';

export type QuotaFlag =
  /** "… per month with a daily limit": a monthly amount that is also capped per day. */
  | 'daily_limit'
  /** "(annual plan)": the amount applies to the annual plan. */
  | 'annual_plan'
  /** "(reported)": the number comes from reports, not the maker. */
  | 'reported'
  /** "… plus daily credits": more than the stated amount is available. */
  | 'plus_more';

export interface QuotaClause {
  kind: 'allowance' | 'unlimited' | 'usage_price';
  /** Amount as written (in `unit`); the lower bound of a range; null when unlimited. */
  amount: number | null;
  /** Upper bound of a range ("500–700"). */
  max: number | null;
  unit: QuotaUnit | null;
  /** Null for a usage price and for "Unlimited …" without a period. */
  per: QuotaPer | null;
  approximate: boolean;
  unlimited: boolean;
  /** "per user", "per seat", "per member". */
  perUser: boolean;
  /** "Up to 1,000" is a ceiling; "From 5,000" grows with the plan. */
  bound: 'exact' | 'up_to' | 'from' | 'range';
  /** What the amount measures, lower case ("voice generation", "ai", "processed audio"); null when not stated. */
  subject: string | null;
  /** Time units only: the amount in minutes for its own period. */
  minutes: number | null;
  /** Time units only, per month or per year: minutes per month. Never set for daily, weekly or one-off limits. */
  minutesPerMonth: number | null;
  /** Usage price: the price of one `unit`, in major units of `currency` (e.g. 10 EUR per hour). */
  price: { amount: number; currency: string } | null;
  flags: QuotaFlag[];
  /** The part of the text this clause was read from. */
  text: string;
}

const UNIT_NOUNS: Record<string, QuotaUnit> = {
  minute: 'minute',
  minutes: 'minute',
  min: 'minute',
  mins: 'minute',
  hour: 'hour',
  hours: 'hour',
  hr: 'hour',
  hrs: 'hour',
  credit: 'credit',
  credits: 'credit',
  token: 'token',
  tokens: 'token',
  unit: 'unit',
  units: 'unit',
  message: 'message',
  messages: 'message',
  image: 'image',
  images: 'image',
  video: 'video',
  videos: 'video',
  email: 'email',
  emails: 'email',
  send: 'email',
  sends: 'email',
  task: 'task',
  tasks: 'task',
  execution: 'execution',
  executions: 'execution',
  export: 'export',
  exports: 'export',
  document: 'document',
  documents: 'document',
  article: 'article',
  articles: 'article',
  conversation: 'conversation',
  conversations: 'conversation',
  report: 'report',
  reports: 'report',
  review: 'review',
  reviews: 'review',
  summary: 'summary',
  summaries: 'summary',
  chat: 'chat',
  chats: 'chat',
  post: 'post',
  posts: 'post',
  file: 'file',
  files: 'file',
  song: 'song',
  songs: 'song',
  word: 'word',
  words: 'word',
};

const PERIOD_WORDS: Record<string, Exclude<QuotaPer, 'total'>> = {
  month: 'month',
  mo: 'month',
  year: 'year',
  yr: 'year',
  week: 'week',
  day: 'day',
};

/** Adjectives that carry the period ("100 monthly credits", "10 lifetime AI credits"). */
const PERIOD_ADJECTIVES: Record<string, QuotaPer> = {
  monthly: 'month',
  yearly: 'year',
  annual: 'year',
  weekly: 'week',
  daily: 'day',
  lifetime: 'total',
  'one-time': 'total',
  'one-off': 'total',
};

const CURRENCY_SIGNS: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP' };

/** Words that end the unit phrase. */
const BOUNDARY = new Set(['of', 'per', 'a', 'an', 'in', 'with', 'plus', 'each', 'for', 'and', 'or', '/', 'max', 'up']);

type Token =
  | { t: 'num'; value: number; max: number | null; raw: string }
  | { t: 'word'; value: string; raw: string }
  | { t: 'money'; raw: string }
  | { t: 'times'; raw: string };

const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const NUM_RE = new RegExp(`^(${NUM})$`);
const MILLION_RE = new RegExp(`^(${NUM})M$`);
const RANGE_RE = new RegExp(`^(${NUM})[–-](${NUM})$`);
const NUM_WORD_RE = new RegExp(`^(${NUM})-([a-z]+)$`, 'i');

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

function tokenize(clause: string): Token[] {
  const out: Token[] = [];
  const parts = clause
    .replace(/\//g, ' / ')
    .split(/\s+/)
    .map((p) => p.replace(/^[:"'“”]+|[:.,"'“”]+$/g, ''))
    .filter(Boolean);
  for (const raw of parts) {
    let m: RegExpMatchArray | null;
    if (/^[€$£]\d/.test(raw)) out.push({ t: 'money', raw });
    else if (/^\d.*×$/.test(raw) || raw === '×') out.push({ t: 'times', raw });
    else if ((m = raw.match(NUM_RE))) out.push({ t: 'num', value: toNumber(m[1]!), max: null, raw });
    else if ((m = raw.match(MILLION_RE))) out.push({ t: 'num', value: toNumber(m[1]!) * 1_000_000, max: null, raw });
    else if ((m = raw.match(RANGE_RE))) out.push({ t: 'num', value: toNumber(m[1]!), max: toNumber(m[2]!), raw });
    else if ((m = raw.match(NUM_WORD_RE))) {
      out.push({ t: 'num', value: toNumber(m[1]!), max: null, raw: m[1]! });
      out.push({ t: 'word', value: m[2]!.toLowerCase(), raw: m[2]! });
    } else out.push({ t: 'word', value: raw.toLowerCase(), raw });
  }
  return out;
}

const hasDigit = (s: string) => /\d/.test(s);
const words = (tokens: Token[]) => tokens.map((x) => (x.t === 'word' ? x.value : x.raw)).join(' ');

function timeMinutes(unit: QuotaUnit | null, amount: number | null): number | null {
  if (amount === null) return null;
  if (unit === 'minute') return amount;
  if (unit === 'hour') return amount * 60;
  return null;
}

function blank(text: string): Omit<QuotaClause, 'kind'> {
  return {
    amount: null,
    max: null,
    unit: null,
    per: null,
    approximate: false,
    unlimited: false,
    perUser: false,
    bound: 'exact',
    subject: null,
    minutes: null,
    minutesPerMonth: null,
    price: null,
    flags: [],
    text,
  };
}

/** "€10 per audio hour", "From $0.014 per image". */
function usagePrice(clause: string): QuotaClause | null {
  const m = clause.match(new RegExp(`^(from\\s+)?([€$£])\\s?(${NUM})\\s+per\\s+(?:([a-z][a-z-]*)\\s+)?([a-z]+)$`, 'i'));
  if (!m) return null;
  const unit = UNIT_NOUNS[m[5]!.toLowerCase()];
  if (!unit) return null;
  return {
    ...blank(clause),
    kind: 'usage_price',
    amount: 1,
    unit,
    bound: m[1] ? 'from' : 'exact',
    subject: m[4] ? m[4].toLowerCase() : null,
    minutes: timeMinutes(unit, 1),
    price: { amount: toNumber(m[3]!), currency: CURRENCY_SIGNS[m[2]!]! },
  };
}

/** "Unlimited transcription", "Unlimited recordings and transcription". */
function unlimited(clause: string): QuotaClause | null {
  const m = clause.match(/^unlimited\b\s*(.*)$/i);
  if (!m || hasDigit(m[1]!) || /[€$£]/.test(m[1]!)) return null;
  const subject = m[1]!.trim().toLowerCase();
  return { ...blank(clause), kind: 'unlimited', unlimited: true, subject: subject || null };
}

/** "300 minutes per month", "About 10 hours of media per user per month", "Enhance Speech 1 hour per day". */
function allowance(clause: string, notes: string[]): QuotaClause | null {
  const tokens = tokenize(clause);
  const i = tokens.findIndex((x) => x.t === 'num');
  if (i < 0) return null;
  const lead = tokens.slice(0, i);
  if (lead.some((x) => x.t !== 'word' || hasDigit(x.raw))) return null;
  const num = tokens[i] as Extract<Token, { t: 'num' }>;

  let approximate = num.max !== null;
  let bound: QuotaClause['bound'] = num.max !== null ? 'range' : 'exact';
  let per: QuotaPer | null = null;
  const subjectWords: string[] = [];
  const leadText = lead.map((x) => (x as Extract<Token, { t: 'word' }>).value);
  for (let k = 0; k < leadText.length; k++) {
    const w = leadText[k]!;
    if (w === 'about' || w === 'approximately' || w === 'approx' || w === 'around' || w === 'roughly' || w === '≈' || w === '~') approximate = true;
    else if (w === 'up' && leadText[k + 1] === 'to') {
      bound = 'up_to';
      k++;
    } else if (w === 'max' || w === 'maximum') bound = 'up_to';
    else if (w === 'from' || (w === 'at' && leadText[k + 1] === 'least')) {
      bound = 'from';
      if (w === 'at') k++;
    } else if (PERIOD_ADJECTIVES[w]) per = PERIOD_ADJECTIVES[w]!;
    else subjectWords.push(w);
  }

  // Unit phrase: words up to a boundary; the last one is the unit noun.
  let j = i + 1;
  const phrase: string[] = [];
  while (j < tokens.length) {
    const x = tokens[j]!;
    if (x.t !== 'word') return null;
    if (BOUNDARY.has(x.value)) break;
    phrase.push(x.value);
    j++;
  }
  const noun = phrase.pop();
  const unit = noun ? UNIT_NOUNS[noun] : undefined;
  if (!unit) return null;
  const adjectives: string[] = [];
  for (const w of phrase) {
    const p = PERIOD_ADJECTIVES[w];
    if (p) {
      if (per && per !== p) return null;
      per = p;
    } else adjectives.push(w);
  }

  const word = (k: number) => {
    const x = tokens[k];
    return x && x.t === 'word' ? x.value : null;
  };
  // "of voice generation"
  const ofWords: string[] = [];
  if (word(j) === 'of') {
    j++;
    while (j < tokens.length && word(j) !== null && !BOUNDARY.has(word(j)!)) ofWords.push(word(j++)!);
    if (!ofWords.length) return null;
  }
  // "per user" / "per seat" / "per member"
  let perUser = false;
  if (word(j) === 'per' && ['user', 'seat', 'member'].includes(word(j + 1) ?? '')) {
    perUser = true;
    j += 2;
  }
  // Period: "per month", "a month", "/ month", "/year", "in total", "total"
  let explicit: QuotaPer | null = null;
  if ((word(j) === 'per' || word(j) === 'a' || word(j) === '/') && PERIOD_WORDS[word(j + 1) ?? '']) {
    explicit = PERIOD_WORDS[word(j + 1)!]!;
    j += 2;
  } else if (word(j) === 'in' && word(j + 1) === 'total') {
    explicit = 'total';
    j += 2;
  } else if (word(j) === 'total') {
    explicit = 'total';
    j += 1;
  }
  if (explicit) {
    if (per && per !== explicit) return null;
    per = explicit;
  }
  if (!per) return null;

  // Tail: nothing, or a known qualifier. Anything else ("per platform", "per 5-hour window") is not a plain limit.
  const flags: QuotaFlag[] = [];
  const tail = tokens.slice(j);
  if (tail.length) {
    const tailText = words(tail);
    if (/^with a daily limit$/.test(tailText)) flags.push('daily_limit');
    else if (/^plus\b/.test(tailText) && !tail.some((x) => x.t !== 'word')) {
      flags.push('plus_more');
      if (bound === 'exact') bound = 'from';
    } else return null;
  }
  for (const n of notes) {
    if (/\bannual plan\b/i.test(n)) flags.push('annual_plan');
    if (/^reported$/i.test(n.trim())) {
      flags.push('reported');
      approximate = true;
    }
  }

  const subject = ofWords.length ? ofWords.join(' ') : adjectives.length ? adjectives.join(' ') : subjectWords.length ? subjectWords.join(' ') : null;
  const minutes = timeMinutes(unit, num.value);
  const minutesPerMonth = minutes === null ? null : per === 'month' ? minutes : per === 'year' ? minutes / 12 : null;
  return {
    ...blank(clause),
    kind: 'allowance',
    amount: num.value,
    max: num.max,
    unit,
    per,
    approximate,
    perUser,
    bound,
    subject,
    minutes,
    minutesPerMonth,
    flags,
  };
}

/** Split into clauses on ";" and ", " (thousands separators have no space). */
function clauses(text: string): { clause: string; notes: string[] }[] {
  return text
    .split(/;\s*|,\s+/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const notes = [...raw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!);
      const outside = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      // "auto subtitles (144 hours/year)": the limit itself is in the brackets.
      if (!hasDigit(outside) && notes.some(hasDigit)) return { clause: raw.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim(), notes: [] };
      return { clause: outside, notes };
    })
    .filter((c) => c.clause);
}

/** Every limit the text states unambiguously, in order. */
export function parseQuotaClauses(text: string | null | undefined): QuotaClause[] {
  if (!text || !text.trim()) return [];
  const out: QuotaClause[] = [];
  for (const { clause, notes } of clauses(text.replace(/\s+/g, ' ').trim())) {
    const parsed = usagePrice(clause) ?? unlimited(clause) ?? allowance(clause, notes);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** The first limit the text states unambiguously, or null. */
export function parseQuota(text: string | null | undefined): QuotaClause | null {
  return parseQuotaClauses(text)[0] ?? null;
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/**
 * Seat rules of per-user/per-seat plans: "2–150 seats", "Two-seat minimum",
 * "Up to 25 users". Null when the text states none.
 */
export function parseSeats(text: string | null | undefined): { min: number | null; max: number | null } | null {
  if (!text) return null;
  const s = text.toLowerCase();
  let m = s.match(new RegExp(`(?:^|[\\s,;(])(${NUM})\\s*[–-]\\s*(${NUM})\\s+(?:seats|users|members|editors)\\b`));
  if (m) return { min: toNumber(m[1]!), max: toNumber(m[2]!) };
  m = s.match(/(?:^|[\s,;(])(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[- ]seat minimum\b/);
  if (m) return { min: NUMBER_WORDS[m[1]!] ?? Number(m[1]), max: null };
  m = s.match(/\bminimum (?:of )?(\d+) (?:seats|users)\b/);
  if (m) return { min: Number(m[1]), max: null };
  m = s.match(new RegExp(`\\bup to (${NUM}) (?:seats|users|members|editors)\\b`));
  if (m) return { min: null, max: toNumber(m[1]!) };
  return null;
}

/** "Annual billing only": no monthly billing for this plan. */
export function annualBillingOnly(text: string | null | undefined): boolean {
  return !!text && /\b(annual billing only|billed annually only|annual plan only)\b/i.test(text);
}
