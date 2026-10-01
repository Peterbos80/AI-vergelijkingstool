/**
 * A tiny isometric drawing kit for the world scenes (docs/strategy/research-2026-10/05).
 *
 * Every scene is the same cut-away room seen from the same camera: a floor
 * (x towards the right, y towards the left, z up), a left wall (plane x = 0)
 * and a right wall (plane y = 0). Objects are boxes and cylinders with three
 * shaded faces; flat content (screens, posters, papers) is drawn in local
 * 2D coordinates and mapped onto a wall or a face with an affine transform.
 * Output is SVG markup with `s-*` classes; colours live in CSS
 * (globals.css, "World scenes"), so one scene serves both themes.
 */

export const VIEWBOX = '0 0 400 352';
const C = 0.866;
const S = 0.5;
const OX = 200;
const OY = 142;

export type Pt = [number, number];
export type Tone = 'o' | 'd' | 'w' | 'p' | 'q';

const r = (n: number) => Math.round(n * 10) / 10;

/** Screen position of a room point. */
export const P = (x: number, y: number, z = 0): Pt => [r(OX + (x - y) * C), r(OY + (x + y) * S - z)];

const pts = (list: Pt[]) => list.map((p) => `${p[0]},${p[1]}`).join(' ');
export const poly = (cls: string, list: Pt[]) => `<polygon class="${cls}" points="${pts(list)}"/>`;

/** Box with its top, left (+y) and right (+x) faces. Tones: o object, d device, w world colour, p paper, q glass. */
export function box(x: number, y: number, z: number, w: number, d: number, h: number, tone: Tone = 'o'): string {
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const right = [P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)];
  const left = [P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)];
  return poly(`s-${tone}l`, left) + poly(`s-${tone}r`, right) + poly(`s-${tone}t`, top);
}

/** Vertical cylinder standing on (x, y, z). */
export function cyl(x: number, y: number, z: number, rad: number, h: number, tone: Tone = 'o'): string {
  const [bx, by] = P(x, y, z);
  const rx = r(rad * C * Math.SQRT2);
  const ry = r(rad * S * Math.SQRT2);
  const top = r(by - h);
  return `<path class="s-${tone}l" d="M${r(bx - rx)},${top}V${by}A${rx},${ry} 0 0 0 ${r(bx + rx)},${by}V${top}Z"/><ellipse class="s-${tone}t" cx="${bx}" cy="${top}" rx="${rx}" ry="${ry}"/>`;
}

/** Soft contact shadow under a footprint on a horizontal plane. */
export const shadow = (x: number, y: number, w: number, d: number, z = 0, s = 5) =>
  poly('s-sh', [P(x - 1, y - 1, z), P(x + w + s, y - 1, z), P(x + w + s, y + d + s, z), P(x - 1, y + d + s, z)]);

/** Line between two room points. */
export const seg = (cls: string, a: [number, number, number], b: [number, number, number]) => {
  const [x1, y1] = P(...a);
  const [x2, y2] = P(...b);
  return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
};

/** A translucent beam from a lamp onto two points of a surface. */
export const beam = (from: [number, number, number], a: [number, number, number], b: [number, number, number]) =>
  `<path class="s-beam" d="M${P(...from).join(',')}L${P(...a).join(',')}L${P(...b).join(',')}Z"/>`;

const m = (a: number, b: number, c: number, d: number, [e, f]: Pt) => `matrix(${a},${b},${c},${d},${e},${f})`;
/** Flat content (u right, v down) on the right wall (plane y = 0), from x0 at height z0. */
export const onRight = (x0: number, z0: number) => m(C, S, 0, 1, P(x0, 0, z0));
/** On the left wall (plane x = 0), starting at its front edge y1. */
export const onLeft = (y1: number, z0: number) => m(C, -S, 0, 1, P(0, y1, z0));
/** On a horizontal plane at height z: u along +x, v along +y. */
export const onTop = (x0: number, y0: number, z: number) => m(C, S, -C, S, P(x0, y0, z));
/** On a box's left face (plane y = y1), from x0 at height z0. */
export const onFaceL = (x0: number, y1: number, z0: number) => m(C, S, 0, 1, P(x0, y1, z0));
/** On a box's right face (plane x = x1), starting at its front edge y1. */
export const onFaceR = (x1: number, y1: number, z0: number) => m(C, -S, 0, 1, P(x1, y1, z0));

