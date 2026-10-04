/**
 * Plain-language guard: menu labels, page titles (h1), intros, buttons and
 * notices in Dutch and English stay readable for a 14-year-old
 * (docs/strategy/agents/B5-eenvoud.md; style guide in
 * docs/strategy/research-2026-10/06-taal-en-eenvoud.md). Every failure names
 * the locale and the message key, so the fix is one value in
 * src/i18n/messages/{nl,en}.json.
 *
 * The technical view ("Technisch" / "Advanced") may use technical words;
 * its keys are not checked here. Neither are admin texts, the API page for
 * developers and the crawler page for site owners.
 */
import { describe, expect, it } from 'vitest';
import { flattenKeys, lookup } from '@/i18n/format';
import { MESSAGES } from '@/i18n/server';

const LOCALES = ['nl', 'en'] as const;
type L = (typeof LOCALES)[number];

/** Menu, footer and other navigation labels: at most three words. */
const MENU = [
  'nav.match',
  'nav.explore',
  'nav.compare',
  'nav.doctor',
  'nav.pulse',
  'nav.learn',
  'nav.tasks',
  'nav.news',
  'nav.costs',
  'nav.menu',
  'nav.search',
  'common.more',
  'footer.about',
  'footer.methodology',
  'footer.disclosure',
  'footer.corrections',
  'footer.privacy',
  'footer.newsletter',
  'footer.api',
  'footer.pulse',
  'footer.tasks',
  'footer.categories',
  'start.breadcrumb',
  'learn.title',
  'glossary.title',
  'hub.levelGroup',
  'hub.levelBasis',
  'hub.levelAdvanced',
];

/** Short labels in dense places (header tabs, tool rows, filter chips): at most three words. */
const SHORT = [
  'hub.levelBasisShort',
  'hub.levelAdvancedShort',
  'hub.badgeBeginner',
  'hub.badgeAdvanced',
  'status.verified.label',
  'status.supported.label',
  'status.community.label',
  'status.unverified.label',
  'tool.addToCompare',
  'tool.freePlan',
  'pulse.all',
  'pulse.types.price',
  'pulse.types.plans',
  'pulse.types.product',
  'pulse.types.status',
  'pulse.types.news',
];

/** Page titles (h1). */
const H1 = [
  'home.heroTitle',
  'explorer.title',
  'compare.title',
  'pulse.title',
  'doctor.title',
  'costs.title',
  'tasks.title',
  'categories.title',
  'learn.title',
  'glossary.title',
  'news.title',
  'methodology.title',
  'disclosureInfo.title',
  'corrections.title',
  'about.title',
  'privacy.title',
  'newsletter.title',
  'myStack.title',
  'match.heading',
  'start.title1',
  'start.title2',
  'plans.title',
  'alternatives.title',
  'capability.title',
  'errors.notFoundTitle',
  'errors.errorTitle',
];

/** Buttons and calls to action. */
const BUTTONS = [
  'home.chooserShow',
  'match.submit',
  'match.apply',
  'match.startOver',
  'compare.submit',
  'compare.matchCta',
  'doctor.submit',
  'doctor.saveCta',
  'explorer.apply',
  'explorer.reset',
  'explorer.compareSelected',
  'explorer.emptyCta',
  'start.submit',
  'start.choose',
  'stack.save',
  'stack.watch',
  'stackPage.recompute',
  'stackPage.delete',
  'myStack.emptyCta',
  'subscribe.submit',
  'lead.submit',
  'corrections.submit',
  'hub.startPlan',
  'hub.startStack',
  'errors.retry',
  'errors.notFoundCta',
  'common.compare',
  'tool.addToCompare',
  'plans.watch',
];

