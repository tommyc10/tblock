// Runs `tblock usage` and `tblock statusline` against a throwaway Claude Code home.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'tblock.mjs');
const today = new Date();
const at = (dayOffset, hour) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, hour).toISOString();
const assistant = (id, model, usage, timestamp, extra = {}) => ({ type: 'assistant', timestamp, cwd: '/work/shop', message: { id, model, usage, content: [] }, ...extra });

// One session that runs from yesterday evening past midnight, with a haiku subagent today.
function home() {
  const dir = mkdtempSync(join(tmpdir(), 'tblock-usage-'));
  const project = join(dir, '.claude', 'projects', '-work-shop');
  mkdirSync(join(project, 'sess-1', 'subagents'), { recursive: true });
  const main = [
    { type: 'user', timestamp: at(-1, 22), cwd: '/work/shop', message: { role: 'user', content: 'fix the cart rounding' } },
    assistant('m1', 'claude-opus-5-5', { input_tokens: 1000, output_tokens: 1000, cache_read_input_tokens: 9000 }, at(-1, 23)),
    assistant('m2', 'claude-opus-5-5', { input_tokens: 0, output_tokens: 2000, cache_read_input_tokens: 30000 }, at(0, 0)),
  ];
  const transcript = join(project, 'sess-1.jsonl');
  writeFileSync(transcript, `${main.map((e) => JSON.stringify(e)).join('\n')}\n`);
  const sub = [assistant('s1', 'claude-haiku-5-5', { input_tokens: 4000, output_tokens: 0 }, at(0, 0), { isSidechain: true })];
  writeFileSync(join(project, 'sess-1', 'subagents', 'agent-a.jsonl'), `${sub.map((e) => JSON.stringify(e)).join('\n')}\n`);
  return { dir, transcript };
}

const run = (dir, args, input = '') => {
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, CLAUDE_CONFIG_DIR: join(dir, '.claude'), COPILOT_HOME: join(dir, '.copilot'), NO_COLOR: '1' };
  return spawnSync(process.execPath, [CLI, ...args], { env, cwd: dir, encoding: 'utf8', input });
};
const usage = (dir, ...flags) => {
  const r = run(dir, ['usage', '--json', ...flags]);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};

test('a session past midnight counts each day\'s tokens on that day', () => {
  const { rows, total } = usage(home().dir, '--since', '3d');
  assert.deepEqual(rows.map((r) => r.tokens), [11000, 36000], 'yesterday 11k, today 32k main and 4k subagent');
  assert.equal(total.tokens, 47000);
  assert.equal(total.sessions, 1);
});

test('--since today leaves out yesterday\'s part of the session', () => {
  const { rows } = usage(home().dir, '--since=today');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tokens, 36000);
});

test('by model, each row has its cost, cache hit, and subagent share', () => {
  const { rows } = usage(home().dir, '--since=3d', '--by=model');
  assert.deepEqual(rows.map((r) => r.key), ['claude-opus-5-5', 'claude-haiku-5-5'], 'costliest first');
  const [opus, haiku] = rows;
  assert.equal(opus.cost.toFixed(4), ((1000 * 4 + 3000 * 20 + 39000 * 0.2) / 1e6).toFixed(4));
  assert.equal(opus.cacheHit, 39000 / 40000);
  assert.equal(opus.subagentTokens, 0);
  assert.equal(haiku.subagentTokens, 4000);
});

test('the text view shows a row per day and the token split', () => {
  const r = run(home().dir, ['usage', '--since=3d']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /tokens +cached +subagents +cost/i);
  assert.match(r.stdout, /47\.0k tokens {2}· {2}\$0\.\d\d at list price {2}· {2}1 session\b/);
  assert.match(r.stdout, /cache read {2}39\.0k/);
});

test('a bad --by is refused with the choices', () => {
  const r = run(home().dir, ['usage', '--by=week']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--by takes day, project, model, session/);
});

test('the status line shows the session\'s tokens and cost, and today\'s', () => {
  const { dir, transcript } = home();
  const r = run(dir, ['statusline'], JSON.stringify({ transcript_path: transcript, model: { display_name: 'Opus' } }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^tblock · Opus · 47k tok · 89% cached · \$0\.\d\d · today \$0\.\d\d\n$/);
});

test('statusline on never replaces a status line tblock did not write, and off removes only its own', () => {
  const { dir } = home();
  const settings = join(dir, '.claude', 'settings.json');
  writeFileSync(settings, JSON.stringify({ theme: 'dark', statusLine: { type: 'command', command: '~/my-line.sh' } }));
  const refused = run(dir, ['statusline', 'on']);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /already has a status line/);
  assert.equal(JSON.parse(readFileSync(settings, 'utf8')).statusLine.command, '~/my-line.sh');
  assert.equal(run(dir, ['statusline', 'off']).status, 0);
  assert.equal(JSON.parse(readFileSync(settings, 'utf8')).statusLine.command, '~/my-line.sh', 'off leaves a foreign line alone');

  writeFileSync(settings, JSON.stringify({ theme: 'dark' }));
  assert.equal(run(dir, ['statusline', 'on']).status, 0);
  const on = JSON.parse(readFileSync(settings, 'utf8'));
  assert.equal(on.theme, 'dark', 'other settings stay');
  assert.match(on.statusLine.command, /\.tblock[\\/]bin[\\/]tblock(\.cmd)?" statusline$/);
  assert.equal(run(dir, ['statusline', 'off']).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(settings, 'utf8')), { theme: 'dark' });
});

test('a mistyped command suggests the nearest one', () => {
  const r = run(home().dir, ['usgae']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Did you mean tblock usage\?/);
});
