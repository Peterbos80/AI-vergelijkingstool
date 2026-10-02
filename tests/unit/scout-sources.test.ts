/**
 * Tool scout sources: every parser gets untrusted input (junk, wrong shapes,
 * invalid JSON) and keeps only names, URLs, counts and dates.
 */
import { describe, expect, it } from 'vitest';
import {
  candidateKey,
  canonicalPostUrl,
  cleanName,
  feedLinks,
  hnStoriesByUrl,
  launchName,
  launchesIn,
  mergeSignals,
  ownDomain,
  parseGithub,
  parseHn,
  parseProductHunt,
  productLinkFromPost,
} from '@/agents/lib/scout/sources';
import { SCOUT_CONFIG } from '@/agents/lib/scout/config';

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

describe('candidate keys and names', () => {
  it('keeps products, drops news outlets, directories, social networks and personal pages', () => {
    expect(candidateKey('https://www.voxnova.ai/pricing')?.domain).toBe('voxnova.ai');
    expect(candidateKey('https://acme.vercel.app/demo')?.domain).toBe('acme.vercel.app');
    expect(candidateKey('https://www.theverge.com/ai/1')).toBeNull();
    expect(candidateKey('https://theresanaiforthat.com/ai/voxnova')).toBeNull();
    expect(candidateKey('https://www.futurepedia.io/tool/x')).toBeNull();
    expect(candidateKey('https://jane.github.io/thing')).toBeNull();
    expect(candidateKey('https://medium.com/@jane/my-ai')).toBeNull();
    expect(candidateKey('https://user:pw@voxnova.ai/')).toBeNull();
    expect(candidateKey('https://voxnova.ai:8443/')).toBeNull();
  });
  it('knows which candidates have a domain of their own', () => {
    expect(ownDomain('voxnova.ai')).toBe(true);
    expect(ownDomain('github.com/acme/kit')).toBe(false);
    expect(ownDomain('acme.vercel.app')).toBe(false);
  });
  it('accepts product names, not sentences or markup', () => {
    expect(cleanName('VoxNova')).toBe('VoxNova');
    expect(cleanName('  Pixel   Wise ')).toBe('Pixel Wise');
    expect(cleanName('I built an AI that writes my emails')).toBeNull();
    expect(cleanName('<script>x</script>')).toBe('script x /script');
    expect(cleanName('a'.repeat(61))).toBeNull();
    expect(cleanName('!!!')).toBeNull();
  });
});

describe('Hacker News (Algolia API)', () => {
  const hits = {
    hits: [
      { objectID: '1', title: 'Show HN: VoxNova – AI voice cloning', url: 'https://voxnova.ai', points: 80, num_comments: 12, created_at_i: 1_790_000_000, author: 'jane' },
      { objectID: '2', title: 'Show HN: My bike shed', url: 'https://bikes.example', points: 90, created_at_i: 1 },
      { objectID: '3', title: 'Show HN: LLM notebook', url: null, created_at_i: 1 },
      { objectID: '4', title: 'Show HN: Agent kit for LLM apps', url: 'https://github.com/jane/agent-kit', points: 300, created_at_i: 1 },
      { objectID: 'not-a-number', title: 'Show HN: Evil AI', url: 'https://evil.example', created_at_i: 1 },
      { nonsense: true },
    ],
  };
  it('keeps AI launches with a product URL and never the author or a personal repository', () => {
    const out = parseHn(hits, 'show');
    expect(out.map((c) => c.domain)).toEqual(['voxnova.ai']);
    expect(out[0]).toMatchObject({ name: 'VoxNova', sourceUrl: 'https://news.ycombinator.com/item?id=1', signals: { hnId: '1', hnPoints: 80, hnComments: 12, hnAt: 1_790_000_000 } });
    expect(JSON.stringify(out)).not.toContain('jane');
  });
  it('keeps stories only when they launch a named AI product', () => {
    const stories = {
      hits: [
        { objectID: '10', title: 'Launch HN: Tessa (YC W26) – AI bookkeeping for small firms', url: 'https://tessa.app', points: 120, created_at_i: 5 },
        { objectID: '11', title: 'Introducing Lumen: an AI agent for spreadsheets', url: 'https://lumen.so/blog/launch', points: 220, created_at_i: 5 },
        { objectID: '12', title: 'OpenAI releases a new model', url: 'https://www.theverge.com/ai/2', points: 900, created_at_i: 5 },
        { objectID: '13', title: 'Why AI agents fail', url: 'https://essay.example', points: 400, created_at_i: 5 },
        { objectID: '14', title: 'Show HN: Something AI', url: 'https://something.example', points: 400, created_at_i: 5 },
        { objectID: '15', title: 'Introducing Lowpts AI', url: 'https://lowpts.example', points: 10, created_at_i: 5 },
      ],
    };
    expect(parseHn(stories, 'story', 50).map((c) => [c.name, c.domain])).toEqual([
      ['Tessa', 'tessa.app'],
      ['Lumen', 'lumen.so'],
    ]);
  });
  it('maps stories to their link for joining with launch posts', () => {
    const m = hnStoriesByUrl({ hits: [{ objectID: '7', title: 'Introducing Sora', url: 'https://openai.com/index/sora/?utm_source=hn', points: 640, created_at_i: 9 }] });
    expect(m.get('https://openai.com/index/sora')).toMatchObject({ hnId: '7', hnPoints: 640 });
  });
  it('survives invalid JSON and unexpected shapes', () => {
    expect(parseHn(parse('{"hits": [ {"objectID": '))).toEqual([]);
    expect(parseHn(parse('null'))).toEqual([]);
    expect(parseHn({ hits: 'nope' })).toEqual([]);
    expect(hnStoriesByUrl(parse('<html>'))).toEqual(new Map());
  });
});