/** Intros under titles and section texts that introduce a page or block. */
const INTRO_PATTERN = /(^|\.)(intro\d?|heroSub|worldsSub|fightsSub|startSub|radarSub|stageHint|taskIntro|fairFightIntro)$/;
/** Notices, empty states and messages after an action. */
const NOTICE_PATTERN =
  /(^|\.)(empty\w*|none|\w*Notice|staleBanner|needTwo|needTools|noMatch\w*|noCandidate|lowConfidence|relaxed|invalid|thanks|unavailable|failed|needsJs|rateLimited|sent|notFound\w*|errorBody|nothing|noVerdict|noPlans|historyEmpty|timelineEmpty|diffNone|cardNotRecorded|trulyFreeNone|summaryNone|unconvertedNote|noFx|budgetUnknown|confirmFailed|unsubscribeFailed)$/;

/** Not checked: owner screens, the developer API page, the crawler page, the technical view and e-mail bodies. */
const EXEMPT = /^(admin|apiPage|bot|digest|agentEvent)\.|^static\.apiTermsBody$|^hub\.(col\.|prompts\.api\.|levelAdvancedHint)/;

/**
 * Words a 14-year-old does not know, or English product names in the Dutch
 * site. Allowed only in the technical view (see EXEMPT).
 */
const JARGON: Record<L, [RegExp, string][]> = {
  nl: [
    [/\bstacks?\b/i, 'stack'],
    [/\bagents?\b/i, 'agent'],
    [/\bprovenance\b/i, 'provenance'],
    [/\bLLMs?\b/, 'LLM'],
    [/\bAPI\b/, 'API'],
    [/\bworkflows?\b/i, 'workflow'],
    [/\buse cases?\b/i, 'use case'],
    [/\bcriteri(um|a)\b/i, 'criterium'],
    [/\bcapabilit(y|ies)\b/i, 'capability'],
    [/\bquota\b/i, 'quota'],
    [/\bplan-?tier\b/i, 'plan-tier'],
    [/\bintegratie/i, 'integratie'],
    [/\bAdvanced\b/, 'Advanced'],
    [/\bPulse\b/, 'Pulse'],
    [/\bDoctor\b/, 'Doctor'],
    [/\bFair Fights?\b/i, 'Fair Fight'],
    [/\bMatch\b/, 'Match (productnaam)'],
    [/\bversheid\b/i, 'versheid'],
    [/\bgelogd\b/i, 'gelogd'],
    [/\baffiliate/i, 'affiliate'],
    [/\bgedetecteerd\b/i, 'gedetecteerd'],
    [/\bmethodologie\b/i, 'methodologie'],
  ],
  en: [
    [/\bstacks?\b/i, 'stack'],
    [/\bagents?\b/i, 'agent'],
    [/\bprovenance\b/i, 'provenance'],
    [/\bLLMs?\b/, 'LLM'],
    [/\bAPI\b/, 'API'],
    [/\bworkflows?\b/i, 'workflow'],
    [/\buse cases?\b/i, 'use case'],
    [/\bcriteri(on|a)\b/i, 'criterion'],
    [/\bcapabilit(y|ies)\b/i, 'capability'],
    [/\bquotas?\b/i, 'quota'],
    [/\btiers?\b/i, 'tier'],
    [/\bintegrations?\b/i, 'integration'],
    [/\bPulse\b/, 'Pulse'],
    [/\bDoctor\b/, 'Doctor'],
    [/\bFair Fights?\b/i, 'Fair Fight'],
    [/\bMatch\b/, 'Match (product name)'],
    [/\bfreshness\b/i, 'freshness'],
    [/\blogged\b/i, 'logged'],
    [/\baffiliate/i, 'affiliate'],
    [/\bdetected\b/i, 'detected'],
    [/\bmethodology\b/i, 'methodology'],
  ],
};

const MAX_MENU_WORDS = 3;
const MAX_SENTENCE_WORDS = 20;
/** Rule 1 asks for 12 words on average; intros and notices together stay at or under it. */
const MAX_AVERAGE_WORDS = 12;

