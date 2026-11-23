// Where the team's meeting notes live, so ticket-up can draft tickets from them. The folder is any set of
// markdown files, usually a clone of a private notes repo. ~/.tblock/notes.json holds its path. Node built-ins only.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const notesPath = (home) => join(home, '.tblock', 'notes.json');

export function readNotes(home) {
  try { return JSON.parse(readFileSync(notesPath(home), 'utf8')).folder || null; } catch { return null; }
}

const expand = (path, home) => (path === '~' ? home : path.startsWith('~/') ? join(home, path.slice(2)) : path);

export function setNotes(home, path, cwd = process.cwd()) {
  const folder = resolve(cwd, expand(path, home));
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Error(`${folder} is not a folder; clone the notes repo first`);
  mkdirSync(join(home, '.tblock'), { recursive: true });
  writeFileSync(notesPath(home), `${JSON.stringify({ folder }, null, 2)}\n`);
  return folder;
}

export function clearNotes(home) {
  if (!existsSync(notesPath(home))) return false;
  rmSync(notesPath(home));
  return true;
}

// Every markdown note under the folder, by path from it. A README describes the repo, so it isn't a note.
function noteFiles(folder, at = '') {
  return readdirSync(join(folder, at), { withFileTypes: true }).flatMap((e) => {
    const rel = at ? `${at}/${e.name}` : e.name;
    if (e.isDirectory()) return e.name.startsWith('.') || e.name === 'node_modules' ? [] : noteFiles(folder, rel);
    return /\.md$/i.test(e.name) && !/^readme\.md$/i.test(e.name) ? [rel] : [];
  });
}

const DATED = /(\d{4}-\d{2}-\d{2})[^/]*$/;

// What a run needs to find a meeting: the folder, whether it is a git clone to pull, how many notes it
// holds, and the newest note by the date in its file name.
export function describeNotes(folder) {
  if (!folder || !existsSync(folder)) return { folder, exists: false, git: false, notes: 0, newest: null };
  const files = noteFiles(folder);
  const dated = files.filter((f) => DATED.test(f)).sort((a, b) => b.match(DATED)[1].localeCompare(a.match(DATED)[1]) || b.localeCompare(a));
  return { folder, exists: true, git: existsSync(join(folder, '.git')), notes: files.length, newest: dated[0] || null };
}
