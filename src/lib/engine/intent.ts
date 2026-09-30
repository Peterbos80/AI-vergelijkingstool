/**
 * Lexical intent engine (always available; the LLM engine is optional).
 * Maps a free-text goal to a task, extra capabilities, mentioned tools and
 * constraints. Fully deterministic and explainable: every signal records the
 * phrase that triggered it.
 */
import type { Locale } from '@/i18n/config';
import type { Catalog } from '@/lib/catalog/types';
import { taskIndex, scoreTasks } from './lexicon';
import { containsPhrase, normalize, stems, tokens } from './text';

export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface Constraints {
  /** Maximum total monthly budget for the stack, in cents. */
  budgetMonthlyCents?: number;
  budgetCurrency?: 'EUR' | 'USD';
  freeOnly?: boolean;
  level?: Level;
  eu?: boolean;
  dutch?: boolean;
  platform?: string;
  noWatermark?: boolean;
  commercial?: boolean;
  openSource?: boolean;
  api?: boolean;
  local?: boolean;
  privacy?: boolean;
  teamSize?: number;
  avoidToolIds?: string[];
  /** Clarification answers: step key → chosen capability id. */
  approach?: Record<string, string>;
}

export interface Signal {
  kind: 'task' | 'capability' | 'constraint' | 'tool';
  id: string;
  phrase: string;
}

export interface Intent {
  query: string;
  locale: Locale;
  taskId: string | null;
  taskScore: number;
  runnerUpTaskId: string | null;
  /** Best task candidates (score ≥ 0.3), for clarification when no task is certain. */
  taskCandidates: { id: string; score: number }[];
  capabilityIds: string[];
  toolIds: string[];
  constraints: Constraints;
  confidence: number;
  engine: 'lexical' | 'llm';
  signals: Signal[];
}

/* ───────────── Constraint parsing (nl + en) ───────────── */

const NUM = '(\\d{1,5}(?:[.,]\\d{1,2})?)';
const CUR_BEFORE = '(€|eur|euro|\\$|usd|dollar)';
const CUR_AFTER = '(€|eur|euro|euros|\\$|usd|dollar|dollars)';
const BUDGET_WORDS = '(?:onder|max(?:imaal|imum)?|tot|hooguit|niet meer dan|budget(?: van)?|under|below|up to|less than|at most|budget of)';

const BUDGET_PATTERNS: RegExp[] = [
  new RegExp(`${BUDGET_WORDS}\\s*${CUR_BEFORE}\\s*${NUM}`, 'i'),
  new RegExp(`${BUDGET_WORDS}\\s*${NUM}\\s*${CUR_AFTER}`, 'i'),
  new RegExp(`${CUR_BEFORE}\\s*${NUM}\\s*(?:per|/|p\\.?)\\s*(?:maand|mnd|month|mo|m)\\b`, 'i'),
  new RegExp(`${NUM}\\s*${CUR_AFTER}\\s*(?:per|/|p\\.?)\\s*(?:maand|mnd|month|mo|m)\\b`, 'i'),
];

function parseAmount(raw: string): number {
  return Math.round(Number(raw.replace(',', '.')) * 100);
}

function currencyOf(raw: string | undefined): 'EUR' | 'USD' {
  return raw && /\$|usd|dollar/i.test(raw) ? 'USD' : 'EUR';
}

interface Rule {
  re: RegExp;
  apply: (c: Constraints, m: RegExpMatchArray) => void;
  id: string;
}

