// A tiny terminal canvas for tblock's splash, trimmed from the art prototypes. Three stacked layers per cell:
//   text  (one glyph, fg, optional bg)        – wins over everything
//   braille (2×4 dots per cell, one colour)   – thin lines, webs, traces
//   pixels  (2 per cell via ▀/▄, plus a colour-only glow layer underneath)
// Renders as truecolor, 256-colour, or monochrome (shade blocks + glyphs). Node built-ins only.

export const EMBER = [[255, 77, 109], [255, 122, 69], [255, 196, 87]];
export const ACCENT = [255, 112, 84];
export const WHITE = [255, 255, 255];
export const DIM = [110, 104, 112];
export const FAINT = [64, 60, 70];

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const addc = (a, b, k = 1) => [Math.min(255, a[0] + b[0] * k), Math.min(255, a[1] + b[1] * k), Math.min(255, a[2] + b[2] * k)];
export const ramp = (stops, t) => {
  const at = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(at));
  return mixc(stops[i], stops[i + 1], at - i);
};
export const luma = (c) => (c ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 : 0);
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
};
// Deterministic noise so every scene is a pure function of time: the still frame is just draw(dur).
export const hash = (a, b = 0) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const BRAILLE = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]]; // [row][col]

export class Frame {
  constructor(w, h, mono = false) {
    this.w = w; this.h = h; this.ph = h * 2; this.mono = mono;
    const n = w * h;
    this.ch = new Array(n); this.fg = new Array(n); this.bgc = new Array(n); this.bold = new Uint8Array(n);
    this.br = new Uint8Array(n); this.brc = new Array(n);
    this.px = new Array(w * this.ph); this.gl = new Array(w * this.ph);
    this.clear();
  }

  clear() {
    this.ch.fill(null); this.fg.fill(null); this.bgc.fill(null); this.bold.fill(0);
    this.br.fill(0); this.brc.fill(null); this.px.fill(null); this.gl.fill(null);
  }

  // ── text ──────────────────────────────────────────────────────────────
  put(x, y, ch, fg = null, o = {}) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.ch[i] = ch; this.fg[i] = fg; this.bold[i] = o.bold ? 1 : 0; this.bgc[i] = o.bg || null;
  }

  // fg may be a colour or (i, n, x) => colour. Spaces are see-through unless o.solid.
  text(x, y, str, fg = null, o = {}) {
    const chars = [...String(str)];
    chars.forEach((c, i) => {
      if (c === ' ' && !o.solid) return;
      this.put(x + i, y, c, typeof fg === 'function' ? fg(i, chars.length, x + i) : fg, o);
    });
    return x + chars.length;
  }

  // Wipes a run of cells (all layers) so text reads cleanly over art.
  blank(x, y, n) {
    for (let k = 0; k < n; k++) {
      const cx = x + k;
      if (cx < 0 || cx >= this.w || y < 0 || y >= this.h) continue;
      const i = y * this.w + cx;
      this.ch[i] = null; this.br[i] = 0;
    }
  }

  // Text on a solid run: clears braille under it and keeps its spaces, so it reads over art.
  say(x, y, str, fg = null, o = {}) {
    this.blank(x, y, [...String(str)].length);
    return this.text(x, y, str, fg, { ...o, solid: true });
  }

  // ── pixels (x: 0..w-1, y: 0..2h-1) ────────────────────────────────────
  pset(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.ph) return;
    this.px[y * this.w + x] = c;
  }
  padd(x, y, c, k = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.ph) return;
    const i = y * this.w + x;
    this.px[i] = addc(this.px[i] || [0, 0, 0], c, k);
  }
  // Colour-only light under the pixels (skipped in monochrome).
  glow(x, y, c, k = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.ph) return;
    const i = y * this.w + x;
    this.gl[i] = addc(this.gl[i] || [0, 0, 0], c, k);
  }
  disk(cx, cy, r, c, add = false) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const col = typeof c === 'function' ? c(x, y, d / Math.max(0.001, r)) : c;
        if (!col) continue;
        if (add) this.padd(x, y, col); else this.pset(x, y, col);
      }
    }
  }

  // ── braille dots (x: 0..2w-1, y: 0..4h-1) ─────────────────────────────
  dot(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w * 2 || y >= this.h * 4) return;
    const i = (y >> 2) * this.w + (x >> 1);
    this.br[i] |= BRAILLE[y & 3][x & 1];
    if (c) this.brc[i] = c;
  }

}

// ── rendering ───────────────────────────────────────────────────────────
const cube = (v) => Math.max(0, Math.min(5, Math.round((v - 35) / 40)));
const LEVELS = [0, 95, 135, 175, 215, 255];
export const to256 = (c) => {
  const [r, g, b] = c.map((v) => clamp(v, 0, 255));
  const ci = [cube(r), cube(g), cube(b)];
  const cd = (LEVELS[ci[0]] - r) ** 2 + (LEVELS[ci[1]] - g) ** 2 + (LEVELS[ci[2]] - b) ** 2;
  const avg = (r + g + b) / 3;
  const gi = Math.max(0, Math.min(23, Math.round((avg - 8) / 10)));
  const gv = 8 + gi * 10;
  const gd = (gv - r) ** 2 + (gv - g) ** 2 + (gv - b) ** 2;
  return gd < cd ? 232 + gi : 16 + 36 * ci[0] + 6 * ci[1] + ci[2];
};

const cellMono = (top, bot) => {
  const lt = luma(top); const lb = luma(bot);
  const on = 0.3; const off = 0.1;
  if (lt >= on && lb >= on) return '█';
  if (lt >= on && lb < off) return '▀';
  if (lb >= on && lt < off) return '▄';
  const m = (lt + lb) / 2;
  return m < 0.05 ? ' ' : m < 0.14 ? '░' : m < 0.24 ? '▒' : m < 0.34 ? '▓' : '█';
};