describe('GitHub search API', () => {
  const repo = (over: Record<string, unknown>) => ({
    full_name: 'acme/tool',
    name: 'tool',
    html_url: 'https://github.com/acme/tool',
    homepage: 'https://tool.dev',
    stargazers_count: 900,
    created_at: '2026-09-20T10:00:00Z',
    owner: { login: 'acme', type: 'Organization' },
    license: { spdx_id: 'MIT' },
    ...over,
  });
  it('keeps new repositories of organisations, prefers the homepage, records the license', () => {
    const out = parseGithub({ items: [repo({})] }, 300);
    expect(out).toEqual([
      {
        name: 'tool',
        url: 'https://tool.dev/',
        domain: 'tool.dev',
        source: 'github',
        sourceUrl: 'https://github.com/acme/tool',
        signals: { githubStars: 900, githubRepo: 'acme/tool', githubCreated: '2026-09-20T10:00:00Z', githubLicense: 'MIT' },
      },
    ]);
  });
  it("never keeps a person's repository, forks, archives or small repositories", () => {
    const items = [
      repo({ full_name: 'jane/thing', owner: { login: 'jane', type: 'User' }, homepage: 'https://thing.dev' }),
      repo({ full_name: 'acme/fork', fork: true }),
      repo({ full_name: 'acme/old', archived: true }),
      repo({ full_name: 'acme/small', stargazers_count: 10 }),
      repo({ full_name: 'acme/noowner', owner: undefined }),
      repo({ full_name: 'acme/nohome', name: 'nohome', html_url: 'https://github.com/acme/nohome', homepage: '', license: null }),
      { junk: true },
    ];
    const out = parseGithub({ items }, 300);
    expect(out.map((c) => c.domain)).toEqual(['github.com/acme/nohome']);
    expect(out[0]!.signals.githubLicense).toBeNull();
    expect(JSON.stringify(out)).not.toContain('jane');
  });
  it('survives invalid JSON', () => {
    expect(parseGithub(parse('{"items": [}'), 300)).toEqual([]);
    expect(parseGithub({ items: [{ full_name: 1 }] }, 300)).toEqual([]);
  });
});

describe('Product Hunt API', () => {
  const node = (over: Record<string, unknown>) => ({
    id: '101',
    name: 'Pagewise',
    url: 'https://www.producthunt.com/posts/pagewise',
    website: 'https://www.producthunt.com/r/ABC123',
    votesCount: 420,
    createdAt: '2026-09-30T07:01:00Z',
    topics: { edges: [{ node: { slug: 'artificial-intelligence' } }, { node: { slug: 'productivity' } }] },
    makers: [{ name: 'Jane Doe', username: 'jane' }],
    tagline: 'Copied marketing text',
    ...over,
  });
  it('keeps AI launches with enough votes; never the makers or the tagline', () => {
    const json = { data: { posts: { edges: [{ node: node({}) }, { node: node({ id: '102', votesCount: 5 }) }, { node: node({ id: '103', topics: { edges: [{ node: { slug: 'fintech' } }] } }) }] } } };
    const out = parseProductHunt(json, 50);
    expect(out).toEqual([{ name: 'Pagewise', website: 'https://www.producthunt.com/r/ABC123', signals: { phId: '101', phVotes: 420, phAt: '2026-09-30T07:01:00Z', phUrl: 'https://www.producthunt.com/posts/pagewise' } }]);
    expect(JSON.stringify(out)).not.toMatch(/jane|Copied/i);
  });
  it('survives invalid JSON and GraphQL errors', () => {
    expect(parseProductHunt(parse('{"data": '), 50)).toEqual([]);
    expect(parseProductHunt({ errors: [{ message: 'rate limited' }] }, 50)).toEqual([]);
    expect(parseProductHunt({ data: { posts: { edges: [{ node: node({ url: 'https://evil.example/posts/x' }) }] } } }, 50)).toEqual([]);
  });
});

