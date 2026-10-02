import { describe, expect, it } from 'vitest';
import { candidateKey, nameFromTitle, parseGithub, parseHn } from '@/agents/defs/discovery';
import { classify } from '@/agents/defs/video';
import { decodeEntities, parseChannelFeed } from '@/agents/lib/youtube';
import { band, precisionByBand, wilsonLower } from '@/agents/defs/audit';
import { noNewNumbers } from '@/agents/defs/content';
import { mentions } from '@/agents/defs/social';
import { duplicatePairs } from '@/agents/defs/duplicate';
import { validateTemplate } from '@/lib/monetization/template';
import { gate, score } from '@/agents/defs/verification';
import { inLlmHoldout, LLM_HOLDOUT_PCT } from '@/lib/engine/match';
import { bearer, safeEqual } from '@/lib/security/secrets';
import { recommend } from '@/lib/reports/weekly';
import { channelOf } from '@/lib/analytics/visitor';

describe('discovery parsing (external JSON is untrusted)', () => {
  it('keys candidates by registrable domain, or by path on platforms', () => {
    expect(candidateKey('https://www.voxnova.ai/pricing?x=1')).toEqual({ url: 'https://www.voxnova.ai/', domain: 'voxnova.ai' });
    expect(candidateKey('https://github.com/acme/agent-kit/tree/main')?.domain).toBe('github.com/acme/agent-kit');
    expect(candidateKey('https://github.com/acme')).toBeNull();
    expect(candidateKey('https://youtube.com/watch?v=1')).toBeNull();
    expect(candidateKey('javascript:alert(1)')).toBeNull();
  });
  it('extracts a name from a Show HN title', () => {
    expect(nameFromTitle('Show HN: VoxNova – open-source AI voice cloning')).toBe('VoxNova');
    expect(nameFromTitle('Show HN: Pixelwise, an AI image upscaler')).toBe('Pixelwise');
  });
  it('keeps only AI launches with a URL and survives junk', () => {
    const json = {
      hits: [
        { objectID: '1', title: 'Show HN: VoxNova – AI voice cloning', url: 'https://voxnova.ai', points: 80, num_comments: 12, created_at_i: 1 },
        { objectID: '2', title: 'Show HN: My bike shed', url: 'https://bikes.example', points: 90, created_at_i: 1 },
        { objectID: '3', title: 'Show HN: LLM notebook', url: null, created_at_i: 1 },
        { nonsense: true },
      ],
    };
    const out = parseHn(json);
    expect(out.map((c) => c.domain)).toEqual(['voxnova.ai']);
    expect(out[0]!.signals.hnPoints).toBe(80);
    expect(parseHn({ unexpected: 'shape' })).toEqual([]);
  });
  it('prefers a repository homepage and drops forks, archives and small repos', () => {
    const json = {
      items: [
        { full_name: 'a/tool', name: 'tool', html_url: 'https://github.com/a/tool', homepage: 'https://tool.dev', stargazers_count: 900, created_at: '2026-09-01', owner: { type: 'Organization' } },
        { full_name: 'b/fork', name: 'fork', html_url: 'https://github.com/b/fork', stargazers_count: 5000, fork: true, created_at: '2026-09-01', owner: { type: 'Organization' } },
        { full_name: 'c/small', name: 'small', html_url: 'https://github.com/c/small', stargazers_count: 10, created_at: '2026-09-01', owner: { type: 'Organization' } },
        { full_name: 'd/nohome', name: 'nohome', html_url: 'https://github.com/d/nohome', homepage: '', stargazers_count: 400, created_at: '2026-09-01', owner: { type: 'Organization' } },
        // A person's repository: never kept (the user name is personal data).
        { full_name: 'e/mine', name: 'mine', html_url: 'https://github.com/e/mine', homepage: 'https://mine.dev', stargazers_count: 4000, created_at: '2026-09-01', owner: { type: 'User' } },
      ],
    };
    expect(parseGithub(json, 300).map((c) => c.domain)).toEqual(['tool.dev', 'github.com/d/nohome']);
  });
});

