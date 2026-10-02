/**
 * A logo for a new tool, only on an exact domain match (brief B6 §4): a
 * simple-icons icon belongs to a tool only when the hostname of the icon's
 * `source` or `guidelines` equals the tool's own registrable domain. Never
 * by name (Fathom Analytics is not the Fathom notetaker), never a parent
 * company's mark (two icons on one domain: no logo), never a page on a
 * platform. Only icons under CC0 (the collection's license); the path is
 * stored with the tool and served by the site itself (no hotlinks).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { StoredLogo } from '@/lib/db/schema';
import logosConfig from '../../../../data/logos.json';
import { ownDomain } from './sources';

export interface IconLike {
  title: string;
  slug: string;
  hex: string;
  path: string;
  source: string;
  guidelines?: string;
  license?: { type: string; url?: string };
}

const HEX = /^[0-9a-f]{6}$/i;
const PATH = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\-\s]{1,20000}$/;

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname.toLowerCase().replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

/** The one icon whose source or guidelines live on exactly this domain, else null. */
export function logoForDomain(domain: string, icons: Iterable<IconLike>, version: string = logosConfig.version): StoredLogo | null {
  if (!ownDomain(domain)) return null;
  const want = domain.toLowerCase().replace(/^www\./, '');
  const hits: IconLike[] = [];
  for (const icon of icons) {
    if (!icon || typeof icon.slug !== 'string') continue;
    if (hostOf(icon.source) === want || hostOf(icon.guidelines) === want) hits.push(icon);
  }
  if (hits.length !== 1) return null; // none, or several marks on one domain (a parent company's family): no logo
  const icon = hits[0]!;
  if (icon.license && icon.license.type !== 'CC0-1.0') return null;
  if (!HEX.test(icon.hex) || !PATH.test(icon.path) || typeof icon.title !== 'string' || icon.title.length > 100) return null;
  return { title: icon.title, slug: icon.slug, version, hex: icon.hex.toUpperCase(), path: icon.path, source: icon.source, license: 'CC0-1.0' };
}

/**
 * The simple-icons collection (a dev dependency, present where the agents
 * run in GitHub Actions). Loaded at run time by a computed name, so the web
 * server bundle never includes it; null where it is not installed (no logos).
 */
export function loadIcons(): IconLike[] | null {
  try {
    const req = createRequire(join(process.cwd(), 'package.json'));
    const mod = req(['simple', 'icons'].join('-')) as Record<string, unknown>;
    return Object.values(mod).filter((i): i is IconLike => Boolean(i) && typeof i === 'object' && typeof (i as IconLike).slug === 'string');
  } catch {
    return null;
  }
}
