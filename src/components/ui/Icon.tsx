/**
 * The icon set: inline SVG on a 24px grid, stroked in currentColor, always
 * aria-hidden. An icon sits next to text, or its button carries an aria-label.
 * Sizes 16 / 20 / 24 / 32; stroke 1.75 (1.5 at 16px). No emoji anywhere.
 *
 * Paths are taken from Lucide 1.49.0 (https://lucide.dev), except `dial`
 * (our logo's dial, drawn here). Lucide is licensed under the ISC License:
 *
 *   Copyright (c) 2026 Lucide Icons and Contributors
 *
 *   Permission to use, copy, modify, and/or distribute this software for any
 *   purpose with or without fee is hereby granted, provided that the above
 *   copyright notice and this permission notice appear in all copies.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 *   WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 *   MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 *   ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 *   WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 *   ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 *   OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * arrow-left, arrow-right, arrow-up-right, check, chevron-down, chevron-right,
 * corner-down-left, info, monitor, search, server, smartphone, terminal and x
 * are Lucide icons derived from Feather, under the MIT License:
 *
 *   Copyright (c) 2013-present Cole Bemis
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to permit
 *   persons to whom the Software is furnished to do so, subject to the
 *   following conditions: The above copyright notice and this permission
 *   notice shall be included in all copies or substantial portions of the
 *   Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
 *   NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 *   DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 *   OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 *   USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Works in server and client components (no hooks, no server-only imports).
 */
import { createElement } from 'react';

type Shape = readonly [tag: 'path' | 'circle' | 'rect' | 'line', attrs: Readonly<Record<string, string>>];

