// The hyperspace splash: plays once, the first time someone runs tblock in a terminal, and again on
// `tblock splash`. Never for an agent, a pipe, CI, or --json. Every frame is a pure function of t.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACCENT, DIM, EMBER, FAINT, Frame, LOGO, WHITE, clamp, drawBitmap, ease, hash, lerp, mixc, ramp, render, scale, seg } from './art.mjs';

const W = 88;
const H = 19;
const DUR = 4.6;
const LOGO_X = Math.floor((W - LOGO.w) / 2);
const COMMANDS = ['help', 'doctor', 'roles', 'preset', 'watch', 'log', 'usage'];
const JUMP = [[96, 165, 250], [167, 139, 250], [255, 77, 109]];

const centre = (f, s) => Math.floor((f.w - [...s].length) / 2);

// Typewriter text that reveals over [a, b].
const type = (f, x, y, s, t, a, b, c) => {
  const n = Math.floor(seg(t, a, b) * s.length);
  f.say(x, y, s.slice(0, n), c);
  if (n > 0 && n < s.length && !f.mono) f.put(x + n, y, '▌', ACCENT);
};

// Command chips: tinted pills in colour, "a · b · c" in monochrome.
function chips(f, y, lit) {
  if (f.mono) { const s = COMMANDS.join(' · '); f.text(centre(f, s), y, s); return; }
  let x = Math.floor((f.w - (COMMANDS.reduce((n, s) => n + s.length + 2, 0) + COMMANDS.length - 1)) / 2);
  COMMANDS.forEach((s, i) => {
    const tone = ramp(EMBER, i / (COMMANDS.length - 1));
    f.text(x, y, ` ${s} `, scale(mixc(tone, WHITE, 0.35), lit), { solid: true, bg: scale(tone, 0.2 * lit), bold: i === 0 });
    x += s.length + 3;
  });
}

// The settled logo: ember gradient, bright top lip, scanlines, two-step extruded shadow.
function emberLogo(f, ox, oy, hot) {
  drawBitmap(f, LOGO, ox, oy, (x, y, u) => {
    let c = ramp(EMBER, u);
    if (y < 2) c = mixc(c, WHITE, 0.28);
    if (y % 2 === 1) c = scale(c, 0.82);
    return mixc(c, WHITE, hot * 0.8);
  }, { shadow: (u, d) => (d === 1 ? mixc([120, 26, 48], [130, 60, 26], u) : [52, 12, 26]), depth: 2 });
}

// Stars idle, stretch into streaks through a tunnel, flash, and the logo drops out of the jump.
const speedAt = (t) => (t < 0.8 ? 0.04 : t < 2.3 ? 0.04 + 5 * ease.in(seg(t, 0.8, 2.3)) : t < 2.7 ? lerp(5, 0.06, ease.out(seg(t, 2.3, 2.7))) : 0.06);
const travel = (t) => { let s = 0; for (let x = 0; x < t; x += 0.01) s += speedAt(x) * 0.01; return s; };

