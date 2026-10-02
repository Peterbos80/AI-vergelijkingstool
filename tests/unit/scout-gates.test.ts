/**
 * The hard gates of quarantine publication, each one on its own
 * (docs/strategy/12 §4.4). Function certainty is tested against the real
 * taxonomy in tests/integration/scout.test.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  anchoredFacts,
  blockedDomainGate,
  contentGate,
  duplicateGate,
  nameGate,
  popularity,
  siteGate,
  siteQuote,
  skillLevelOf,
} from '@/agents/lib/scout/gates';
import type { FetchResult } from '@/agents/fetcher/types';

const ok = (finalUrl: string): FetchResult => ({ ok: true, url: finalUrl, finalUrl, status: 200, contentType: 'text/html', body: '<html></html>', durationMs: 1, redirects: [] });
const failed = (errorKind: FetchResult['errorKind'], status: number | null = null): FetchResult => ({ ok: false, url: 'x', finalUrl: 'x', status, contentType: null, body: '', durationMs: 1, redirects: [], errorKind });
const page = (title: string, description: string | null, text = '') => ({ title, description, text, links: [] });

describe('gate 1: the official site', () => {
  it('passes an HTTPS site on its own domain, also after a redirect within that domain', () => {
    expect(siteGate('voxnova.ai', ok('https://www.voxnova.ai/en'))).toEqual({ ok: true });
  });
  it('fails without a domain of its own, over plain HTTP, after a redirect to another domain, or when robots.txt says no', () => {
    expect(siteGate('github.com/acme/kit', ok('https://github.com/acme/kit'))).toMatchObject({ ok: false, reason: 'no_own_domain' });
    expect(siteGate('voxnova.ai', ok('http://voxnova.ai/'))).toMatchObject({ ok: false, reason: 'not_https', hard: true });
    expect(siteGate('voxnova.ai', ok('https://other-brand.com/'))).toMatchObject({ ok: false, reason: 'foreign_redirect', hard: true });
    expect(siteGate('voxnova.ai', failed('robots'))).toMatchObject({ ok: false, reason: 'robots', hard: true });
  });
  it('treats a network error as possibly temporary, a 404 as gone', () => {
    expect(siteGate('voxnova.ai', failed('network'))).toMatchObject({ ok: false, reason: 'unreachable', hard: false });
    expect(siteGate('voxnova.ai', failed('timeout'))).toMatchObject({ ok: false, reason: 'unreachable', hard: false });
    expect(siteGate('voxnova.ai', failed('http', 404))).toMatchObject({ ok: false, reason: 'unreachable', hard: true });
  });
});

describe('gate 2: no duplicate', () => {
  const known = [{ id: 't1', name: 'Descript', aliases: ['Descript Studio'], websiteUrl: 'https://www.descript.com/' }];
  it('rejects the same domain, name or alias, also written differently', () => {
    expect(duplicateGate('descript.com', ['Something'], known)).toMatchObject({ ok: false, reason: 'duplicate_domain', toolId: 't1' });
    expect(duplicateGate('descript.ai', ['descript'], known)).toMatchObject({ ok: false, reason: 'duplicate_name', toolId: 't1' });
    expect(duplicateGate('studio.example', ['Descript-Studio'], known)).toMatchObject({ ok: false, reason: 'duplicate_name' });
  });
  it('passes a new domain and name', () => {
    expect(duplicateGate('voxnova.ai', ['VoxNova'], known)).toEqual({ ok: true });
  });
});

describe('gate 3: blocklist, parked domains, AI, waitlist', () => {
  it("rejects the owner's blocked domains and their sub-domains", () => {
    expect(blockedDomainGate('spam.example', ['spam.example'])).toMatchObject({ ok: false, reason: 'blocked_domain' });
    expect(blockedDomainGate('app.spam.example', ['spam.example'])).toMatchObject({ ok: false, reason: 'blocked_domain' });
    expect(blockedDomainGate('voxnova.ai', ['spam.example'])).toEqual({ ok: true });
  });
  it('rejects blocked categories, parked domains, non-AI sites and waitlists', () => {
    expect(contentGate(page('LuckySpin AI casino bonus', null))).toMatchObject({ ok: false, reason: 'blocklist' });
    expect(contentGate(page('voxnova.ai', null, 'This domain is for sale'))).toMatchObject({ ok: false, reason: 'parked' });
    expect(contentGate(page('Bakery', 'Fresh bread every day'))).toMatchObject({ ok: false, reason: 'not_ai' });
    expect(contentGate(page('VoxNova — join the waitlist', 'AI voices, coming soon'))).toMatchObject({ ok: false, reason: 'waitlist' });
    expect(contentGate(page('VoxNova — AI voice generator', 'Turn text into speech'))).toEqual({ ok: true });
  });
});

describe('gate 4: the name is on the official site', () => {
  it("finds the name as a whole word and returns the site's own spelling", () => {
    expect(nameGate('voxnova', page('VoxNova — AI voice generator', null))).toEqual({ ok: true, name: 'VoxNova' });
    expect(nameGate('browser-use', page('Browser Use: AI agents for the web', null))).toEqual({ ok: true, name: 'Browser Use' });
    expect(nameGate('Tessa', page('Bookkeeping', 'Tessa does your books with AI'))).toEqual({ ok: true, name: 'Tessa' });
  });
  it('rejects a name that is not there, or only inside another word', () => {
    expect(nameGate('Flow', page('Workflow automation with AI', null))).toMatchObject({ ok: false, reason: 'name_not_on_site' });
    expect(nameGate('I built an AI', page('Acme', null))).toMatchObject({ ok: false, reason: 'name_not_on_site' });
  });
});

describe('gate 5: at least two independent popularity signals', () => {
  it('counts HN ≥ 50 points and GitHub ≥ 300 stars, each with its link and date', () => {
    const p = popularity({ hnId: '41001', hnPoints: 231, hnAt: 1_790_000_000, githubRepo: 'acme/kit', githubStars: 4200 }, new Date('2026-09-30T10:00:00Z'));
    expect(p.ok).toBe(true);
    expect(p.signals).toEqual([
      { kind: 'hackernews', value: 231, url: 'https://news.ycombinator.com/item?id=41001', at: new Date(1_790_000_000_000).toISOString(), label: null },
      { kind: 'github', value: 4200, url: 'https://github.com/acme/kit', at: '2026-09-30T10:00:00.000Z', label: null },
    ]);
  });
  it('counts an official announcement plus one other signal', () => {
    const p = popularity({ announcementUrl: 'https://openai.com/index/sora', announcementAt: '2026-09-30T08:00:00Z', announcementFeed: 'openai', phVotes: 420, phUrl: 'https://www.producthunt.com/posts/sora' });
    expect(p.ok).toBe(true);
    expect(p.signals.find((s) => s.kind === 'announcement')?.label).toBe('OpenAI');
  });
  it('rejects one signal, signals under the threshold, and never invents a value', () => {
    expect(popularity({ hnId: '1', hnPoints: 400 }).ok).toBe(false);
    expect(popularity({ hnId: '1', hnPoints: 49, githubRepo: 'acme/kit', githubStars: 299 }).ok).toBe(false);
    expect(popularity({ hnPoints: 400, githubStars: 5000 }).ok).toBe(false); // no source to link to
    expect(popularity({}).signals).toEqual([]);
  });
});

describe('gate 6: at least one anchored fact with its source', () => {
  const home = { url: 'https://voxnova.ai/', text: 'AI voices for creators.' };
  it('anchors a free plan and a public price on the pricing page, verbatim', () => {
    const facts = anchoredFacts({ pricing: { url: 'https://voxnova.ai/pricing', text: 'Plans\nFree\n$0\nfor hobby projects\nPro\n$10/month' }, home });
    expect(facts.map((f) => [f.key, f.url, f.sourceType])).toEqual([
      ['has_free_tier', 'https://voxnova.ai/pricing', 'official'],
      ['pricing_public', 'https://voxnova.ai/pricing', 'official'],
    ]);
    for (const f of facts) expect(f.evidence.length).toBeLessThanOrEqual(160);
    expect(facts[1]!.evidence).toContain('$10/month');
  });
  it('anchors an open-source license from the GitHub API', () => {
    expect(anchoredFacts({ pricing: null, home, githubRepo: 'acme/kit', githubLicense: 'MIT' })).toEqual([
      { key: 'open_source', value: true, evidence: 'License: MIT (GitHub API)', url: 'https://github.com/acme/kit', sourceType: 'github' },
    ]);
  });
  it('finds nothing in vague marketing text, a free trial, or a license that is not open source', () => {
    expect(anchoredFacts({ pricing: null, home: { url: 'https://voxnova.ai/', text: 'Start your free trial. Feel free to contact sales.' } })).toEqual([]);
    expect(anchoredFacts({ pricing: null, home, githubRepo: 'acme/kit', githubLicense: 'NOASSERTION' })).toEqual([]);
  });
});

describe('what a new tool shows', () => {
  it("quotes the site's meta description literally, at most 160 characters", () => {
    expect(siteQuote('Turn text into natural speech with AI voices.')).toBe('Turn text into natural speech with AI voices.');
    const long = siteQuote(`${'Natural AI voices for every creator and every language. '.repeat(5)}`)!;
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith('…')).toBe(true);
    expect(siteQuote('<b>Hi</b>')).toBeNull();
    expect(siteQuote(null)).toBeNull();
  });
  it('never calls a new tool easy: "advanced" in developer terms, otherwise "intermediate"', () => {
    expect(skillLevelOf(page('VoxNova', 'AI voices for creators'), false)).toBe('intermediate');
    expect(skillLevelOf(page('VoxNova API', 'Voice SDK for developers'), false)).toBe('advanced');
    expect(skillLevelOf(page('Kit', 'Agents'), true)).toBe('advanced');
  });
});
