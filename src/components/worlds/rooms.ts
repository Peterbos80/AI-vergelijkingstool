/**
 * The eleven world scenes: one cut-away room per category, plus "home", the
 * wijzer's own office. Each room has one key light in its world colour
 * (--w) and a few objects that say what you make there. No people, no
 * robots, no sparkles: a maquette, not a cartoon.
 */
import { WORLDS, type SceneId } from '@/lib/world-ids';
import { box, cyl, desk, g, lines, onFaceL, onFaceR, onLeft, onRight, onTop, P, roomSvg, rr, seg, shadow, beam } from './iso';

export { WORLDS, isWorld, type SceneId, type WorldId } from '@/lib/world-ids';

interface Room {
  light: [number, number];
  walls: () => string;
  objects: () => string;
}

const ROOMS: Record<SceneId, Room> = {
  // Het kantoor van de wijzer: the dial clock (the logo), the ten worlds on a board, a printer printing a receipt.
  home: {
    light: [110, 110],
    walls: () => {
      const ticks = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r1 = i % 3 === 0 ? 25 : 28;
        return `<line x1="${(40 + Math.sin(a) * r1).toFixed(1)}" y1="${(40 - Math.cos(a) * r1).toFixed(1)}" x2="${(40 + Math.sin(a) * 31).toFixed(1)}" y2="${(40 - Math.cos(a) * 31).toFixed(1)}" class="s-tick"/>`;
      }).join('');
      const clock = g(onRight(30, 106), `<circle cx="40" cy="40" r="37" class="s-scr"/><circle cx="40" cy="40" r="37" class="s-rim"/>${ticks}<path d="M40,6A34,34 0 0 1 69.4,23" class="s-arc"/><line x1="40" y1="40" x2="56" y2="24" class="s-hand"/><circle cx="40" cy="40" r="3.2" class="s-hub"/>`);
      const tabs = WORLDS.map((w, i) => `<rect x="${8 + (i % 5) * 23}" y="${18 + Math.floor(i / 5) * 26}" width="18" height="20" rx="2" style="fill:var(--world-${w})"/>`).join('');
      const board = g(onLeft(172, 98), rr(0, 0, 128, 74, 3, 's-panel') + rr(8, 8, 40, 2, 1, 's-txt') + tabs);
      return board + clock;
    },
    objects: () => {
      const cabinet = shadow(150, 14, 34, 30) + box(150, 14, 0, 34, 30, 62) + g(onFaceL(150, 44, 60), [0, 1, 2].map((i) => rr(3, 3 + i * 19.5, 28, 17, 1, 's-slot') + rr(12, 9 + i * 19.5, 10, 2, 1, 's-knob')).join(''));
      const printer = shadow(90, 108, 30, 22, 34, 3) + box(90, 108, 34, 30, 22, 13, 'd') + g(onTop(94, 112, 47.1), rr(0, 0, 22, 3, 1, 's-slotd'));
      // The receipt leaves the printer, crosses the desk and hangs down its front with a torn edge.
      const top = [P(98, 130, 34.6), P(112, 130, 34.6), P(112, 146, 34.6), P(98, 146, 34.6)];
      const [ex, ey] = P(112, 146, 6);
      const [fx, fy] = P(98, 146, 6);
      const teeth = Array.from({ length: 7 }, (_, i) => `L${(ex - ((i + 1) * (ex - fx)) / 7).toFixed(1)},${(ey - ((i + 1) * (ey - fy)) / 7 + (i % 2 ? 0 : 2.5)).toFixed(1)}`).join('');
      const receipt =
        `<polygon class="s-paper" points="${top.map((p) => p.join(',')).join(' ')}"/>` +
        `<path class="s-paper2" d="M${P(98, 146, 34.6).join(',')}L${P(112, 146, 34.6).join(',')}L${ex},${ey}${teeth}L${fx},${fy}Z"/>` +
        g(onFaceL(100, 146, 32), lines(5, 0, 0, 10, 4.4, 's-rtxt') + rr(0, 23, 10, 1.4, 0.7, 's-rtot'));
      const lamp = cyl(134, 106, 34, 5, 2) + seg('s-leg', [134, 106, 36], [132, 112, 62]) + seg('s-leg', [132, 112, 62], [118, 118, 60]) + box(110, 114, 54, 12, 10, 7, 'w') + beam([116, 119, 54], [96, 132, 35], [124, 146, 35]);
      return cabinet + desk(56, 96, 96, 50) + printer + receipt + lamp;
    },
  },

  // Gesprekskamer: a conversation on the wall screen, a window, a desk with a laptop.
  assistant: {
    light: [100, 90],
    walls: () =>
      g(onRight(22, 108), rr(0, 0, 156, 82, 4, 's-scr') + rr(10, 10, 74, 16, 8, 's-ui') + lines(2, 18, 15.5, 50, 5, 's-uitxt2', false) + rr(66, 32, 80, 16, 8, 's-w') + rr(74, 37.5, 52, 1.8, 0.9, 's-txtw') + rr(74, 42, 38, 1.8, 0.9, 's-txtw') + rr(10, 54, 58, 16, 8, 's-ui') + [0, 1, 2].map((i) => `<circle cx="${124 + i * 7}" cy="62" r="2.2" class="s-w" style="opacity:${0.45 + i * 0.25}"/>`).join('')) +
      g(onLeft(166, 100), rr(0, 0, 96, 62, 2, 's-glass') + rr(0, 0, 96, 62, 2, 's-frame') + '<line x1="48" y1="0" x2="48" y2="62" class="s-mull"/><line x1="0" y1="31" x2="96" y2="31" class="s-mull"/>'),
    objects: () => {
      const spill = `<polygon class="s-spill" points="${[P(18, 70), P(18, 166), P(70, 166), P(70, 70)].map((p) => p.join(',')).join(' ')}"/>`;
      const rug = g(onTop(60, 56, 0.2), rr(0, 0, 116, 100, 6, 's-rug'));
      const laptop = box(96, 76, 34, 34, 22, 2, 'd') + box(96, 74, 36, 34, 2, 22, 'd') + g(onFaceL(97.5, 76, 56.5), rr(0, 0, 31, 19, 1, 's-scrw') + rr(3, 3, 14, 4, 2, 's-ui2') + rr(13, 9, 15, 4, 2, 's-w8'));
      const chair = shadow(104, 122, 22, 20) + box(108, 124, 0, 3, 3, 16) + box(122, 124, 0, 3, 3, 16) + box(108, 138, 0, 3, 3, 16) + box(122, 138, 0, 3, 3, 16) + box(104, 122, 16, 24, 20, 4) + box(104, 140, 20, 24, 3, 26);
      return spill + rug + desk(70, 64, 92, 46) + laptop + cyl(146, 96, 34, 4.5, 9, 'w') + chair;
    },
  },

  // Schrijfkamer: a bookcase, a manuscript on the wall, a typewriter.
  writing: {
    light: [110, 110],
    walls: () =>
      g(onRight(44, 104), rr(0, 0, 66, 84, 1, 's-paper') + rr(8, 8, 34, 3, 1, 's-ink') + lines(9, 8, 18, 50, 6, 's-inkl') + rr(7, 41, 44, 4, 1, 's-mark') + rr(76, 2, 22, 22, 1, 's-note') + rr(80, 30, 22, 22, 1, 's-w') + rr(104, 10, 20, 20, 1, 's-note')),
    objects: () => {
      const tones = ['s-bk1', 's-bk2', 's-bk3', 's-w8', 's-bk2', 's-bk1', 's-bk3', 's-bk1', 's-bk2', 's-w8', 's-bk3', 's-bk1', 's-bk2', 's-bk3', 's-bk1', 's-bk2'];
      const spines: string[] = [];
      for (let s = 0; s < 3; s++) {
        let u = 4;
        for (let i = 0; i < 14; i++) {
          const w = 5 + ((i * 7 + s * 3) % 4);
          const h = 18 + ((i * 5 + s) % 7);
          if (u + w > 104) break;
          spines.push(rr(u, 4 + s * 31 + (26 - h), w, h, 0.6, tones[(i + s * 5) % tones.length]!));
          u += w + 0.8;
        }
      }
      const bookcase = shadow(0, 50, 18, 110) + box(0, 50, 0, 18, 110, 96) + g(onFaceR(18, 160, 96), rr(0, 0, 110, 96, 0, 's-case') + spines.join('') + [30, 61, 92].map((v) => rr(0, v, 110, 4, 0, 's-shelf')).join(''));
      const lamp = cyl(178, 40, 0, 7, 2) + seg('s-leg', [178, 40, 2], [178, 40, 84]) + cyl(178, 40, 80, 10, 12, 'w') + beam([178, 40, 80], [90, 90, 34], [150, 130, 34]);
      const keys = Array.from({ length: 18 }, (_, i) => `<circle cx="${3 + (i % 6) * 5}" cy="${3 + Math.floor(i / 6) * 5}" r="1.5" class="s-key"/>`).join('');
      const typewriter = shadow(88, 92, 36, 24, 34, 3) + box(88, 92, 34, 36, 24, 9, 'd') + g(onTop(91, 97, 43.1), keys) + box(96, 92, 43, 20, 2, 20, 'p') + g(onFaceL(97, 94, 61), lines(4, 1, 2, 14, 3.6, 's-inkl'));
      const stack = box(132, 98, 34, 18, 22, 2, 'p') + box(133, 97, 36, 18, 22, 2, 'p') + box(131, 98, 38, 18, 22, 2, 'p');
      return bookcase + lamp + desk(66, 78, 96, 48) + typewriter + stack + box(140, 112, 34, 16, 2, 1.6, 'w');
    },
  },

  // Laboratorium: a board with a chart, a bookcase, a bench with flasks and a magnifier, a globe.
  research: {
    light: [100, 100],
    walls: () => {
      const bars = [18, 28, 22, 36, 30].map((h, i) => rr(12 + i * 12, 50 - h, 8, h, 1, i === 3 ? 's-w' : 's-bar')).join('');
      const pts = [[84, 52], [94, 40], [104, 44], [114, 26], [124, 18]];
      return g(onLeft(176, 102), rr(0, 0, 132, 70, 3, 's-board') + '<path d="M8,58H76M8,58V8" class="s-axis"/>' + bars + `<path d="M${pts.map((p) => p.join(',')).join('L')}" class="s-wline"/>` + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" class="s-w"/>`).join('') + lines(3, 84, 60, 36, 3.5, 's-txt'));
    },
    objects: () => {
      const spines =
        Array.from({ length: 16 }, (_, i) => rr(2.5 + i * 3.85, 6 + (i % 3) * 2, 3.1, 22 - (i % 3) * 2, 0.6, i === 6 ? 's-w' : ['s-bk1', 's-bk2', 's-bk3', 's-bk1'][i % 4]!)).join('') +
        Array.from({ length: 12 }, (_, i) => rr(3.7 + i * 5, 38 + (i % 2) * 3, 4, 20 - (i % 2) * 3, 0.6, ['s-bk2', 's-bk3', 's-bk1'][i % 3]!)).join('');
      const bookcase = shadow(120, 0, 70, 16) + box(120, 0, 0, 70, 16, 64) + g(onFaceL(120, 16, 64), rr(0, 0, 70, 64, 0, 's-case') + spines + rr(0, 30, 70, 3, 0, 's-shelf') + rr(0, 61, 70, 3, 0, 's-shelf'));
      const flask = (x: number, y: number, h: number, lvl: number) => cyl(x, y, 34, 5, h, 'q') + cyl(x, y, 34, 4, lvl, 'w');
      const lens = g(onTop(124, 104, 34.2), '<circle cx="12" cy="12" r="10" class="s-lens"/><line x1="19" y1="19" x2="34" y2="34" class="s-handle"/>');
      const papers = box(140, 100, 34, 18, 22, 1.2, 'p') + g(onTop(142, 103, 35.3), lines(4, 0, 0, 13, 4, 's-inkl'));
      const [gx, gy] = P(36, 160, 52);
      const globe = cyl(36, 160, 0, 8, 3) + seg('s-leg', [36, 160, 3], [36, 160, 40]) + `<circle cx="${gx}" cy="${gy}" r="15" class="s-globe"/><ellipse cx="${gx}" cy="${gy}" rx="6.5" ry="15" class="s-mer"/><ellipse cx="${gx}" cy="${gy}" rx="15" ry="5" class="s-mer"/><path d="M${gx - 15},${gy}A15,15 0 0 1 ${gx},${gy - 15}" class="s-wline"/>`;
      return bookcase + desk(50, 96, 120, 34) + flask(70, 104, 20, 9) + flask(84, 112, 14, 8) + flask(96, 104, 26, 12) + lens + papers + globe;
    },
  },

  // Creatieve studio: a gallery wall, a pegboard, an easel with a canvas and a softbox.
  image: {
    light: [100, 110],
    walls: () => {
      const land = `${rr(0, 0, 64, 46, 1, 's-mat')}${rr(3, 3, 58, 40, 0.5, 's-pic')}<path d="M3,43L22.4,20.7L35.2,32.2L46.1,23L61,43Z" class="s-mtn"/><circle cx="46.1" cy="13.8" r="4.6" class="s-w"/>`;
      const portrait = `<g transform="translate(72,6)">${rr(0, 0, 32, 40, 1, 's-mat')}${rr(3, 3, 26, 34, 0.5, 's-pic')}<circle cx="16" cy="17" r="8" class="s-w5"/><rect x="9" y="27" width="14" height="5" rx="1" class="s-mtn"/></g>`;
      const small = `<g transform="translate(112,0)">${rr(0, 0, 38, 30, 1, 's-mat')}${rr(3, 3, 32, 24, 0.5, 's-wtint')}<path d="M6,24L16,10L22,18L26,13L32,24Z" class="s-w"/></g>`;
      const swatches = `<g transform="translate(8,54)">${[0.2, 0.4, 0.6, 0.8, 1].map((o, i) => `<rect x="${i * 14}" y="0" width="12" height="18" rx="1" class="s-w" style="opacity:${o}"/>`).join('')}</g>`;
      const pegs = Array.from({ length: 12 }, (_, i) => `<circle cx="${12 + (i % 4) * 15}" cy="${12 + Math.floor(i / 4) * 15}" r="5" class="${i % 5 === 1 ? 's-w' : 's-peg'}"/>`).join('');
      return g(onRight(26, 104), land + portrait + small + swatches) + g(onLeft(150, 92), rr(0, 0, 70, 54, 3, 's-panel') + pegs);
    },
    objects: () => {
      const soft = seg('s-leg', [160, 60, 0], [160, 60, 78]) + seg('s-leg', [160, 60, 0], [150, 70, 0]) + seg('s-leg', [160, 60, 0], [172, 66, 0]) + box(148, 54, 70, 26, 8, 30, 'd') + g(onFaceL(149, 62, 99), rr(0, 0, 24, 28, 1, 's-diff')) + beam([158, 62, 86], [60, 126, 36], [100, 150, 0]);
      const easel = seg('s-leg', [84, 118, 70], [70, 128, 0]) + seg('s-leg', [84, 118, 70], [100, 128, 0]) + seg('s-leg', [84, 118, 70], [86, 104, 0]) + box(64, 124, 26, 44, 4, 2) + box(64, 122, 28, 44, 3, 36, 'p') + g(onFaceL(64, 125, 64), '<circle cx="28" cy="14" r="7" class="s-w"/><path d="M2,34L16,16L26,26L32,20L42,34Z" class="s-w3"/><path d="M2,34L12,24L20,30L30,22L42,34Z" class="s-mtn2"/>');
      const side = shadow(126, 136, 26, 18) + box(126, 136, 0, 26, 18, 26) + cyl(134, 142, 26, 3.4, 6, 'w') + cyl(142, 146, 26, 3.4, 5) + cyl(134, 150, 26, 3.4, 4, 'p');
      return soft + easel + side;
    },
  },

  // Filmstudio: storyboard, a timeline, a fresnel light, a camera on a tripod aimed at the set, a slate.
  video: {
    light: [70, 90],
    walls: () => {
      const frames = Array.from({ length: 6 }, (_, i) => rr(8 + (i % 3) * 38, 10 + Math.floor(i / 3) * 30, 32, 22, 1.5, 's-frm') + `<path d="M${12 + (i % 3) * 38},${28 + Math.floor(i / 3) * 30}l${8 + (i % 2) * 4},-8l6,5l5,-4l7,7" class="s-sk"/>`).join('');
      const strip = Array.from({ length: 5 }, (_, i) => rr(8 + i * 22, 14, 18, 14, 1, i === 2 ? 's-uifrmw' : 's-uifrm')).join('');
      return (
        g(onLeft(158, 104), rr(0, 0, 124, 72, 3, 's-panel') + frames) +
        g(onRight(26, 104), rr(0, 0, 124, 60, 3, 's-scr') + strip + rr(8, 36, 108, 4, 2, 's-trk') + rr(8, 36, 56, 4, 2, 's-w') + rr(8, 44, 70, 4, 2, 's-trk') + rr(30, 44, 26, 4, 2, 's-w5') + rr(63, 10, 2, 42, 0, 's-w') + '<circle cx="114" cy="8" r="3" class="s-rec"/>')
      );
    },
    objects: () => {
      const light = seg('s-leg', [168, 30, 0], [168, 30, 70]) + seg('s-leg', [168, 30, 0], [156, 38, 0]) + seg('s-leg', [168, 30, 0], [178, 40, 0]) + box(158, 22, 66, 20, 16, 16, 'd') + g(onFaceL(158, 38, 82), '<circle cx="10" cy="8" r="6" class="s-fresnel"/>') + beam([164, 38, 72], [24, 70, 0], [80, 140, 0]);
      const legs = [[106, 112], [140, 112], [122, 150]].map(([x, y]) => seg('s-leg', [122, 124, 44], [x!, y!, 0])).join('');
      const camera = box(110, 114, 44, 30, 22, 22, 'd') + box(92, 118, 48, 18, 14, 14, 'd') + box(118, 120, 66, 14, 10, 8, 'd') + g(onFaceR(140, 136, 62), '<circle cx="18" cy="8" r="2.4" class="s-rec"/>') + g(onFaceL(110, 136, 64), rr(4, 4, 16, 10, 1, 's-scrw'));
      const slate = shadow(48, 150, 32, 8) + box(48, 150, 0, 32, 6, 20, 'd') + box(48, 150, 20, 32, 6, 5, 'd') + g(onFaceL(48, 156, 25), Array.from({ length: 5 }, (_, i) => `<path d="M${i * 7},0h4l-4,5h-4z" class="s-stripe"/>`).join('')) + g(onFaceL(48, 156, 18), lines(3, 3, 3, 20, 4, 's-uitxt'));
      return light + legs + camera + slate;
    },
  },

  // Opnamestudio: foam, ON AIR, the waveform, a console with speakers and a broadcast microphone.
  audio: {
    light: [100, 90],
    walls: () => {
      const foam = Array.from({ length: 12 }, (_, i) => rr((i % 4) * 22, Math.floor(i / 4) * 22, 20, 20, 2, (i + Math.floor(i / 4)) % 2 ? 's-foam' : 's-foam2')).join('');
      const wave = Array.from({ length: 28 }, (_, i) => {
        const h = 4 + Math.abs(Math.sin(i * 0.9) * 14 + Math.sin(i * 2.3) * 6);
        return `<rect x="${8 + i * 4}" y="${(31 - h / 2).toFixed(1)}" width="2" height="${h.toFixed(1)}" rx="1" class="s-w"/>`;
      }).join('');
      return g(onLeft(168, 82), foam) + g(onLeft(150, 106), rr(0, 0, 50, 16, 2, 's-scr') + '<text x="25" y="11.5" class="s-sign">ON AIR</text>') + g(onRight(30, 104), rr(0, 0, 128, 62, 3, 's-scr') + wave + rr(8, 52, 112, 2, 1, 's-trk') + rr(8, 52, 44, 2, 1, 's-w5'));
    },
    objects: () => {
      const sliders = g(onTop(72, 50, 39.1), Array.from({ length: 8 }, (_, i) => rr(6 + i * 11, 4, 3, 26, 1.5, 's-trk') + rr(4.5 + i * 11, 8 + ((i * 7) % 15), 6, 4, 1, i === 2 ? 's-w' : 's-knob')).join(''));
      const speaker = (x: number) => box(x, 52, 39, 16, 14, 26, 'd') + g(onFaceL(x, 66, 65), '<circle cx="8" cy="8" r="4.5" class="s-cone"/><circle cx="8" cy="19" r="2.5" class="s-cone"/>');
      const [mx, my] = P(96, 116, 64);
      const mic = seg('s-leg', [150, 96, 36], [150, 96, 70]) + seg('s-leg', [150, 96, 70], [100, 112, 74]) + seg('s-leg', [100, 112, 74], [96, 116, 64]) + `<g transform="translate(${mx},${my})"><rect x="-7" y="-2" width="14" height="26" rx="7" class="s-mic"/>${[4, 8, 12, 16].map((y) => `<line x1="-5" y1="${y}" x2="5" y2="${y}" class="s-grill"/>`).join('')}<rect x="-9" y="10" width="18" height="3" rx="1.5" class="s-w"/></g>`;
      return desk(62, 44, 108, 48, 36) + box(70, 48, 36, 94, 36, 3, 'd') + sliders + speaker(62) + speaker(150) + mic;
    },
  },

  // Werkplek van de toekomst: a code wall, a terminal, a server rack, a desk with two monitors.
  code: {
    light: [100, 100],
    walls: () => {
      const code: [number, number, string][] = [[0, 30, 'k'], [1, 50, 't'], [2, 40, 't'], [1, 26, 'k'], [2, 60, 't'], [2, 34, 's'], [1, 12, 't'], [0, 8, 'k'], [0, 44, 't']];
      const wall = g(onRight(20, 108), rr(0, 0, 160, 84, 4, 's-scr') + rr(0, 0, 160, 10, 4, 's-ui') + [0, 1, 2].map((i) => `<circle cx="${8 + i * 6}" cy="5" r="1.7" class="s-dot"/>`).join('') + code.map(([ind, w, k], i) => rr(10 + ind * 10, 16 + i * 7.2, w, 2.4, 1.2, k === 'k' ? 's-w' : k === 's' ? 's-w5' : 's-uitxt')).join('') + rr(10, 78.8, 5, 6, 0.5, 's-w'));
      const term = g(onLeft(132, 96), rr(0, 0, 70, 46, 3, 's-scr') + '<text x="6" y="14" class="s-mono">&gt;_</text>' + lines(3, 6, 22, 40, 6, 's-w3'));
      return wall + term;
    },
    objects: () => {
      const grid = g(onTop(0, 0, 0.2), Array.from({ length: 9 }, (_, i) => `<path d="M${(i + 1) * 20},0V200M0,${(i + 1) * 20}H200" class="s-grid"/>`).join(''));
      const rack = shadow(0, 150, 24, 34) + box(0, 150, 0, 24, 34, 84, 'd') + g(onFaceR(24, 184, 82), Array.from({ length: 7 }, (_, i) => rr(3, 4 + i * 11, 28, 8, 1, 's-slotd') + `<circle cx="7" cy="${8 + i * 11}" r="1.4" class="${i % 3 === 0 ? 's-w' : 's-dot'}"/>`).join(''));
      const monitor = (x: number) => box(x, 74, 34, 6, 6, 8) + box(x - 14, 72, 42, 34, 3, 24, 'd') + g(onFaceL(x - 12.5, 75, 64.5), rr(0, 0, 31, 21, 1, 's-scr2') + lines(5, 3, 3, 18, 3.6, 's-w3'));
      return grid + rack + desk(56, 66, 116, 48) + box(84, 94, 34, 40, 12, 2, 'd') + monitor(96) + monitor(134);
    },
  },

  // Commandocentrum: a flow on the wall, a radar, a console with lights.
  automation: {
    light: [100, 100],
    walls: () => {
      const nodes: [number, number, boolean][] = [[8, 30, false], [52, 10, true], [52, 50, false], [100, 30, true]];
      const flow = g(onRight(22, 106), rr(0, 0, 156, 80, 4, 's-scr') + '<path d="M38,38H46V18H52M86,18H94V38H100M130,38H134" class="s-wline"/><path d="M38,38H46V58H52M86,58H94V38" class="s-flowd"/>' + nodes.map(([x, y, on]) => rr(x, y, 30, 16, 4, on ? 's-nodew' : 's-node')).join('') + '<circle cx="142" cy="38" r="8" class="s-w"/><path d="M138,38l3,3l5,-6" class="s-chk"/>');
      const radar = g(onLeft(160, 102), rr(0, 0, 80, 72, 3, 's-scr') + '<circle cx="40" cy="36" r="28" class="s-ringd"/><circle cx="40" cy="36" r="18" class="s-ringd"/><circle cx="40" cy="36" r="8" class="s-ringd"/><path d="M40,8V64M12,36H68" class="s-ringd"/><path d="M40,36L40,8A28,28 0 0 1 64.2,22Z" class="s-sweep"/><circle cx="52" cy="22" r="2" class="s-w"/><circle cx="26" cy="46" r="1.6" class="s-dot"/><circle cx="50" cy="50" r="1.6" class="s-dot"/>');
      return flow + radar;
    },
    objects: () => {
      const panel = g(onTop(50, 104, 32.1), Array.from({ length: 24 }, (_, i) => rr(4 + (i % 8) * 14, 4 + Math.floor(i / 8) * 8, 10, 5, 1, [2, 9, 13, 20].includes(i) ? 's-w' : 's-key2')).join(''));
      const screens = box(70, 100, 32, 32, 3, 20, 'd') + g(onFaceL(71.5, 103, 50.5), rr(0, 0, 29, 17, 1, 's-scr2') + '<path d="M3,13L9,9L15,11L21,5L26,7" class="s-wline"/>') + box(118, 100, 32, 32, 3, 20, 'd') + g(onFaceL(119.5, 103, 50.5), rr(0, 0, 29, 17, 1, 's-scr2') + rr(3, 3, 12, 4, 1, 's-nodew') + rr(15, 10, 11, 4, 1, 's-node'));
      const chair = shadow(98, 150, 22, 20) + box(106, 156, 0, 6, 6, 14) + box(98, 150, 14, 22, 20, 4) + box(98, 168, 18, 22, 3, 22);
      return desk(44, 100, 130, 36, 32) + panel + screens + chair;
    },
  },

  // Campagnekamer: a content calendar, a post, a ring light with a phone, a megaphone.
  marketing: {
    light: [100, 100],
    walls: () => {
      const planned = new Set([2, 5, 9, 12, 16, 19, 23, 26]);
      const cal = g(onRight(24, 106), rr(0, 0, 150, 82, 4, 's-panel') + rr(6, 6, 138, 8, 2, 's-cell') + Array.from({ length: 28 }, (_, i) => rr(6 + (i % 7) * 20, 18 + Math.floor(i / 7) * 15.5, 18, 13, 2, planned.has(i) ? (i % 3 ? 's-w' : 's-w5') : 's-cell')).join(''));
      const post = g(onLeft(160, 100), rr(0, 0, 76, 82, 4, 's-panel2') + '<circle cx="11" cy="11" r="5" class="s-w"/>' + rr(20, 7, 30, 2.4, 1.2, 's-txt2') + rr(20, 12, 18, 2, 1, 's-txt2') + rr(6, 20, 64, 40, 2, 's-wtint') + '<path d="M6,60L26,38L40,50L52,40L70,60Z" class="s-w3"/><path d="M10,70c0-2,3-3,4-1c1-2,4-1,4,1c0,2-4,4-4,5c0-1-4-3-4-5z" class="s-w"/>' + rr(26, 69, 30, 2, 1, 's-txt2'));
      return cal + post;
    },
    objects: () => {
      const [rx, ry] = P(120, 120, 84);
      const ring = seg('s-leg', [120, 120, 0], [120, 120, 62]) + seg('s-leg', [120, 120, 0], [106, 128, 0]) + seg('s-leg', [120, 120, 0], [134, 130, 0]) + seg('s-leg', [120, 120, 0], [122, 104, 0]) + `<circle cx="${rx}" cy="${ry}" r="22" class="s-ringw"/><circle cx="${rx}" cy="${ry}" r="22" class="s-ringl"/><rect x="${rx - 5}" y="${ry - 9}" width="10" height="18" rx="2" class="s-phone"/><rect x="${rx - 3.6}" y="${ry - 7}" width="7.2" height="13" rx="1" class="s-w5"/>`;
      const [mx, my] = P(60, 150, 0);
      const megaphone = shadow(46, 144, 24, 10, 0, 3) + `<g transform="translate(${mx},${my - 18})"><path d="M-14,-6L10,-16V12L-14,4Z" class="s-w"/><rect x="-20" y="-7" width="7" height="12" rx="2" class="s-dev"/><path d="M-12,4L-9,14H-4L-7,4" class="s-dev"/><path d="M14,-8q5,6,0,12M18,-12q8,10,0,20" class="s-wline"/></g>`;
      return ring + megaphone;
    },
  },

  // Servicebalie: a queue display, a help sign, a counter with a ticket dispenser, a bell and a headset.
  business: {
    light: [100, 110],
    walls: () =>
      g(onRight(28, 106), rr(0, 0, 140, 64, 4, 's-scr') + '<text x="12" y="44" class="s-big">042</text>' + [0, 1, 2].map((i) => rr(84, 10 + i * 16, 46, 12, 2, i === 0 ? 's-w5' : 's-ui') + `<text x="90" y="${19 + i * 16}" class="s-tk">${43 + i}</text>`).join('')) +
      g(onLeft(150, 100), rr(0, 0, 64, 64, 32, 's-panel') + '<path d="M18,36a14,14 0 0 1 28,0" class="s-hs"/><rect x="14" y="34" width="8" height="12" rx="3" class="s-w"/><rect x="42" y="34" width="8" height="12" rx="3" class="s-w"/><path d="M46,46q0,8,-10,8" class="s-hs"/>'),
    objects: () => {
      const counter = shadow(40, 118, 120, 22) + box(40, 118, 0, 120, 20, 40) + box(38, 116, 40, 124, 24, 4) + shadow(140, 60, 22, 58) + box(140, 60, 0, 20, 58, 40) + box(138, 58, 40, 24, 58, 4) + g(onFaceL(40, 138, 34), rr(4, 4, 112, 2, 1, 's-w5'));
      const dispenser = box(60, 122, 44, 14, 12, 18, 'w') + box(63, 134, 52, 8, 4, 2, 'p') + g(onFaceL(63, 138, 52), rr(0, 0, 8, 10, 0.5, 's-paper') + lines(2, 1.5, 3, 5, 3, 's-rtxt', false));
      const [bx, by] = P(104, 128, 44);
      const bell = `<path d="M${bx - 8},${by}a8,7 0 0 1 16,0z" class="s-bell"/><rect x="${bx - 10}" y="${by}" width="20" height="2.4" rx="1" class="s-detail"/><circle cx="${bx}" cy="${by - 8}" r="1.6" class="s-detail"/>`;
      const [hx, hy] = P(148, 86, 44);
      const headset = cyl(148, 86, 44, 4, 2) + seg('s-leg', [148, 86, 46], [148, 86, 62]) + `<path d="M${hx - 9},${hy - 16}a9,9 0 0 1 18,0" class="s-hs"/><rect x="${hx - 11}" y="${hy - 18}" width="5" height="8" rx="2" class="s-w"/><rect x="${hx + 6}" y="${hy - 18}" width="5" height="8" rx="2" class="s-w"/>`;
      return counter + dispenser + bell + headset;
    },
  },
};

const cache = new Map<SceneId, string>();
const UID = '__UID__';

/** Inner SVG markup of a world's room. `uid` must be unique on the page (it names the light gradient). */
export function roomMarkup(world: SceneId, uid: string): string {
  let markup = cache.get(world);
  if (!markup) {
    const room = ROOMS[world];
    markup = roomSvg(UID, room.light, room.walls(), room.objects());
    cache.set(world, markup);
  }
  return markup.replaceAll(UID, uid);
}