export function draw(f, t, version) {
  const cx = W / 2; const cy = 17; const R = 56;
  const s = travel(t); const v = speedAt(t);
  for (let i = 0; i < 160; i++) {
    const ang = hash(i, 11) * Math.PI * 2;
    const d = ((hash(i, 12) * R + s * 60) % R) + 1.5;
    const len = Math.min(34, v * 9 * (d / R) * 6);
    const warm = hash(i, 13) < 0.18;
    const head = warm ? [255, 170, 120] : [235, 240, 255];
    const tail = warm ? [140, 40, 50] : [60, 80, 200];
    const k = clamp(d / 14) * (v < 0.1 ? 0.5 + 0.5 * Math.sin(t * 6 + i) : 1);
    const steps = Math.max(1, Math.ceil(len));
    for (let j = 0; j <= steps; j++) {
      const dd = d - (len * j) / steps;
      if (dd < 1) break;
      const q = j / steps;
      const sx = cx + Math.cos(ang) * dd * 1.25; const sy = cy + Math.sin(ang) * dd * 0.7;
      if (f.mono) { if (k > 0.3) f.dot(sx * 2, sy * 2); } else f.padd(sx, sy, scale(mixc(head, tail, q), k * (1 - q * 0.7)));
    }
  }
  const tunnel = seg(t, 1.3, 1.6) * (1 - seg(t, 2.2, 2.4));
  if (tunnel > 0) {
    for (let j = 0; j < 5; j++) {
      const r = (t * 70 + j * 11) % 55;
      const c = scale(ramp(JUMP, r / 55), tunnel * clamp(r / 10));
      for (let a = 0; a < 140; a++) {
        const th = (a / 140) * Math.PI * 2;
        f.dot(cx * 2 + Math.cos(th) * r * 2.5, cy * 2 + Math.sin(th) * r * 1.4, c);
      }
    }
  }
  const flash = seg(t, 2.25, 2.35) * (1 - seg(t, 2.35, 2.9));
  if (flash > 0 && !f.mono) for (let y = 0; y < f.ph; y++) for (let x = 0; x < W; x++) f.glow(x, y, [255, 250, 240], flash * (1 - Math.hypot((x - cx) / 60, (y - cy) / 30) * 0.6));
  const oy = 10;
  if (t > 2.3) {
    const z = lerp(3.2, 1, ease.out(seg(t, 2.3, 3.1)));
    const hot = 1 - seg(t, 2.6, 3.4);
    const lcx = LOGO_X + LOGO.w / 2; const lcy = oy + LOGO.h / 2;
    if (z > 1.02) {
      for (const [x, y] of LOGO.pts) f.disk(lcx + (LOGO_X + x - lcx) * z, lcy + (oy + y - lcy) * z, z * 0.55, mixc(ramp(EMBER, x / LOGO.w), WHITE, hot));
    } else emberLogo(f, LOGO_X, oy, hot);
  }
  if (t < 2.2) {
    const charge = seg(t, 0.2, 2.1);
    const label = 'spooling jump drive';
    f.text(centre(f, label) - 4, 17, label, DIM);
    for (let i = 0; i < 8; i++) f.put(centre(f, label) + label.length - 2 + i, 17, i < charge * 8 ? '▰' : '▱', i < charge * 8 ? ramp(JUMP, i / 7) : FAINT);
  } else {
    const msg = 'jump complete · go deep first, then go fast';
    type(f, centre(f, msg), 16, msg, t, 3.1, 3.8, [200, 210, 240]);
    if (t > 3.6) chips(f, 18, ease.out(seg(t, 3.6, 4.2)));
    if (t > 3.3) f.text(LOGO_X + LOGO.w - 7, 8, `v${version}`, DIM);
  }
}

export const frame = (t, version, mode, cols = W) => {
  const f = new Frame(W, H, mode === 'mono');
  draw(f, Math.min(t, DUR), version);
  return render(f, mode, cols);
};

export function colourMode(env, out) {
  if ('NO_COLOR' in env || !out.isTTY) return 'mono';
  return /truecolor|24bit/i.test(env.COLORTERM || '') || 'WT_SESSION' in env || /vscode|iTerm|WezTerm|ghostty/i.test(env.TERM_PROGRAM || '') ? 'true' : '256';
}

const seenPath = (home) => join(home, '.tblock', 'splash-seen');

// First run means a person at a terminal: not a pipe (which is how agents run tblock), not CI, not --json.
export const firstRun = ({ home, env, out, json }) =>
  Boolean(out.isTTY) && !json && !env.CI && !('TBLOCK_NO_SPLASH' in env) && !existsSync(seenPath(home));

export function markSeen(home) {
  try { mkdirSync(join(home, '.tblock'), { recursive: true }); writeFileSync(seenPath(home), `${new Date().toISOString()}\n`); } catch { /* the splash just plays again */ }
}

// Animated in a terminal; the last frame alone when piped. Ctrl-C ends it cleanly.
export async function play({ version, env = process.env, out = process.stdout }) {
  const mode = colourMode(env, out);
  const cols = out.isTTY ? Math.min(out.columns || W, W) : W;
  if (!out.isTTY) { out.write(`${frame(DUR, version, mode, cols).join('\n')}\n\n`); return; }
  const restore = () => out.write('\x1b[?2026l\x1b[0m\x1b[?25h');
  const stop = () => { restore(); out.write(`\x1b[${H - 1}B\r\n`); process.exit(130); };
  process.once('SIGINT', stop);
  out.write(`\x1b[?25l${'\n'.repeat(H - 1)}\x1b[${H - 1}A\r`);
  const start = performance.now();
  for (;;) {
    const t = (performance.now() - start) / 1000;
    out.write(`\x1b[?2026h${frame(t, version, mode, cols).join('\n')}\r\x1b[${H - 1}A\x1b[?2026l`);
    if (t >= DUR) break;
    await new Promise((r) => setTimeout(r, 1000 / 45));
  }
  out.write(`\x1b[${H - 1}B\r\n\n`);
  restore();
  process.removeListener('SIGINT', stop);
}
