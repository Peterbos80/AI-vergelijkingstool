import type { SceneId } from '@/lib/world-ids';

/**
 * One line drawing per world for the bold tiles and banners: a chat
 * bubble, a pen, a magnifier and so on, in the tile's ink. Decorative; the
 * world's name is always next to it. "all" is the grid of every tool.
 */
const GLYPHS: Record<SceneId | 'all', { width: number; d: string[]; circles?: [number, number, number][]; rects?: [number, number, number, number, number][] }> = {
  home: { width: 7, d: ['M60 60l22-22'], circles: [[60, 60, 44], [60, 60, 4]] },
  assistant: { width: 6, d: ['M40 80l-8 22 26-22'], rects: [[14, 16, 92, 64, 20]], circles: [[42, 48, 2.5], [60, 48, 2.5], [78, 48, 2.5]] },
  writing: { width: 8, d: ['M78 18l24 24-50 50H28V68z', 'M66 30l24 24'] },
  research: { width: 8, d: ['M71 71l27 27'], circles: [[50, 50, 28]] },
  image: { width: 7, d: ['M14 88l30-28 22 20 14-12 26 22'], rects: [[14, 20, 92, 80, 16]], circles: [[44, 46, 10]] },
  video: { width: 6, d: ['M52 46v28l24-14z'], rects: [[12, 26, 96, 68, 18]] },
  audio: { width: 9, d: ['M20 50v20M40 34v52M60 18v84M80 38v44M100 52v16'] },
  code: { width: 8, d: ['M42 34L16 60l26 26M78 34l26 26-26 26M66 24L54 96'] },
  automation: { width: 7, d: ['M28 60a32 32 0 0 1 56-21l6 7', 'M92 26v20H72', 'M92 60a32 32 0 0 1-56 21l-6-7', 'M28 94V74h20'] },
  marketing: { width: 8, d: ['M18 50v20h16l42 24V26L34 50z', 'M92 46a16 16 0 0 1 0 28'] },
  business: {
    width: 8,
    d: ['M14 32a12 12 0 0 1 12-12h40a12 12 0 0 1 12 12v20a12 12 0 0 1-12 12H40L26 76V64a12 12 0 0 1-12-12z', 'M92 46a12 12 0 0 1 12 12v18a12 12 0 0 1-12 12v12L78 88H62a12 12 0 0 1-12-12v-2'],
  },
  all: {
    width: 7,
    d: [],
    rects: [
      [16, 16, 36, 36, 10],
      [68, 16, 36, 36, 18],
      [16, 68, 36, 36, 18],
      [68, 68, 36, 36, 10],
    ],
  },
};

export function WorldGlyph({ world, className }: { world: SceneId | 'all'; className?: string }) {
  const g = GLYPHS[world];
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={g.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {g.rects?.map(([x, y, w, h, r]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={r} />)}
      {g.circles?.map(([cx, cy, r]) => <circle key={`${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} />)}
      {g.d.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
