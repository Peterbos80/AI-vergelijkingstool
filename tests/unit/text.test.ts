import { describe, expect, it } from 'vitest';
import { commonPrefix, containsPhrase, damerau, editDistance, normalize, splitCompound, stem, stemOverlap, tokens } from '@/lib/engine/text';

describe('text normalisation', () => {
  it('normalises accents, quotes and case', () => {
    expect(normalize("Video's maken — met Één klik!")).toBe('videos maken met een klik');
  });
  it('drops stopwords', () => {
    expect(tokens('Ik wil een video maken voor TikTok')).toEqual(['video', 'maken', 'tiktok']);
  });
  it('stems plural and verb forms to a shared root', () => {
    expect(stem('vergaderingen')).toBe(stem('vergadering'));
    expect(stem('stories')).toBe(stem('story'));
    expect(stem('subtitles')).toBe(stem('subtitle'));
    expect(stem('ondertitels')).toBe(stem('ondertitel'));
    expect(stem('videos')).toBe('video');
  });
  it('matches phrases on word boundaries only', () => {
    expect(containsPhrase('ik wil een logo ontwerpen', 'logo')).toBe(true);
    expect(containsPhrase('prologo', 'logo')).toBe(false);
  });
  it('measures similarity and typos', () => {
    expect(stemOverlap('meetings notuleren', 'notulen van vergaderingen')).toBeGreaterThanOrEqual(0);
    expect(editDistance('chatgtp', 'chatgpt')).toBe(2);
    expect(editDistance('midjourney', 'canva', 3)).toBe(4);
  });
  it('brings Dutch diminutives back to their base word', () => {
    expect(stem('logootje')).toBe(stem('logo'));
    expect(stem('filmpjes')).toBe(stem('film'));
    expect(stem('bedrijfje')).toBe(stem('bedrijf'));
    expect(stem('blogjes')).toBe(stem('blog'));
    expect(stem('plaatjes')).toBe(stem('plaat'));
    expect(stem('appje')).toBe(stem('app'));
    expect(stem('balletje')).toBe(stem('bal'));
  });
  it('counts a swap of two letters as one typo', () => {
    expect(damerau('websiet', 'websit')).toBe(1);
    expect(damerau('presentatei', 'presentatie')).toBe(1);
    expect(damerau('ab', 'ba')).toBe(1);
    expect(damerau('midjourney', 'canva', 2)).toBe(3);
    expect(commonPrefix('programmeur', 'programmer')).toBe(9);
  });
  it('splits Dutch compounds into known parts', () => {
    const known = new Set(['vergader', 'verslag', 'bedrijf', 'logo', 'product', 'afbeeld']);
    const k = (p: string) => known.has(stem(p));
    expect(splitCompound('vergaderverslagen', k)).toEqual(['vergader', 'verslagen']);
    expect(splitCompound('bedrijfslogo', k)).toEqual(['bedrijfs', 'logo']);
    expect(splitCompound('productafbeeldingen', k)).toEqual(['product', 'afbeeldingen']);
    expect(splitCompound('kapsalon', k)).toBeNull();
  });
});
