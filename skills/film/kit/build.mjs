#!/usr/bin/env node
// Builds a film from film.json: timing, the root composition, the cue list, and any missing scene.
// Run from the film's folder after every change to film.json or to a scene's cues: node build.mjs
// Node 18+ and built-ins only.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const film = JSON.parse(readFileSync(join(root, 'film.json'), 'utf8'));
const { width = 1920, height = 1080, ground = '#f6f5f1' } = film;
const LEAD = 0.34; // the push-through starts this long before a scene ends; that moment is the cut
const beat = film.music?.beat || 0;
const first = film.music?.first || 0; // time of a downbeat in the trimmed track
const r3 = (n) => Math.round(n * 1000) / 1000;
const snap = (t) => (beat ? first + Math.round((t - first) / beat) * beat : t);

// Each cut lands on the nearest beat. The cut is LEAD before a scene ends, where its push-through starts.
// A scene with "overlap" starts that much before the previous one ends, on its own track, and the cut is
// its start: the end card's iris opens over the last shot.
const scenes = [];
let t = 0;
for (const [i, s] of film.scenes.entries()) {
  const start = i === 0 ? 0 : t - (s.overlap || 0);
  let dur = s.dur;
  if (i < film.scenes.length - 1) {
    const before = film.scenes[i + 1].overlap || LEAD; // how long before this scene ends the cut is
    dur = snap(start + dur - before) + before - start;
  }
  scenes.push({ id: s.id, start: r3(start), dur: r3(dur), track: s.overlap ? 2 : 1 });
  t = start + dur;
}
const total = r3(Math.max(...scenes.map((s) => s.start + s.dur)));

// Scenes that don't exist yet start from the template.
mkdirSync(join(root, 'compositions'), { recursive: true });
for (const s of scenes) {
  const file = join(root, 'compositions', `${s.id}.html`);
  if (!existsSync(file)) {
    const template = s.id === 'end' ? 'end.html' : 'scene.html';
    writeFileSync(file, readFileSync(join(here, 'compositions', template), 'utf8').replaceAll('SCENE', s.id));
    console.log(`new scene compositions/${s.id}.html (from ${template})`);
  }
  // The stage is the scene's first clip; its length follows film.json.
  const html = readFileSync(file, 'utf8');
  writeFileSync(file, html.replace(/(class="clip"[^>]*?data-duration=")[\d.]+(")/, `$1${s.dur}$2`));
}

// Shared assets and fonts. Geist is OFL; it is fetched once into the film, never stored in the skill.
mkdirSync(join(root, 'assets', 'fonts'), { recursive: true });
for (const f of ['film.js', 'film.css']) if (!existsSync(join(root, 'assets', f))) copyFileSync(join(here, 'assets', f), join(root, 'assets', f));
const fonts = { 'Geist-Regular': 'geist-sans', 'Geist-Medium': 'geist-sans', 'Geist-SemiBold': 'geist-sans', 'Geist-Bold': 'geist-sans', 'GeistMono-Regular': 'geist-mono', 'GeistMono-Medium': 'geist-mono' };
if (readFileSync(join(root, 'assets', 'film.css'), 'utf8').includes('Geist-Regular.woff2')) {
  for (const [name, dir] of Object.entries(fonts)) {
    const out = join(root, 'assets', 'fonts', `${name}.woff2`);
    if (existsSync(out)) continue;
    const res = await fetch(`https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/${dir}/${name}.woff2`);
    if (!res.ok) throw new Error(`could not fetch ${name}.woff2: ${res.status}`);
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(`fetched assets/fonts/${name}.woff2`);
  }
}

writeFileSync(join(root, 'assets', 'timing.js'),
  `// Written by build.mjs from film.json. Don't edit.\nwindow.FILM_T = ${JSON.stringify({ beat, total, scenes: Object.fromEntries(scenes.map((s) => [s.id, { start: s.start, dur: s.dur }])) })};\n`);

const hosts = scenes.map((s) => `      <div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${s.dur}" data-track-index="${s.track}" data-track-kind="graphics" data-width="${width}" data-height="${height}"></div>`).join('\n');
writeFileSync(join(root, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <script src="assets/timing.js"></script>
    <script src="assets/film.js"></script>
    <link rel="stylesheet" href="assets/film.css" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: ${ground}; }
      #root { position: relative; width: 100%; height: 100%; font-family: var(--sans); color: var(--ink); -webkit-font-smoothing: antialiased; }
      #ground { position: absolute; inset: 0; background: var(--ground); }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${width}" data-height="${height}">
      <div id="ground"></div>
${hosts}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`);

// The cue list for the sound pass: every scene's declared cues, plus a scene_cut at every cut.
const cues = [];
for (const [i, s] of scenes.entries()) {
  const html = readFileSync(join(root, 'compositions', `${s.id}.html`), 'utf8');
  const block = html.match(new RegExp(`<script type="application/json" id="${s.id}-cues">([\\s\\S]*?)</script>`));
  for (const [at, type, desc] of block ? JSON.parse(block[1]) : []) cues.push({ t: r3(s.start + at), type, desc: `${s.id}: ${desc}` });
  const next = scenes[i + 1];
  if (next) cues.push({ t: r3(next.track === 2 ? next.start : s.start + s.dur - LEAD), type: 'scene_cut', desc: `${s.id} to ${next.id}` });
}
cues.sort((a, b) => a.t - b.t);
writeFileSync(join(root, 'cues.json'), `${JSON.stringify(cues, null, 1)}\n`);

console.log(scenes.map((s) => `${s.start.toFixed(3).padStart(7)}  ${s.id} (${s.dur}s)`).join('\n'));
console.log(`total ${total}s, ${cues.length} cues${beat ? `, cuts on a ${beat}s beat` : ''}`);