describe("makers' own feeds", () => {
  it('reads the product name from launch titles only', () => {
    expect(launchName('Introducing Sora')).toBe('Sora');
    expect(launchName('Introducing the Codex app: work with agents')).toBe('Codex app');
    expect(launchName('Meet Flow, our AI filmmaking tool')).toBe('Flow');
    expect(launchName('Gemini Live is now available in Dutch')).toBe('Gemini Live');
    expect(launchName('How we think about safety')).toBeNull();
    // Not a product name: too long. (Shorter non-products fail later: no product link, no name on the site.)
    expect(launchName('Introducing our 2026 report on how people use AI at work every day')).toBeNull();
  });
  it('keeps launches inside the window, with a link', () => {
    const since = new Date('2026-09-29T00:00:00Z');
    const items = [
      { id: 'a', title: 'Introducing Sora', link: 'https://openai.com/index/sora/', date: new Date('2026-09-30T10:00:00Z') },
      { id: 'https://huggingface.co/blog/smolchat', title: 'Introducing SmolChat', link: null, date: new Date('2026-09-30T09:00:00Z') },
      { id: 'b', title: 'Introducing Old', link: 'https://openai.com/index/old/', date: new Date('2026-09-01T10:00:00Z') },
      { id: 'c', title: 'Introducing Undated', link: 'https://openai.com/index/undated/', date: null },
    ];
    expect(launchesIn(items, since).map((l) => [l.name, l.postUrl])).toEqual([
      ['Sora', 'https://openai.com/index/sora'],
      ['SmolChat', 'https://huggingface.co/blog/smolchat'],
    ]);
  });
  it('finds the launched product among the links of a post, never a news site or the blog itself', () => {
    const html = `<html><body><nav><a href="/news">News</a><a href="https://openai.com/sora-blog">Sora on our blog</a></nav>
      <p>Sora is here. <a href="https://sora.com/">Try Sora</a> or read <a href="https://www.theverge.com/sora">The Verge on Sora</a>.</p>
      <a href="https://sora.com/explore">Explore Sora</a><a href="https://x.com/openai">Follow us</a></body></html>`;
    expect(productLinkFromPost(html, 'https://openai.com/index/sora', 'Sora')).toEqual({ url: 'https://sora.com/', domain: 'sora.com' });
    expect(productLinkFromPost('<a href="https://other.example">Other</a>', 'https://openai.com/index/sora', 'Sora')).toBeNull();
    const tie = '<a href="https://a.example/sora">Sora</a><a href="https://b.example/sora">Sora</a>';
    expect(productLinkFromPost(tie, 'https://openai.com/index/sora', 'Sora')).toBeNull();
  });
  it("finds a site's own feed, never one on another domain", () => {
    const html = `<head><link rel="alternate" type="application/rss+xml" href="/blog/rss.xml"><link rel="alternate" type="application/atom+xml" href="https://feeds.other.example/x"></head>`;
    expect(feedLinks(html, 'https://www.voxnova.ai/')).toEqual(['https://www.voxnova.ai/blog/rss.xml']);
  });
  it('lists only makers with their own https feed', () => {
    expect(SCOUT_CONFIG.officialFeeds.length).toBeGreaterThan(3);
    for (const f of SCOUT_CONFIG.officialFeeds) expect(f.url.startsWith('https://')).toBe(true);
  });
});

describe('merging signals', () => {
  it('keeps the highest count per source and the first launch post', () => {
    let s: Record<string, unknown> = { hnId: '1', hnPoints: 80, dossier: { kept: true } };
    s = mergeSignals(s, { hnId: '2', hnPoints: 30 });
    expect(s).toMatchObject({ hnId: '1', hnPoints: 80, dossier: { kept: true } });
    s = mergeSignals(s, { hnId: '3', hnPoints: 140, hnComments: 9, hnAt: 5 });
    expect(s).toMatchObject({ hnId: '3', hnPoints: 140 });
    s = mergeSignals(s, { announcementUrl: 'https://a.example/1', announcementAt: '2026-09-30T00:00:00Z', announcementFeed: 'openai' });
    s = mergeSignals(s, { announcementUrl: 'https://a.example/2', announcementAt: '2026-10-01T00:00:00Z', announcementFeed: 'openai' });
    expect(s.announcementUrl).toBe('https://a.example/1');
    s = mergeSignals(s, { githubRepo: 'acme/x', githubStars: 500 });
    expect(s.githubStars).toBe(500);
  });
  it('canonicalises post URLs for joining', () => {
    expect(canonicalPostUrl('http://www.Example.com/a/?utm_source=x&id=2#top')).toBe('https://example.com/a/?id=2');
    expect(canonicalPostUrl('https://example.com/a/')).toBe('https://example.com/a');
    expect(canonicalPostUrl('javascript:alert(1)')).toBeNull();
  });
});
