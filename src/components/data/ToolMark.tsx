import type { CatalogTool } from '@/lib/catalog/types';
import type { SceneId } from '@/lib/world-ids';
import { LOGOS } from '@/generated/logos';

/**
 * A tool's identity mark: its logo where we may show it (data/logos.json,
 * served from this site), otherwise two letters. The tile takes the tint of
 * the tool's world. Decorative: the name is always next to it.
 */
export function ToolMark({ tool, world, size = 40, className }: { tool: Pick<CatalogTool, 'slug' | 'name'>; world?: SceneId; size?: number; className?: string }) {
  const logo = LOGOS[tool.slug];
  return (
    <span aria-hidden="true" className={className ? `mark ${className}` : 'mark'} data-world={world === 'home' ? undefined : world} style={{ ['--mark' as string]: `${size}px` }}>
      {logo ? (
        <svg viewBox="0 0 24 24" className="mark-logo" focusable="false">
          <path d={logo.path} />
        </svg>
      ) : (
        <span className="mark-letters">{markLetters(tool.name)}</span>
      )}
    </span>
  );
}

/**
 * Two letters, like an element symbol: initials for two words ("Adobe
 * Express" → AE), the first letter and the next capital for compounds
 * ("ChatGPT" → CG, "HeyGen" → HG), else the first two letters ("Canva" → Ca).
 * Suffixes such as "AI", ".ai" and parentheses are left out.
 */
export function markLetters(name: string): string {
  const base = name
    .replace(/\(.*?\)/g, ' ')
    .replace(/\.(ai|new|io|app)\b/gi, ' ')
    .replace(/\b(ai)\b/gi, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim();
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  const w = words[0] ?? name;
  const inner = w.slice(1).search(/\p{Lu}/u);
  if (inner >= 0) return (w[0]! + w[inner + 1]!).toUpperCase();
  return w.length > 1 ? w[0]!.toUpperCase() + w[1]!.toLowerCase() : w.toUpperCase() || '?';
}