// mode: 'true' | '256' | 'mono'. Returns an array of lines.
export function render(f, mode, cols = f.w) {
  const w = Math.min(f.w, cols);
  const lines = [];
  const code = (c, bg) => {
    const k = c.map((v) => Math.round(clamp(v, 0, 255)));
    return mode === 'true' ? `${bg ? 48 : 38};2;${k.join(';')}` : `${bg ? 48 : 38};5;${to256(k)}`;
  };
  // Half-lit cells under text fade to half strength; faint glow is dropped so it never paints
  // darker-than-terminal discs on a non-black background.
  const avg = (a, b) => (a && b ? mixc(a, b, 0.5) : a || b ? scale(a || b, 0.5) : null);
  const faint = (c) => (c && Math.max(c[0], c[1], c[2]) < 26 ? null : c);
  for (let y = 0; y < f.h; y++) {
    let line = '';
    let curFg = ''; let curBg = ''; let curBold = 0;
    for (let x = 0; x < w; x++) {
      const i = y * f.w + x;
      const ti = 2 * y * f.w + x; const bi = (2 * y + 1) * f.w + x;
      const pTop = f.px[ti]; const pBot = f.px[bi];
      if (mode === 'mono') {
        if (f.ch[i]) line += f.ch[i];
        else if (f.br[i]) line += String.fromCharCode(0x2800 + f.br[i]);
        else line += cellMono(pTop, pBot);
        continue;
      }
      const top = pTop || faint(f.gl[ti]); const bot = pBot || faint(f.gl[bi]);
      let ch; let fg = null; let bg = null; let bold = 0;
      if (f.ch[i]) { ch = f.ch[i]; fg = f.fg[i]; bg = f.bgc[i] || avg(top, bot); bold = f.bold[i]; }
      else if (f.br[i]) { ch = String.fromCharCode(0x2800 + f.br[i]); fg = f.brc[i] || [200, 200, 200]; bg = avg(top, bot); }
      else if (top && bot) { ch = '▀'; fg = top; bg = bot; }
      else if (top) { ch = '▀'; fg = top; }
      else if (bot) { ch = '▄'; fg = bot; }
      else ch = ' ';
      const fgc = fg ? code(fg, false) : '39';
      const bgc = bg ? code(bg, true) : '49';
      let sgr = [];
      if (bold !== curBold) { sgr.push(bold ? '1' : '22'); curBold = bold; }
      if (ch !== ' ' && fgc !== curFg) { sgr.push(fgc); curFg = fgc; }
      if (bgc !== curBg) { sgr.push(bgc); curBg = bgc; }
      if (sgr.length) line += `\x1b[${sgr.join(';')}m`;
      line += ch;
    }
    lines.push(mode === 'mono' ? line.replace(/\s+$/, '') : `${line}\x1b[0m`);
  }
  return lines;
}

// ── fonts ──────────────────────────────────────────────────────────────
// The hero logo: lowercase "tblock", 12 pixels tall (6 rows of half blocks), chunky 3px strokes.
const BIG = {
  t: ['........', '.###....', '.###....', '.###....', '########', '########', '.###....', '.###....', '.###....', '.###..##', '.#######', '..#####.'],
  b: ['###.......', '###.......', '###.......', '###.......', '########..', '#########.', '###....###', '###....###', '###....###', '###....###', '#########.', '########..'],
  l: ['###..', '###..', '###..', '###..', '###..', '###..', '###..', '###..', '###..', '###..', '#####', '.####'],
  o: ['..........', '..........', '..........', '..........', '.########.', '##########', '###....###', '###....###', '###....###', '###....###', '##########', '.########.'],
  c: ['..........', '..........', '..........', '..........', '.#########', '##########', '###.......', '###.......', '###.......', '###.......', '##########', '.#########'],
  k: ['###.......', '###.......', '###.......', '###.......', '###...###.', '###..###..', '###.###...', '######....', '######....', '###.###...', '###..###..', '###...###.'],
};

const bitmap = (glyphs, str, gap) => {
  const pts = []; let x = 0; let h = 0;
  for (const ch of str) {
    const g = glyphs[ch]; if (!g) continue;
    h = Math.max(h, g.length);
    g.forEach((row, y) => [...row].forEach((v, gx) => { if (v === '#') pts.push([x + gx, y]); }));
    x += g[0].length + gap;
  }
  return { w: x - gap, h, pts };
};

export const LOGO = bitmap(BIG, 'tblock', 2); // 63 × 12 px

// Draws a bitmap such as LOGO at pixel position ox, oy.
// color(x, y, u, v) → rgb | null, where u, v are 0..1 across the bitmap. shadow draws a 1px extrude.
export function drawBitmap(f, bmp, ox, oy, color, { shadow = null, depth = 1, shift = null } = {}) {
  if (shadow) {
    for (let d = depth; d >= 1; d--) {
      for (const [x, y] of bmp.pts) {
        const sx = shift ? shift(y) : 0;
        f.pset(ox + x + d + sx, oy + y + d, typeof shadow === 'function' ? shadow(x / bmp.w, d) : shadow);
      }
    }
  }
  for (const [x, y] of bmp.pts) {
    const sx = shift ? shift(y) : 0;
    const c = color(x, y, x / Math.max(1, bmp.w - 1), y / Math.max(1, bmp.h - 1));
    if (c) f.pset(ox + x + sx, oy + y, c);
  }
}