describe('verification gates', () => {
  const page = (title: string, text: string) => ({ title, description: null, text, links: [] });
  it('rejects blocklisted, parked and non-AI pages', () => {
    expect(gate(page('Best casino bonus', 'AI slots'))).toBe('blocklist');
    expect(gate(page('example.ai', 'This domain is for sale'))).toBe('parked');
    expect(gate(page('Bakery', 'Fresh bread daily'))).toBe('not_ai');
    expect(gate(page('Scribe', 'AI transcription for meetings'))).toBeNull();
  });
  it('scores reachability, evidence and traction', () => {
    expect(score({ https: true, description: true, pricingPage: true, legal: 2, signals: { hnPoints: 60 } }).score).toBe(100);
    expect(score({ https: false, description: false, pricingPage: false, legal: 0, signals: {} }).score).toBe(40);
  });
});

describe('video helpers', () => {
  it('parses a channel feed and classifies titles', () => {
    const xml = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><title>Chan</title>
      <entry><yt:videoId>abcdefghijk</yt:videoId><yt:channelId>UCxxxxxxxxxxxxxxxxxxxxxx</yt:channelId><title>Launch &amp; demo</title><published>2026-09-01T10:00:00Z</published><author><name>Acme</name></author></entry>
      <entry><yt:videoId>bad</yt:videoId><title>skip</title></entry></feed>`;
    const out = parseChannelFeed(xml);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ videoId: 'abcdefghijk', channelTitle: 'Acme' });
    expect(classify('ElevenLabs vs Murf: which is better?')).toBe('comparison');
    expect(classify('Descript tutorial for beginners')).toBe('tutorial');
    expect(classify('Honest Canva review')).toBe('review');
    expect(classify('We tried everything')).toBe('other');
    expect(decodeEntities('Tom&#39;s &amp; Jerry&quot;s')).toBe(`Tom's & Jerry"s`);
  });
});

describe('audit statistics', () => {
  it('computes a Wilson lower bound and precision per band', () => {
    expect(wilsonLower(20, 20)).toBeGreaterThan(0.83);
    expect(wilsonLower(20, 20)).toBeLessThan(0.85);
    expect(wilsonLower(19, 20)).toBeCloseTo(0.764, 2);
    expect(wilsonLower(0, 0)).toBe(0);
    expect(band(97)).toBe('95+');
    expect(band(85)).toBe('80-94');
    const items = [
      { actionId: '1', action: 'x', toolId: null, confidence: 96, decision: 'auto_published', sourceUrl: null, at: '', verdict: 'correct' as const },
      { actionId: '2', action: 'x', toolId: null, confidence: 98, decision: 'auto_published', sourceUrl: null, at: '', verdict: 'incorrect' as const },
      { actionId: '3', action: 'x', toolId: null, confidence: 85, decision: 'auto_published', sourceUrl: null, at: '', verdict: 'unsure' as const },
    ];
    expect(precisionByBand(items)).toEqual([{ band: '95+', n: 2, correct: 1, precision: 0.5, lower: wilsonLower(1, 2) }]);
  });
});

