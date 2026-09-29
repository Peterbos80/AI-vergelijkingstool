import { describe, expect, it } from 'vitest';
import { containsPhrase, editDistance, normalize, stem, stemOverlap, tokens } from '@/lib/engine/text';

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
});
