// The splash: once, for a person at a terminal, and a still frame that ends on the logo.
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colourMode, firstRun, frame, markSeen } from './splash.mjs';

const tty = { isTTY: true };

test('the splash plays only the first time, at a terminal, outside CI and --json', () => {
  const home = mkdtempSync(join(tmpdir(), 'tblock-splash-'));
  assert.equal(firstRun({ home, env: {}, out: tty, json: false }), true);
  assert.equal(firstRun({ home, env: {}, out: { isTTY: false }, json: false }), false, 'piped, as agents run it');
  assert.equal(firstRun({ home, env: {}, out: tty, json: true }), false);
  assert.equal(firstRun({ home, env: { CI: 'true' }, out: tty, json: false }), false);
  assert.equal(firstRun({ home, env: { TBLOCK_NO_SPLASH: '' }, out: tty, json: false }), false);
  markSeen(home);
  assert.ok(existsSync(join(home, '.tblock', 'splash-seen')));
  assert.equal(firstRun({ home, env: {}, out: tty, json: false }), false, 'seen once');
});

test('the last frame shows the version, the tagline, and the commands, in every colour mode', () => {
  const still = frame(99, '9.9.9', 'mono').join('\n');
  assert.match(still, /v9\.9\.9/);
  assert.match(still, /jump complete · go deep first, then go fast/);
  assert.match(still, /help · doctor · roles · preset · watch · log · usage/);
  for (const mode of ['true', '256']) assert.equal(frame(99, '9.9.9', mode).length, 19, mode);
  assert.equal(colourMode({ NO_COLOR: '' }, tty), 'mono');
  assert.equal(colourMode({ COLORTERM: 'truecolor' }, tty), 'true');
  assert.equal(colourMode({}, tty), '256');
});