describe('small guards', () => {
  it('rejects drafts that introduce numbers', () => {
    expect(noNewNumbers('Plans from $10 per month', 'Pro costs $10/month')).toBe(true);
    expect(noNewNumbers('Supports 40 languages', 'Supports many languages')).toBe(false);
    expect(noNewNumbers('Costs 12,50 euro', 'Costs 12.50 euro')).toBe(true);
  });
  it('matches tool names on word boundaries only', () => {
    expect(mentions('Why I switched to Claude for coding', 'Claude')).toBe(true);
    expect(mentions('Claudette is a bakery', 'Claude')).toBe(false);
    expect(mentions('Notion AI review', 'Notion AI')).toBe(true);
  });
  it('flags duplicate tools by host or name', () => {
    const list = [
      { id: 'a', slug: 'a', name: 'VoxNova', aliases: [], websiteUrl: 'https://voxnova.ai' },
      { id: 'b', slug: 'b', name: 'Vox Nova', aliases: ['voxnova'], websiteUrl: 'https://www.voxnova.ai/app' },
      { id: 'c', slug: 'c', name: 'Gemini', aliases: [], websiteUrl: 'https://gemini.google.com' },
      { id: 'd', slug: 'd', name: 'NotebookLM', aliases: [], websiteUrl: 'https://notebooklm.google.com' },
    ];
    const pairs = duplicatePairs(list);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: 'a', b: 'b' });
  });
  it('keeps product pages on one shared host apart, but not a site and its own page', () => {
    const list = [
      { id: 'a', slug: 'a', name: 'Express', aliases: [], websiteUrl: 'https://www.adobe.com/express/' },
      { id: 'b', slug: 'b', name: 'Photoshop', aliases: [], websiteUrl: 'https://www.adobe.com/products/photoshop.html' },
      { id: 'c', slug: 'c', name: 'Whisper', aliases: [], websiteUrl: 'https://github.com/openai/whisper' },
      { id: 'd', slug: 'd', name: 'Gemini CLI', aliases: [], websiteUrl: 'https://github.com/google-gemini/gemini-cli' },
      { id: 'e', slug: 'e', name: 'Whisper app', aliases: [], websiteUrl: 'https://github.com/openai/whisper/' },
      { id: 'f', slug: 'f', name: 'Foo', aliases: [], websiteUrl: 'https://foo.ai/' },
      { id: 'g', slug: 'g', name: 'Foo Studio', aliases: [], websiteUrl: 'https://foo.ai/studio' },
    ];
    expect(duplicatePairs(list).map((p) => `${p.a}-${p.b}:${p.reason}`)).toEqual(['c-e:same_host', 'f-g:same_host']);
  });
  it('validates affiliate templates before any request', () => {
    expect(validateTemplate('https://partner.example/x?sub={click_id}')).toBeNull();
    expect(validateTemplate('http://partner.example/x')).toBe('not_https');
    expect(validateTemplate('https://user:pw@partner.example/x')).toBe('credentials_in_url');
    expect(validateTemplate('not a url')).toBe('invalid_url');
  });
  it('assigns the LLM holdout stably and at roughly the configured share', () => {
    const at = new Date('2026-09-30T00:00:00Z');
    expect(inLlmHoldout('make videos', at)).toBe(inLlmHoldout('Make   videos', at));
    const share = Array.from({ length: 2000 }, (_, i) => inLlmHoldout(`query ${i}`, at)).filter(Boolean).length / 2000;
    expect(share).toBeGreaterThan(LLM_HOLDOUT_PCT / 100 - 0.03);
    expect(share).toBeLessThan(LLM_HOLDOUT_PCT / 100 + 0.03);
  });
  it('compares secrets in constant time and parses bearer tokens', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(bearer('Bearer tok_123')).toBe('tok_123');
    expect(bearer('Basic x')).toBeNull();
    expect(bearer(null)).toBeNull();
  });
  it('classifies AI assistants before search engines', () => {
    expect(channelOf('gemini.google.com', null)).toBe('ai');
    expect(channelOf('google.com', null)).toBe('organic');
    expect(channelOf('chatgpt.com', null)).toBe('ai');
    expect(channelOf(null, 'email')).toBe('email');
  });
});

describe('owner recommendations', () => {
  it('ranks urgent items first and caps at three', () => {
    const now = new Date('2026-09-30T08:00:00Z');
    const item = (id: string, severity: 'p1' | 'p2' | 'p3', dueInH: number | null, priority = 60) => ({
      id,
      kind: 'x',
      severity,
      category: 'data',
      title: id,
      reasonCode: null,
      defaultAction: null,
      dueAt: dueInH === null ? null : new Date(now.getTime() + dueInH * 3600_000).toISOString(),
      createdAt: now.toISOString(),
      groupCount: 1,
      priority,
      impact: null,
      toolId: null,
    });
    const recs = recommend(
      now,
      [item('late', 'p2', 200), item('soon', 'p2', 10), item('fire', 'p1', null)],
      [{ ...item('opp', 'p2', null), impact: { evCentsPerMonth: 9000 } }],
      [{ key: 'heartbeat', status: 'not_configured', message: null, lastCheckedAt: '', lastOkAt: null }],
      2500,
    );
    expect(recs.map((r) => r.ref)).toEqual(['fire', 'soon', 'heartbeat']);
  });
});
