import { describe, expect, it } from 'vitest';
import { canonicalUrl, cleanTitle, isAboutAi, NEWS_PEOPLE, NEWS_SOURCES, peopleIn } from '@/lib/news';

describe('news sources and people', () => {
  it('are valid, unique and use the publishers’ own feeds over HTTPS', () => {
    expect(new Set(NEWS_SOURCES.map((s) => s.id)).size).toBe(NEWS_SOURCES.length);
    expect(new Set(NEWS_PEOPLE.map((p) => p.id)).size).toBe(NEWS_PEOPLE.length);
    for (const s of NEWS_SOURCES) expect(s.url.startsWith('https://'), s.id).toBe(true);
    for (const s of NEWS_SOURCES.filter((x) => x.kind === 'video')) expect(s.url).toMatch(/^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC[\w-]{22}$/);
    for (const p of NEWS_PEOPLE) expect(p.role.nl && p.role.en, p.id).toBeTruthy();
  });
});

describe('news rules', () => {
  it('recognises AI headlines', () => {
    expect(isAboutAi('OpenAI launches a new model')).toBe(true);
    expect(isAboutAi('Kabinet wil regels voor kunstmatige intelligentie')).toBe(true);
    expect(isAboutAi('Nvidia shares jump as AI demand grows')).toBe(true);
    expect(isAboutAi('New folding phone goes on sale')).toBe(false);
    expect(isAboutAi('Fair play in football')).toBe(false);
  });
  it('tags watched experts by full name or surname, as whole words', () => {
    expect(peopleIn('Geoffrey Hinton warns about AI')).toEqual(['geoffrey-hinton']);
    expect(peopleIn('Why Hinton and Bengio disagree with LeCun')).toEqual(['geoffrey-hinton', 'yoshua-bengio', 'yann-lecun']);
    expect(peopleIn('fei-fei li on spatial intelligence')).toEqual(['fei-fei-li']);
    expect(peopleIn('Altmann bakery opens')).toEqual([]);
    expect(peopleIn('hinton (lowercase surname alone)')).toEqual([]);
  });
  it('keeps one URL per story and only web links', () => {
    expect(canonicalUrl('https://www.bbc.com/news/a1?utm_source=rss&at_medium=feed#top')).toBe('https://www.bbc.com/news/a1');
    expect(canonicalUrl('https://youtu.be/abcdefghijk')).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    expect(canonicalUrl('https://www.youtube.com/watch?v=abcdefghijk&t=10')).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    expect(canonicalUrl('javascript:alert(1)')).toBeNull();
    expect(canonicalUrl('not a url')).toBeNull();
  });
  it('turns feed titles into plain text', () => {
    expect(cleanTitle('AI &amp; jobs: &#8216;a shift&#8217; <b>now</b>')).toBe('AI & jobs: ‘a shift’ now');
    expect(cleanTitle('  many\n  spaces ')).toBe('many spaces');
  });
});