/** Replace each top-level {placeholder} or {plural, …} by one word, so it counts once. */
function flatten(text: string): string {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '{') {
      if (depth === 0) out += 'X';
      depth++;
    } else if (ch === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

const words = (text: string) => flatten(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

/** Sentences: split after . ! ? … or a line break; a list line ("1. …") counts as its own sentence, without its number. */
function sentences(text: string): string[] {
  return flatten(text)
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+\.\s+/, ''))
    .flatMap((line) => line.split(/(?<=[.!?…])\s+/))
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

function value(locale: L, key: string): string {
  const v = lookup(MESSAGES[locale], key);
  if (v === undefined) throw new Error(`${locale} ${key}: key not found`);
  return v;
}

const keysOf = (locale: L) => flattenKeys(MESSAGES[locale]).filter((k) => !EXEMPT.test(k));
const introKeys = (locale: L) => keysOf(locale).filter((k) => INTRO_PATTERN.test(k));
const noticeKeys = (locale: L) => keysOf(locale).filter((k) => NOTICE_PATTERN.test(k));

function jargonIn(locale: L, key: string): string[] {
  const text = value(locale, key);
  return JARGON[locale].filter(([re]) => re.test(text)).map(([, name]) => `${locale} ${key}: "${name}" in "${text}"`);
}

describe('plain language (nl, en)', () => {
  it('knows every key it checks', () => {
    for (const locale of LOCALES) for (const key of [...MENU, ...SHORT, ...H1, ...BUTTONS]) expect(() => value(locale, key)).not.toThrow();
    for (const locale of LOCALES) {
      expect(introKeys(locale).length, locale).toBeGreaterThan(20);
      expect(noticeKeys(locale).length, locale).toBeGreaterThan(30);
    }
  });

  it(`menu labels and short labels have at most ${MAX_MENU_WORDS} words`, () => {
    const bad: string[] = [];
    for (const locale of LOCALES)
      for (const key of [...MENU, ...SHORT]) {
        const n = words(value(locale, key)).length;
        if (n > MAX_MENU_WORDS) bad.push(`${locale} ${key}: ${n} words in "${value(locale, key)}"`);
      }
    expect(bad).toEqual([]);
  });

  it('menu labels, titles, intros, buttons and notices use no jargon', () => {
    const bad: string[] = [];
    for (const locale of LOCALES) {
      const keys = new Set([...MENU, ...SHORT, ...H1, ...BUTTONS, ...introKeys(locale), ...noticeKeys(locale)]);
      for (const key of keys) bad.push(...jargonIn(locale, key));
    }
    expect(bad).toEqual([]);
  });

  it(`intros and notices have no sentence longer than ${MAX_SENTENCE_WORDS} words`, () => {
    const bad: string[] = [];
    for (const locale of LOCALES)
      for (const key of [...introKeys(locale), ...noticeKeys(locale)])
        for (const s of sentences(value(locale, key))) {
          const n = words(s).length;
          if (n > MAX_SENTENCE_WORDS) bad.push(`${locale} ${key}: ${n} words in "${s}"`);
        }
    expect(bad).toEqual([]);
  });

  it(`intros and notices average at most ${MAX_AVERAGE_WORDS} words per sentence`, () => {
    for (const locale of LOCALES) {
      const all = [...introKeys(locale), ...noticeKeys(locale)].flatMap((k) => sentences(value(locale, k)));
      const average = all.reduce((sum, s) => sum + words(s).length, 0) / all.length;
      expect(average, `${locale}: ${average.toFixed(1)} words per sentence on average`).toBeLessThanOrEqual(MAX_AVERAGE_WORDS);
    }
  });

  it('the guard itself catches what it should', () => {
    expect(words('Kies 2 tot 4 tools.')).toHaveLength(5);
    expect(words('{count, plural, one {# tool} other {# tools}} gevonden')).toHaveLength(2);
    expect(sentences('Kies een tool. Vergelijk ze! Klaar?\n1. Stap een')).toHaveLength(4);
    expect(JARGON.nl.some(([re]) => re.test('Je krijgt een onderbouwde stack'))).toBe(true);
    expect(JARGON.nl.some(([re]) => re.test('Bekijk de tools'))).toBe(false);
    expect(JARGON.en.some(([re]) => re.test('Best match'))).toBe(false);
  });
});