const ICONS = {
  'message-square': [['path', { d: 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z' }]],
  'pen-line': [['path', { d: 'M13 21h8' }], ['path', { d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' }]],
  'book-open': [['path', { d: 'M12 5v16' }], ['path', { d: 'M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z' }]],
  'image': [['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2', ry: '2' }], ['circle', { cx: '9', cy: '9', r: '2' }], ['path', { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' }]],
  'clapperboard': [['path', { d: 'm12.296 3.464 3.02 3.956' }], ['path', { d: 'M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z' }], ['path', { d: 'M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }], ['path', { d: 'm6.18 5.276 3.1 3.899' }]],
  'audio-lines': [['path', { d: 'M2 10v3' }], ['path', { d: 'M6 6v11' }], ['path', { d: 'M10 3v18' }], ['path', { d: 'M14 8v7' }], ['path', { d: 'M18 5v13' }], ['path', { d: 'M22 10v3' }]],
  'code-xml': [['path', { d: 'm18 16 4-4-4-4' }], ['path', { d: 'm6 8-4 4 4 4' }], ['path', { d: 'm14.5 4-5 16' }]],
  'workflow': [['rect', { width: '8', height: '8', x: '3', y: '3', rx: '2' }], ['path', { d: 'M7 11v4a2 2 0 0 0 2 2h4' }], ['rect', { width: '8', height: '8', x: '13', y: '13', rx: '2' }]],
  'megaphone': [['path', { d: 'M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z' }], ['path', { d: 'M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14' }], ['path', { d: 'M8 6v8' }]],
  'headset': [['path', { d: 'M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z' }], ['path', { d: 'M21 16v2a4 4 0 0 1-4 4h-5' }]],
  'layout-grid': [['rect', { width: '7', height: '7', x: '3', y: '3', rx: '1' }], ['rect', { width: '7', height: '7', x: '14', y: '3', rx: '1' }], ['rect', { width: '7', height: '7', x: '14', y: '14', rx: '1' }], ['rect', { width: '7', height: '7', x: '3', y: '14', rx: '1' }]],
  'search': [['path', { d: 'm21 21-4.34-4.34' }], ['circle', { cx: '11', cy: '11', r: '8' }]],
  'menu': [['path', { d: 'M4 5h16' }], ['path', { d: 'M4 12h16' }], ['path', { d: 'M4 19h16' }]],
  'x': [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]],
  'arrow-right': [['path', { d: 'M5 12h14' }], ['path', { d: 'm12 5 7 7-7 7' }]],
  'arrow-left': [['path', { d: 'm12 19-7-7 7-7' }], ['path', { d: 'M19 12H5' }]],
  'arrow-up-right': [['path', { d: 'M7 7h10v10' }], ['path', { d: 'M7 17 17 7' }]],
  'chevron-down': [['path', { d: 'm6 9 6 6 6-6' }]],
  'chevron-right': [['path', { d: 'm9 18 6-6-6-6' }]],
  'columns-2': [['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }], ['path', { d: 'M12 3v18' }]],
  'sliders-horizontal': [['path', { d: 'M10 5H3' }], ['path', { d: 'M12 19H3' }], ['path', { d: 'M14 3v4' }], ['path', { d: 'M16 17v4' }], ['path', { d: 'M21 12h-9' }], ['path', { d: 'M21 19h-5' }], ['path', { d: 'M21 5h-7' }], ['path', { d: 'M8 10v4' }], ['path', { d: 'M8 12H3' }]],
  'bookmark': [['path', { d: 'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z' }]],
  'share-2': [['circle', { cx: '18', cy: '5', r: '3' }], ['circle', { cx: '6', cy: '12', r: '3' }], ['circle', { cx: '18', cy: '19', r: '3' }], ['line', { x1: '8.59', x2: '15.42', y1: '13.51', y2: '17.49' }], ['line', { x1: '15.41', x2: '8.59', y1: '6.51', y2: '10.49' }]],
  'check': [['path', { d: 'M20 6 9 17l-5-5' }]],
  'corner-down-left': [['path', { d: 'M20 4v7a4 4 0 0 1-4 4H4' }], ['path', { d: 'm9 10-5 5 5 5' }]],
  'triangle-alert': [['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }], ['path', { d: 'M12 9v4' }], ['path', { d: 'M12 17h.01' }]],
  'info': [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'M12 16v-4' }], ['path', { d: 'M12 8h.01' }]],
  'zap': [['path', { d: 'M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z' }]],
  'radar': [['path', { d: 'M19.07 4.93A10 10 0 0 0 6.99 3.34' }], ['path', { d: 'M4 6h.01' }], ['path', { d: 'M2.29 9.62A10 10 0 1 0 21.31 8.35' }], ['path', { d: 'M16.24 7.76A6 6 0 1 0 8.23 16.67' }], ['path', { d: 'M12 18h.01' }], ['path', { d: 'M17.99 11.66A6 6 0 0 1 15.77 16.67' }], ['circle', { cx: '12', cy: '12', r: '2' }], ['path', { d: 'm13.41 10.59 5.66-5.66' }]],
  'badge-check': [['path', { d: 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z' }], ['path', { d: 'm16 9-5.5 5.5L8 12' }]],
  'files': [['path', { d: 'M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8' }], ['path', { d: 'M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z' }], ['path', { d: 'M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1' }]],
  'users': [['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }], ['path', { d: 'M16 3.128a4 4 0 0 1 0 7.744' }], ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }], ['circle', { cx: '9', cy: '7', r: '4' }]],
  'circle-dashed': [['path', { d: 'M10.1 2.182a10 10 0 0 1 3.8 0' }], ['path', { d: 'M13.9 21.818a10 10 0 0 1-3.8 0' }], ['path', { d: 'M17.609 3.721a10 10 0 0 1 2.69 2.7' }], ['path', { d: 'M2.182 13.9a10 10 0 0 1 0-3.8' }], ['path', { d: 'M20.279 17.609a10 10 0 0 1-2.7 2.69' }], ['path', { d: 'M21.818 10.1a10 10 0 0 1 0 3.8' }], ['path', { d: 'M3.721 6.391a10 10 0 0 1 2.7-2.69' }], ['path', { d: 'M6.391 20.279a10 10 0 0 1-2.69-2.7' }]],
  'receipt': [['path', { d: 'M12 17V7' }], ['path', { d: 'M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8' }], ['path', { d: 'M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z' }]],
  'trending-up': [['path', { d: 'M16 7h6v6' }], ['path', { d: 'm22 7-8.5 8.5-5-5L2 17' }]],
  'trending-down': [['path', { d: 'M16 17h6v-6' }], ['path', { d: 'm22 17-8.5-8.5-5 5L2 7' }]],
  'list-plus': [['path', { d: 'M16 5H3' }], ['path', { d: 'M11 12H3' }], ['path', { d: 'M16 19H3' }], ['path', { d: 'M18 9v6' }], ['path', { d: 'M21 12h-6' }]],
  'list-minus': [['path', { d: 'M16 5H3' }], ['path', { d: 'M11 12H3' }], ['path', { d: 'M16 19H3' }], ['path', { d: 'M21 12h-6' }]],
  'gift': [['path', { d: 'M12 7v14' }], ['path', { d: 'M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8' }], ['path', { d: 'M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5' }], ['rect', { x: '3', y: '7', width: '18', height: '4', rx: '1' }]],
  'circle-slash': [['circle', { cx: '12', cy: '12', r: '10' }], ['line', { x1: '9', x2: '15', y1: '15', y2: '9' }]],
  'square-plus': [['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }], ['path', { d: 'M8 12h8' }], ['path', { d: 'M12 8v8' }]],
  'tag': [['path', { d: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z' }], ['circle', { cx: '7.5', cy: '7.5', r: '.5', fill: 'currentColor' }]],
  'power-off': [['path', { d: 'M18.36 6.64A9 9 0 0 1 20.77 15' }], ['path', { d: 'M6.16 6.16a9 9 0 1 0 12.68 12.68' }], ['path', { d: 'M12 2v4' }], ['path', { d: 'm2 2 20 20' }]],
  'unplug': [['path', { d: 'm19 5 3-3' }], ['path', { d: 'm2 22 3-3' }], ['path', { d: 'M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z' }], ['path', { d: 'M7.5 13.5 10 11' }], ['path', { d: 'M10.5 16.5 13 14' }], ['path', { d: 'm12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z' }]],
  'plug': [['path', { d: 'M12 22v-5' }], ['path', { d: 'M15 8V2' }], ['path', { d: 'M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z' }], ['path', { d: 'M9 8V2' }]],
  'newspaper': [['path', { d: 'M15 18h-5' }], ['path', { d: 'M18 14h-8' }], ['path', { d: 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2' }], ['rect', { width: '8', height: '4', x: '10', y: '6', rx: '1' }]],
  'play': [['path', { d: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z' }]],
  'pause': [['rect', { x: '14', y: '3', width: '5', height: '18', rx: '1' }], ['rect', { x: '5', y: '3', width: '5', height: '18', rx: '1' }]],
  'activity': [['path', { d: 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2' }]],
  'refresh-cw': [['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }], ['path', { d: 'M21 3v5h-5' }], ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }], ['path', { d: 'M8 16H3v5' }]],
  'globe': [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }], ['path', { d: 'M2 12h20' }]],
  'monitor': [['rect', { width: '20', height: '14', x: '2', y: '3', rx: '2' }], ['line', { x1: '8', x2: '16', y1: '21', y2: '21' }], ['line', { x1: '12', x2: '12', y1: '17', y2: '21' }]],
  'smartphone': [['rect', { width: '14', height: '20', x: '5', y: '2', rx: '2', ry: '2' }], ['path', { d: 'M12 18h.01' }]],
  'braces': [['path', { d: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1' }], ['path', { d: 'M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1' }]],
  'terminal': [['path', { d: 'M12 19h8' }], ['path', { d: 'm4 17 6-6-6-6' }]],
  'server': [['rect', { width: '20', height: '8', x: '2', y: '2', rx: '2', ry: '2' }], ['rect', { width: '20', height: '8', x: '2', y: '14', rx: '2', ry: '2' }], ['line', { x1: '6', x2: '6.01', y1: '6', y2: '6' }], ['line', { x1: '6', x2: '6.01', y1: '18', y2: '18' }]],
  // Our own: the logo's dial (freshness).
  'dial': [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 12l4-4' }], ['circle', { cx: '12', cy: '12', r: '1', fill: 'currentColor' }]],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={size <= 16 ? 1.5 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `icon ${className}` : 'icon'}
    >
      {(ICONS[name] as readonly Shape[]).map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
