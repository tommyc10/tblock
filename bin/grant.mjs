// A punch-it run's grant: after the user's one yes, the guard lets this repo's task branch be pushed,
// its MR opened and babysat, and its ticket created, without asking again. Nothing else, and never a merge.
// Grants live in ~/.tblock/grants.json, keyed by repo and branch, and expire. Node built-ins only.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTWARD } from './outward.mjs';

export const grantsPath = (home) => join(home, '.tblock', 'grants.json');
export const GRANT_COMMAND = /\btblock(?:\.mjs)?\s+grant\b(?!\s+off\b)/;
const DEFAULT_BRANCHES = new Set(['main', 'master', 'trunk', 'develop']);

export function readGrants(home) {
  try { return JSON.parse(readFileSync(grantsPath(home), 'utf8')).grants || []; } catch { return []; }
}

function writeGrants(home, grants) {
  mkdirSync(join(home, '.tblock'), { recursive: true });
  writeFileSync(grantsPath(home), `${JSON.stringify({ grants }, null, 2)}\n`);
}

export function gitWhere(cwd) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const repo = git('rev-parse', '--show-toplevel');
  const branch = git('branch', '--show-current');
  let base = null;
  try { base = git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD').replace(/^origin\//, ''); } catch { /* no remote HEAD */ }
  return { repo, branch, base };
}

export function addGrant(home, { repo, branch, base }, hours = 4, now = Date.now()) {
  if (!branch) throw new Error('no branch is checked out, so there is nothing to grant');
  if (DEFAULT_BRANCHES.has(branch) || branch === base) throw new Error(`${branch} is a default branch; grant only the task's own branch`);
  const until = new Date(now + hours * 3600_000).toISOString();
  const grants = readGrants(home).filter((g) => !(g.repo === repo && g.branch === branch) && Date.parse(g.until) > now);
  writeGrants(home, [...grants, { repo, branch, until }]);
  return { repo, branch, until };
}

export function revokeGrant(home, { repo, branch }) {
  const grants = readGrants(home);
  const kept = grants.filter((g) => !(g.repo === repo && g.branch === branch));
  if (kept.length !== grants.length) writeGrants(home, kept);
  return grants.length - kept.length;
}

export const liveGrant = (grants, { repo, branch }, now = Date.now()) =>
  grants.find((g) => g.repo === repo && g.branch === branch && Date.parse(g.until) > now) || null;

const words = (segment) => segment.trim().split(/\s+/).filter(Boolean);
const flagValue = (tokens, names) => {
  for (let i = 0; i < tokens.length; i += 1) {
    for (const n of names) {
      if (tokens[i] === n) return tokens[i + 1] ?? '';
      if (tokens[i].startsWith(`${n}=`)) return tokens[i].slice(n.length + 1);
    }
  }
  return null;
};

// One outward command, judged against the granted branch. Anything not named here still asks.
function covered(segment, branch) {
  const t = words(segment);
  const at = (a, b) => t.findIndex((w, i) => w === a && t[i + 1] === b);
  const push = at('git', 'push');
  if (push >= 0) {
    const args = t.slice(push + 2);
    if (args.some((a) => /^(?:--force(?:-with-lease|-if-includes)?(?:=.*)?|--delete|--mirror|--all|--tags|--prune)$/.test(a) || /^-[a-z]*[fd][a-z]*$/.test(a))) return false;
    const refspecs = args.filter((a) => !a.startsWith('-')).slice(1);
    return refspecs.every((r) => [branch, 'HEAD', `HEAD:${branch}`, `${branch}:${branch}`, `refs/heads/${branch}`].includes(r));
  }
  if (at('gh', 'pr') >= 0 || at('glab', 'mr') >= 0) {
    const verb = t[Math.max(at('gh', 'pr'), at('glab', 'mr')) + 2];
    if (verb === 'create') { const head = flagValue(t, ['--head', '-H', '--source-branch', '-s']); return head === null || head === branch; }
    return verb === 'comment' || verb === 'note';
  }
  if (at('gh', 'issue') >= 0 || at('glab', 'issue') >= 0) return t[Math.max(at('gh', 'issue'), at('glab', 'issue')) + 2] === 'create';
  return false;
}

// True when every outward part of the command is something the grant covers. A command that changes
// folder or names another repo might act somewhere the grant doesn't reach, so it always asks.
export function grantCovers(command, branch) {
  if (/\bcd\s|\s-C\s|--git-dir|--work-tree|\s(?:-R|--repo)\b/.test(` ${command}`)) return false;
  const outward = String(command).split(/&&|\|\||[;|\n]/).filter((s) => OUTWARD.test(s));
  return outward.length > 0 && outward.every((s) => covered(s, branch));
}

export const grantExists = (home) => existsSync(grantsPath(home));
