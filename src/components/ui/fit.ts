import type { CSSProperties } from 'react';

/**
 * Display type that fits its box: the longest word's length as --len, so the
 * CSS can size the words to the box's width (worked out from the viewport,
 * app/bold.css) and no word ever overflows (.tile-title, .tool-banner-title).
 */
export function fitStyle(text: string): CSSProperties {
  const longest = Math.max(4, ...text.split(/\s+/).map((w) => [...w].length));
  return { ['--len' as string]: String(longest) };
}
