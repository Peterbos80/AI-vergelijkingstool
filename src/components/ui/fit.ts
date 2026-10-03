import type { CSSProperties } from 'react';

/**
 * Display type that fits its box: the longest word's length as --len, so the
 * CSS can size the words to their container and no word ever overflows
 * (app/bold.css: .tile-title, .tool-banner-title).
 */
export function fitStyle(text: string): CSSProperties {
  const longest = Math.max(4, ...text.split(/\s+/).map((w) => [...w].length));
  return { ['--len' as string]: String(longest) };
}
