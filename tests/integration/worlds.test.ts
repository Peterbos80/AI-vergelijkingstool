/** The home stage: questions find their world from the taxonomy's own words. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../setup/pglite';
import type { Database } from '@/lib/db/client';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import { loadCatalog } from '@/lib/catalog/load';
import type { Catalog } from '@/lib/catalog/types';
import { detectWorld, worldIndex, worldLexicon } from '@/lib/worlds';

let db: Database;
let close: () => Promise<void>;
let catalog: Catalog;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  await applySeed(db, loadSeedData(), new Date('2026-09-30T08:00:00Z'));
  catalog = await loadCatalog(db, 1, new Date('2026-09-30T12:00:00Z'));
});
afterAll(async () => close());

const NL: [string, string | null][] = [
  ['ik wil social video\'s maken voor mijn bedrijf', 'video'],
  ['ik wil gratis mijn vergaderingen laten notuleren', 'research'],
  ['een logo voor mijn bakkerij', 'image'],
  ['podcast opnemen en bewerken', 'audio'],
  ['een website bouwen zonder code', 'code'],
  ['klantenservice chatbot voor mijn webshop', 'business'],
  ['nieuwsbrief versturen naar klanten', 'marketing'],
  ['mijn sollicitatiebrief verbeteren', 'writing'],
  ['werk automatiseren tussen apps', 'automation'],
  ['een slimme assistent voor dagelijks werk', 'assistant'],
  ['ondertiteling toevoegen aan een filmpje', 'video'],
  ['achtergrond van een foto verwijderen', 'image'],
  ['vid', 'video'],
  ['hallo', null],
  ['', null],
];

const EN: [string, string | null][] = [
  ['turn my long webinar into shorts', 'video'],
  ['transcribe interviews', 'audio'],
  ['write blog posts that rank', 'writing'],
  ['help me code faster', 'code'],
];

describe('world detection', () => {
  it('finds the world of plain Dutch questions, and stays put when unsure', () => {
    const index = worldIndex(worldLexicon(catalog, 'nl'));
    const wrong = NL.filter(([q, w]) => (detectWorld(q, index)?.world ?? null) !== w).map(([q, w]) => `${q} → ${detectWorld(q, index)?.world ?? null} (expected ${w})`);
    expect(wrong).toEqual([]);
  });

  it('works in English too', () => {
    const index = worldIndex(worldLexicon(catalog, 'en'));
    const wrong = EN.filter(([q, w]) => (detectWorld(q, index)?.world ?? null) !== w).map(([q, w]) => `${q} → ${detectWorld(q, index)?.world ?? null} (expected ${w})`);
    expect(wrong).toEqual([]);
  });

  it('keeps the lexicon small enough to ship to the browser', () => {
    const size = JSON.stringify(worldLexicon(catalog, 'nl')).length;
    expect(size).toBeLessThan(14_000);
  });
});
