/**
 * A logo stored with a tool (tool scout, `tools.logo`) in the shape the
 * site's ToolMark reads: the brand colour only where it keeps 3:1 against
 * the mark's tile in that theme, else null (the mark is drawn in ink). The
 * same rule as scripts/generate-logos.ts for data/logos.json; a test keeps
 * them identical.
 */
import type { ToolLogo } from '@/generated/logos';

/** The mark's tile in each theme (--surface-2 with a light world tint). */
export const TILE = { light: '#f4f0ea', dark: '#211f2e' } as const;

/** WCAG contrast of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The brand colour where it reaches 3:1 against the tile, else null. */
export function brandColour(hex: string, tile: string): string | null {
  return contrast(`#${hex}`, tile) >= 3 ? `#${hex.toLowerCase()}` : null;
}

const HEX = /^[0-9a-f]{6}$/i;
/** SVG path data only: commands, numbers, separators. */
const PATH = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\-\s]{1,20000}$/;

/** A stored logo as the site shows it; null when the stored value is not a valid logo. */
export function toToolLogo(stored: unknown): ToolLogo | null {
  if (!stored || typeof stored !== 'object') return null;
  const s = stored as { title?: unknown; hex?: unknown; path?: unknown };
  if (typeof s.title !== 'string' || typeof s.hex !== 'string' || typeof s.path !== 'string') return null;
  if (!HEX.test(s.hex) || !PATH.test(s.path) || s.title.length > 100) return null;
  return { title: s.title, light: brandColour(s.hex, TILE.light), dark: brandColour(s.hex, TILE.dark), path: s.path };
}