const RULES: Rule[] = [
  {
    id: 'free',
    re: /\b(gratis|kosteloos|zonder kosten|geen budget|free of charge|for free|free tools?|no budget|zero budget|without paying|niks kosten|niets kosten)\b/i,
    apply: (c) => (c.freeOnly = true),
  },
  {
    id: 'beginner',
    re: /\b(beginner|beginnend|beginners|leek|geen ervaring|nooit eerder|nieuw in|new to|no experience|newbie|non[- ]technical|niet technisch|makkelijk|eenvoudig|simpel|easy to use|simple|weet niet welke|geen idee welke|(?:don'?t|do not) know (?:which|what|where)|no idea (?:which|what))\b/i,
    apply: (c) => (c.level = 'beginner'),
  },
  {
    id: 'advanced',
    re: /\b(ik ben (?:een )?(?:developer|ontwikkelaar|programmeur|expert)|i'?m an? (?:developer|engineer|expert)|as a developer|als developer|gevorderde gebruiker|power user|advanced user)\b/i,
    apply: (c) => (c.level = 'advanced'),
  },
  {
    id: 'eu',
    re: /\b(eu|europa|europe|europese|european|avg|gdpr|dataopslag in (?:de )?eu|data in (?:the )?eu|servers in europe)\b/i,
    apply: (c) => (c.eu = true),
  },
  {
    id: 'privacy',
    re: /\b(privacy|prive|vertrouwelijk|confidential|gevoelige data|sensitive data|niet trainen|no training)\b/i,
    apply: (c) => (c.privacy = true),
  },
  {
    id: 'dutch',
    re: /\b(nederlands|nederlandse|in het nederlands|dutch|in dutch|vlaams)\b/i,
    apply: (c) => (c.dutch = true),
  },
  { id: 'ios', re: /\b(iphone|ipad|ios)\b/i, apply: (c) => (c.platform = 'ios') },
  { id: 'android', re: /\b(android)\b/i, apply: (c) => (c.platform = 'android') },
  { id: 'macos', re: /\b(mac|macbook|macos|imac)\b/i, apply: (c) => (c.platform = 'macos') },
  { id: 'windows', re: /\b(windows|pc)\b/i, apply: (c) => (c.platform = 'windows') },
  { id: 'linux', re: /\b(linux|ubuntu)\b/i, apply: (c) => (c.platform = 'linux') },
  {
    id: 'no_watermark',
    re: /\b(zonder watermerk|geen watermerk|no watermark|without (?:a )?watermark|watermark[- ]free)\b/i,
    apply: (c) => (c.noWatermark = true),
  },
  {
    id: 'commercial',
    re: /\b(commercieel|commerciele|zakelijk|voor klanten|voor mijn bedrijf|commercial|for clients|for my business|business use)\b/i,
    apply: (c) => (c.commercial = true),
  },
  { id: 'open_source', re: /\b(open[- ]?source)\b/i, apply: (c) => (c.openSource = true) },
  { id: 'api', re: /\b(api|integreren in mijn app|integrate into my app|via code)\b/i, apply: (c) => (c.api = true) },
  {
    id: 'local',
    re: /\b(lokaal|offline|zonder cloud|op mijn eigen computer|eigen server|locally|on my own computer|without (?:the )?cloud|on[- ]prem(?:ise)?)\b/i,
    apply: (c) => {
      c.local = true;
      c.privacy = true;
    },
  },
];

export function parseConstraints(query: string): { constraints: Constraints; signals: Signal[] } {
  const c: Constraints = {};
  const signals: Signal[] = [];
  // Accent-free, lower-case, straight apostrophes (JS \b is ASCII-only).
  const q = query
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
    .toLowerCase();
  for (const re of BUDGET_PATTERNS) {
    const m = q.match(re);
    if (!m) continue;
    const num = m.slice(1).find((g) => g && /^\d/.test(g));
    const cur = m.slice(1).find((g) => g && !/^\d/.test(g));
    if (num) {
      c.budgetMonthlyCents = parseAmount(num);
      c.budgetCurrency = currencyOf(cur);
      signals.push({ kind: 'constraint', id: 'budget', phrase: m[0] });
      break;
    }
  }
  for (const rule of RULES) {
    const m = q.match(rule.re);
    if (m) {
      rule.apply(c, m);
      signals.push({ kind: 'constraint', id: rule.id, phrase: m[0] });
    }
  }
  const team = q.match(/\b(?:team (?:van|of)|met|with)\s*(\d{1,4})\s*(?:personen|mensen|collega'?s|people|users|gebruikers|members|leden)\b/i);
  if (team) {
    c.teamSize = Number(team[1]);
    signals.push({ kind: 'constraint', id: 'team', phrase: team[0] });
  }
  if (c.budgetMonthlyCents === 0) c.freeOnly = true;
  return { constraints: c, signals };
}

/* ───────────── Task, capability and tool detection ───────────── */

/** Constraint phrases say how, not what: they do not count towards the task ("onder €20 per maand"). */
const CONSTRAINT_ONLY = new Set(['budget', 'free', 'beginner', 'advanced', 'team', 'commercial', 'no_watermark']);

function withoutConstraintPhrases(query: string, signals: Signal[]): string {
  let q = query
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
    .toLowerCase();
  for (const s of signals) if (s.kind === 'constraint' && CONSTRAINT_ONLY.has(s.id)) q = q.split(s.phrase.toLowerCase()).join(' ');
  return q;
}

export function detectIntent(query: string, catalog: Catalog, locale: Locale): Intent {
  const normQuery = normalize(query);
  const queryStems = new Set(stems(query));
  const { constraints, signals } = parseConstraints(query);

  // Capabilities (synonyms in all locales; whole-phrase or strong stem match).
  const capabilityIds: string[] = [];
  for (const cap of catalog.capabilities) {
    let best: { phrase: string; score: number } | null = null;
    for (const text of Object.values(cap.text)) {
      if (!text) continue;
      for (const phrase of [text.name, ...text.synonyms]) {
        const ps = stems(phrase);
        if (ps.length === 0) continue;
        // Short synonyms must match contiguously ("ai video" ≠ "AI tools … videos");
        // longer ones may match as a set of stems in any order.
        const exact = containsPhrase(normQuery, phrase);
        const inter = ps.filter((s) => queryStems.has(s)).length;
        const score = exact ? 1 : ps.length >= 3 && inter === ps.length ? 0.85 : 0;
        if (score > 0 && (!best || score > best.score)) best = { phrase, score };
      }
    }
    if (best) {
      capabilityIds.push(cap.id);
      signals.push({ kind: 'capability', id: cap.id, phrase: best.phrase });
    }
  }

  // Tasks: weighted phrase and vocabulary match (lexicon.ts), supported by detected capabilities.
  const taskScores = new Map(scoreTasks(withoutConstraintPhrases(query, signals), taskIndex(catalog)).map((s) => [s.id, s]));
  const scored = catalog.tasks.map((task) => {
    const s = taskScores.get(task.id);
    const taskCaps = new Set(task.steps.flatMap((x) => x.capabilityIds));
    const requiredCaps = new Set(task.steps.filter((x) => x.required).flatMap((x) => x.capabilityIds));
    const support = capabilityIds.filter((c) => taskCaps.has(c)).length;
    const requiredSupport = capabilityIds.filter((c) => requiredCaps.has(c)).length;
    const bonus = s && s.score > 0 ? Math.min(0.15, support * 0.05 + requiredSupport * 0.05) : 0;
    return { task, score: Math.min(1, (s?.score ?? 0) + bonus), phrase: s?.phrase ?? '' };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const runnerUp = scored[1];
  // A near-tie is a question ("did you mean…"), not a guess.
  const margin = top && runnerUp ? top.score - runnerUp.score : 1;
  const taskId = top && top.score >= 0.5 && (margin >= 0.05 || top.score >= 0.8) ? top.task.id : null;
  if (taskId && top) signals.push({ kind: 'task', id: taskId, phrase: top.phrase });

  // Tool mentions ("like Canva", "instead of ChatGPT").
  const toolIds: string[] = [];
  const toks = new Set(tokens(query, { keepStopwords: true }));
  for (const tool of catalog.tools) {
    const names = [tool.name, ...tool.aliases].map(normalize);
    if (names.some((n) => n.length >= 3 && (toks.has(n) || containsPhrase(normQuery, n)))) {
      toolIds.push(tool.id);
      signals.push({ kind: 'tool', id: tool.id, phrase: tool.name });
    }
  }
  const avoid = /\b(in plaats van|instead of|alternatief voor|alternative to|zonder|without|geen)\s+([\w .-]{2,40})/i.exec(query);
  if (avoid) {
    const target = normalize(avoid[2]!);
    const avoided = catalog.tools.filter((t) => [t.name, ...t.aliases].some((n) => target.startsWith(normalize(n))));
    if (avoided.length) constraints.avoidToolIds = avoided.map((t) => t.id);
  }

  // Confidence: task certainty, margin over the runner-up and supporting signals.
  let confidence = 0;
  if (taskId && top) {
    const margin = runnerUp ? top.score - runnerUp.score : top.score;
    confidence = Math.min(0.97, 0.45 + top.score * 0.4 + Math.min(0.15, margin * 0.5));
  } else if (capabilityIds.length) {
    confidence = Math.min(0.6, 0.3 + capabilityIds.length * 0.1);
  }

  return {
    query,
    locale,
    taskId,
    taskScore: top?.score ?? 0,
    runnerUpTaskId: runnerUp && runnerUp.score >= 0.5 ? runnerUp.task.id : null,
    taskCandidates: scored
      .filter((x) => x.score >= 0.3)
      .slice(0, 4)
      .map((x) => ({ id: x.task.id, score: Math.round(x.score * 100) / 100 })),
    capabilityIds,
    toolIds,
    constraints,
    confidence: Math.round(confidence * 100) / 100,
    engine: 'lexical',
    signals,
  };
}

/** Merge explicit UI constraints (chips/URL) over detected ones. */
export function mergeConstraints(detected: Constraints, explicit: Constraints): Constraints {
  const out: Constraints = { ...detected };
  for (const [k, v] of Object.entries(explicit) as [keyof Constraints, unknown][]) {
    if (v !== undefined && v !== null && v !== '') (out as Record<string, unknown>)[k] = v;
  }
  if (out.budgetMonthlyCents === 0) out.freeOnly = true;
  return out;
}
