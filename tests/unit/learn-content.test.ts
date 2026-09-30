import { describe, expect, it } from 'vitest';
import { GLOSSARY, glossaryText } from '@/content/glossary';
import { findLearnGuide, LEARN, learnText } from '@/content/learn';

describe('beginner content', () => {
  it('has every guide in Dutch and English with unique slugs', () => {
    for (const locale of ['nl', 'en'] as const) {
      const slugs = LEARN.map((g) => learnText(g, locale)!.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const g of LEARN) {
        const x = learnText(g, locale)!;
        expect(x.sections.length, `${g.id}.${locale}`).toBeGreaterThanOrEqual(3);
        expect(findLearnGuide(x.slug, locale)?.id).toBe(g.id);
      }
    }
  });
  it('explains every glossary term in Dutch and English, and marks technical ones', () => {
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
    for (const g of GLOSSARY) {
      expect(g.text.nl?.def.length, g.id).toBeGreaterThan(30);
      expect(g.text.en?.def.length, g.id).toBeGreaterThan(30);
    }
    expect(GLOSSARY.filter((g) => g.advanced).map((g) => g.id)).toEqual(expect.arrayContaining(['api', 'token', 'context-window']));
    expect(glossaryText(GLOSSARY[0]!, 'de')).toBe(GLOSSARY[0]!.text.en);
  });
});
