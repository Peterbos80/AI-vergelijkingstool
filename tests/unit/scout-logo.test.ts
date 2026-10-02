/**
 * Logos for new tools: only an exact match on the tool's own domain, never a
 * namesake or a parent company; the colours follow the same 3:1 rule as the
 * generated list (scripts/generate-logos.ts).
 */
import { describe, expect, it } from 'vitest';
import { loadIcons, logoForDomain, type IconLike } from '@/agents/lib/scout/logo';
import { brandColour, TILE, toToolLogo } from '@/lib/logos/brand';
import { LOGOS } from '@/generated/logos';
import logosConfig from '../../data/logos.json';

const icon = (over: Partial<IconLike>): IconLike => ({ title: 'VoxNova', slug: 'voxnova', hex: '7C3AED', path: 'M0 0h24v24H0z', source: 'https://voxnova.ai/brand', ...over });

describe('logo by exact domain', () => {
  it('takes the one icon whose source or guidelines live on the tool’s own domain', () => {
    expect(logoForDomain('voxnova.ai', [icon({})], '16.33.0')).toEqual({ title: 'VoxNova', slug: 'voxnova', version: '16.33.0', hex: '7C3AED', path: 'M0 0h24v24H0z', source: 'https://voxnova.ai/brand', license: 'CC0-1.0' });
    expect(logoForDomain('voxnova.ai', [icon({ source: 'https://github.com/x/y', guidelines: 'https://www.voxnova.ai/press' })])?.slug).toBe('voxnova');
  });
  it('never matches on the name: a namesake on another domain is refused', () => {
    // Fathom Analytics (usefathom.com) is not the Fathom notetaker (fathom.video).
    expect(logoForDomain('fathom.video', [icon({ title: 'Fathom', slug: 'fathom', source: 'https://usefathom.com/brand' })])).toBeNull();
  });
  it('refuses a sub-domain source, two marks on one domain (a parent company), a platform, another license, bad data', () => {
    expect(logoForDomain('voxnova.ai', [icon({ source: 'https://brand.voxnova.ai/' })])).toBeNull();
    expect(logoForDomain('acme.com', [icon({ slug: 'a', source: 'https://acme.com/a' }), icon({ slug: 'b', source: 'https://acme.com/b' })])).toBeNull();
    expect(logoForDomain('github.com/acme/kit', [icon({ source: 'https://github.com/acme/kit' })])).toBeNull();
    expect(logoForDomain('voxnova.ai', [icon({ license: { type: 'CC-BY-4.0' } })])).toBeNull();
    expect(logoForDomain('voxnova.ai', [icon({ path: '<script>' })])).toBeNull();
    expect(logoForDomain('voxnova.ai', [icon({ hex: 'red' })])).toBeNull();
  });
  it('works on the real simple-icons collection', () => {
    const icons = loadIcons();
    expect(icons?.length).toBeGreaterThan(1000);
    expect(logoForDomain('elevenlabs.io', icons!)?.title).toBe('ElevenLabs');
    expect(logoForDomain('notion.so', icons!)?.title).toBe('Notion');
    expect(logoForDomain('usefathom.com', icons!)?.title).toBe('Fathom');
    expect(logoForDomain('fathom.video', icons!)).toBeNull();
  });
});

describe('brand colour where it stays readable', () => {
  it('gives the same colours as the generated list for every logo in data/logos.json', () => {
    const bySlug = new Map((loadIcons() ?? []).map((i) => [i.slug, i]));
    for (const [tool, slug] of Object.entries(logosConfig.logos)) {
      const i = bySlug.get(slug)!;
      expect([brandColour(i.hex, TILE.light), brandColour(i.hex, TILE.dark)], tool).toEqual([LOGOS[tool]!.light, LOGOS[tool]!.dark]);
    }
  });
  it('turns a stored logo into what ToolMark reads, and refuses junk', () => {
    expect(toToolLogo({ title: 'VoxNova', hex: '7C3AED', path: 'M0 0h24v24H0z' })).toEqual({ title: 'VoxNova', light: '#7c3aed', dark: null, path: 'M0 0h24v24H0z' }); // about 2.8:1 on the dark tile: ink there
    expect(toToolLogo({ title: 'Ink', hex: '000000', path: 'M0 0h1z' })).toEqual({ title: 'Ink', light: '#000000', dark: null, path: 'M0 0h1z' });
    expect(toToolLogo({ title: 'X', hex: '000000', path: '"/><script>' })).toBeNull();
    expect(toToolLogo(null)).toBeNull();
    expect(toToolLogo('logo')).toBeNull();
  });
});
