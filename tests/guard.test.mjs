// The guard hooks: silent until switched on, then an ask before anything outward and a roles line at session start.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandOf, preTool, sessionStart } from '../bin/hook.mjs';
import { outwardAction } from '../bin/outward.mjs';
import { parseRoles } from '../bin/roles.mjs';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin');
const on = parseRoles('# guard: on\n# preset: high\n\n## claude-code\ncode: sonnet @ medium\nreviewers: sonnet @ high, opus @ high\n');
const off = parseRoles('## claude-code\ncode: sonnet @ medium\n');
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });

test('the guard names every command that leaves the machine, and nothing local', () => {
  for (const cmd of ['git push -u origin fix', 'cd repo && git push --force', 'gh pr create --fill', 'gh pr merge 12', 'glab mr create --yes', 'glab mr note 4 -m hi', 'gh issue create --title x', 'npm publish', 'gh release create v1']) {
    assert.ok(outwardAction(cmd), cmd);
  }
  for (const cmd of ['git commit -m "tidy the fix"', 'git status', 'gh pr view 12 --json state', 'glab mr list', 'gh issue list', 'npm test', 'git pushd']) {
    assert.equal(outwardAction(cmd), null, cmd);
  }
});

test('with the guard on, a push becomes an ask; with it off or for a local command, the hook says nothing', () => {
  const asked = preTool(bash('git add -A && git push origin main'), on);
  assert.equal(asked.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(asked.hookSpecificOutput.permissionDecisionReason, /"git push" leaves this machine/);
  assert.equal(preTool(bash('git push'), off), null);
  assert.equal(preTool(bash('npm test'), on), null);
  assert.equal(preTool(bash('git push'), null), null, 'no roles file means no guard');
  assert.equal(commandOf({ toolInput: { command: 'git push' } }), 'git push', 'a harness that spells its fields differently still matches');
});

test('session start tells the session its roles for this harness and what the repo has set up', () => {
  const repo = mkdtempSync(join(tmpdir(), 'tblock-guard-'));
  mkdirSync(join(repo, '.tblock'));
  writeFileSync(join(repo, '.tblock', 'probe.json'), '{}');
  const text = sessionStart({ cwd: repo }, on, 'claude-code').hookSpecificOutput.additionalContext;
  assert.match(text, /tblock roles for this harness \(preset high\)\. code: sonnet @ medium\. reviewers: sonnet @ high, opus @ high\./);
  assert.match(text, /sets up logs, and not ticket labels or Grafana/);
  assert.match(sessionStart({ cwd: repo }, on, 'copilot').hookSpecificOutput.additionalContext, /no roles for this harness/);
  assert.equal(sessionStart({ cwd: repo }, off, 'claude-code'), null);
});

test('the hook script and the guard switch work end to end', () => {
  const home = mkdtempSync(join(tmpdir(), 'tblock-guard-'));
  const env = { HOME: home, USERPROFILE: home, PATH: '' };
  const hook = (event) => spawnSync(process.execPath, [join(BIN, 'hook.mjs'), event, 'claude-code'], { env, input: JSON.stringify(bash('git push')), encoding: 'utf8' });
  const cli = (...args) => spawnSync(process.execPath, [join(BIN, 'tblock.mjs'), ...args], { env, encoding: 'utf8' });

  assert.equal(hook('pre-tool').stdout, '', 'silent before the guard is on');
  assert.equal(cli('guard', 'on').status, 0);
  assert.match(readFileSync(join(home, '.tblock', 'roles.md'), 'utf8'), /^# guard: on$/m);
  assert.equal(JSON.parse(hook('pre-tool').stdout).hookSpecificOutput.permissionDecision, 'ask');
  assert.match(JSON.parse(hook('session-start').stdout).hookSpecificOutput.additionalContext, /tblock guard is on/);
  cli('guard', 'off');
  assert.equal(hook('pre-tool').stdout, '');
  assert.equal(hook('pre-tool').status, 0);
});

test('a grant covers the task branch\'s push, its MR, its replies, and its ticket, and nothing else', async () => {
  const { grantCovers } = await import('../bin/grant.mjs');
  for (const cmd of ['git push', 'git push -u origin feat/x', 'git push origin HEAD', 'git add -A && git commit -m x && git push',
    'gh pr create --fill', 'glab mr create --source-branch feat/x --target-branch main --yes', 'gh pr comment 12 --body-file r.md', 'glab mr note 4 -m done', 'gh issue create --title t --body-file b.md']) {
    assert.equal(grantCovers(cmd, 'feat/x'), true, cmd);
  }
  for (const cmd of ['git push origin main', 'git push origin HEAD:main', 'git push --force', 'git push --force-with-lease origin feat/x', 'git push -f origin feat/x', 'git push origin +feat/x', 'git push --delete origin feat/x',
    'git push --all', 'gh pr merge 12', 'git push && gh pr merge 12 --squash', 'glab mr approve 4', 'gh pr create --head other', 'gh issue close 3',
    'cd ../other && git push', 'git -C ../other push', 'gh pr create -R someone/else --fill', 'npm publish', 'git status']) {
    assert.equal(grantCovers(cmd, 'feat/x'), false, cmd);
  }
});

test('with a live grant for this repo and branch, the guard lets covered commands through and asks for the rest', async () => {
  const { addGrant } = await import('../bin/grant.mjs');
  const home = mkdtempSync(join(tmpdir(), 'tblock-grant-'));
  const here = { repo: '/r', branch: 'feat/x', base: 'main' };
  const where = () => here;
  assert.equal(preTool(bash('git push'), on, home, where).hookSpecificOutput.permissionDecision, 'ask', 'no grant yet');
  assert.match(preTool(bash('node bin/tblock.mjs grant'), on, home, where).hookSpecificOutput.permissionDecisionReason, /your yes for the run/);
  assert.equal(preTool(bash('tblock grant off'), on, home, where), null, 'ending a grant needs no yes');
  addGrant(home, here, 4);
  assert.equal(preTool(bash('git push -u origin feat/x'), on, home, where), null);
  assert.equal(preTool(bash('gh pr merge 12'), on, home, where).hookSpecificOutput.permissionDecision, 'ask');
  assert.equal(preTool(bash('git push'), on, home, () => ({ ...here, branch: 'feat/y' })).hookSpecificOutput.permissionDecision, 'ask', 'another branch');
  addGrant(home, { ...here, branch: 'feat/old' }, 1, Date.now() - 2 * 3600_000);
  assert.equal(preTool(bash('git push'), on, home, () => ({ ...here, branch: 'feat/old' })).hookSpecificOutput.permissionDecision, 'ask', 'expired');
  assert.throws(() => addGrant(home, { ...here, branch: 'main' }), /default branch/);
  assert.throws(() => addGrant(home, { ...here, branch: 'release', base: 'release' }), /default branch/);
});
