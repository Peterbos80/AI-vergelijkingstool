/**
 * The public site uses the SVG icon set (components/ui/Icon), never emoji:
 * emoji render differently per OS and look like a template. Admin screens
 * are internal and exempt.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Icon, ICON_NAMES } from '@/components/ui/Icon';
import { EVENT_ICON } from '@/lib/catalog/events';
import { CATEGORY_ICON } from '@/components/start/category-icons';
import { MESSAGES } from '@/i18n/server';
import { flattenKeys } from '@/i18n/format';

const ROOT = join(__dirname, '../..');
const EXEMPT = ['src/app/admin/', 'src/components/admin/'];
// Pictographs plus the emoji presentation selector.
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css|json)$/.test(name) ? [p] : [];
  });
}

describe('icons instead of emoji', () => {
  it('no emoji in the public source', () => {
    const hits: string[] = [];
    for (const file of files(join(ROOT, 'src'))) {
      const rel = relative(ROOT, file).replaceAll('\\', '/');
      if (EXEMPT.some((e) => rel.startsWith(e)) || rel.startsWith('src/i18n/messages/')) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (EMOJI.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 80)}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it('no emoji in public UI messages', () => {
    const hits: string[] = [];
    for (const [locale, tree] of Object.entries(MESSAGES)) {
      for (const key of flattenKeys(tree)) {
        if (key.startsWith('admin.')) continue;
        const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], tree);
        if (typeof value === 'string' && EMOJI.test(value)) hits.push(`${locale}:${key}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('every event kind and category has an icon from the set', () => {
    for (const name of [...Object.values(EVENT_ICON), ...Object.values(CATEGORY_ICON)]) expect(ICON_NAMES).toContain(name);
  });

  it('icons are decorative SVG next to text', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'search', size: 16 }));
    expect(html).toMatch(/^<svg [^>]*aria-hidden="true"/);
    expect(html).toContain('focusable="false"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="1.5"');
  });
});