export const g = (transform: string, body: string) => `<g transform="${transform}">${body}</g>`;
export const rr = (x: number, y: number, w: number, h: number, rx: number, cls: string) =>
  `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"${rx ? ` rx="${rx}"` : ''} class="${cls}"/>`;
/** n text lines of varying length. */
export const lines = (n: number, x: number, y: number, w: number, gap: number, cls: string, vary = true) =>
  Array.from({ length: n }, (_, i) => rr(x, y + i * gap, vary ? Math.round(w * (0.55 + ((i * 37) % 45) / 100)) : w, 1.6, 0.8, cls)).join('');
/** A desk: two side panels and a top, with its contact shadow. */
export const desk = (x: number, y: number, w: number, d: number, h = 34) =>
  shadow(x, y, w, d) + box(x + 2, y + 2, 0, 4, d - 4, h - 4) + box(x + w - 6, y + 2, 0, 4, d - 4, h - 4) + box(x, y, h - 4, w, d, 4);

const W = 200;
const D = 200;
const H = 120;

/**
 * The room (slab, walls with thickness, baseboards), its world light and the
 * scene objects. `uid` keeps the light gradient's id unique on the page.
 */
export function roomSvg(uid: string, light: [number, number], walls: string, objects: string): string {
  const slab = 8;
  const t = 6;
  const floor = [P(0, 0), P(W, 0), P(W, D), P(0, D)];
  const wl = [P(0, 0, H), P(0, D, H), P(0, D, 0), P(0, 0, 0)];
  const wr = [P(0, 0, H), P(W, 0, H), P(W, 0, 0), P(0, 0, 0)];
  const [cx, cy] = P(light[0], light[1]);
  const id = `wl-${uid}`;
  return (
    `<defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${r(cy - 30)}" r="200"><stop offset="0" class="s-l0"/><stop offset=".5" class="s-l1"/><stop offset="1" class="s-l2"/></radialGradient></defs>` +
    `<g class="s-room">${poly('s-lw', wl)}${poly('s-rw', wr)}` +
    poly('s-base', [P(0, 0, 5), P(W, 0, 5), P(W, 0, 0), P(0, 0, 0)]) +
    poly('s-base2', [P(0, 0, 5), P(0, D, 5), P(0, D, 0), P(0, 0, 0)]) +
    poly('s-top', [P(-t, -t, H), P(-t, D, H), P(0, D, H), P(0, 0, H)]) +
    poly('s-top', [P(-t, -t, H), P(W, -t, H), P(W, 0, H), P(0, 0, H)]) +
    poly('s-end', [P(-t, D, H), P(0, D, H), P(0, D, -slab), P(-t, D, -slab)]) +
    poly('s-fe', [P(W, -t, H), P(W, 0, H), P(W, 0, -slab), P(W, -t, -slab)]) +
    poly('s-fe', [P(0, D), P(W, D), P(W, D, -slab), P(0, D, -slab)]) +
    poly('s-fe2', [P(W, 0), P(W, D), P(W, D, -slab), P(W, 0, -slab)]) +
    poly('s-floor', floor) +
    `</g><g class="s-lit" fill="url(#${id})">${poly('', wl)}${poly('', wr)}${poly('', floor)}</g>` +
    seg('s-edge', [0, 0, H], [W, 0, H]) +
    seg('s-edge', [0, 0, H], [0, D, H]) +
    seg('s-edge', [0, 0, 0], [0, 0, H]) +
    `<g class="s-walls">${walls}</g><g class="s-objs">${objects}</g>`
  );
}
