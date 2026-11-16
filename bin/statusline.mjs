// `tblock statusline`: one line for Claude Code's status bar with this session's tokens and cost, and today's,
// so the user sees spend as it happens. `statusline on` points ~/.claude/settings.json at it. Node built-ins only.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { binDir } from './launcher.mjs';
import { dayKey, readClaudeRuns, readClaudeSession } from './log.mjs';
import { addUsage, cacheHit, emptyUsage, priceOf, tokensOf } from './usage.mjs';

const count = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n));
const money = (n) => (n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);

// Tokens and cost over a set of per-model usage maps; cost is null when no model has a price.
function spend(maps, prices) {
  const usage = emptyUsage();
  let cost = null;
  for (const byModel of maps) {
    for (const [model, u] of byModel) {
      addUsage(usage, u);
      const c = priceOf(model, u, prices);
      if (c !== null) cost = (cost || 0) + c;
    }
  }
  return { usage, tokens: tokensOf(usage), cost };
}

export function statusLine({ input, ui, claudeHome, prices, now = new Date() }) {
  const parts = [ui.bold(ui.tone('accent', 'tblock'))];
  if (input.model?.display_name) parts.push(input.model.display_name);
  const path = input.transcript_path;
  if (path && existsSync(path)) {
    const session = spend([readClaudeSession(path).usage], prices);
    parts.push(`${count(session.tokens)} tok`);
    const hit = cacheHit(session.usage);
    if (hit !== null) parts.push(ui.dim(`${Math.round(hit * 100)}% cached`));
    if (session.cost !== null) parts.push(ui.bold(money(session.cost)));
  }
  const today = dayKey(now.getTime());
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = readClaudeRuns(claudeHome, start).flatMap((r) => (r.days.has(today) ? [r.days.get(today).main, r.days.get(today).subagents] : []));
  const day = spend(days, prices);
  if (day.cost !== null) parts.push(ui.dim(`today ${money(day.cost)}`));
  return parts.join(ui.dim(' · '));
}

const settingsPath = (claudeHome) => join(claudeHome, 'settings.json');
const launcher = (home) => join(binDir(home), process.platform === 'win32' ? 'tblock.cmd' : 'tblock');
const ours = (line) => /[\\/]\.tblock[\\/]bin[\\/]tblock(?:\.cmd)?"? statusline$/.test(line?.command || '');

function readSettings(file) {
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch {
    throw new Error(`${file} isn't valid JSON, so tblock left it alone. Fix it, then run tblock statusline on again.`);
  }
}

// Sets or clears Claude Code's statusLine. Never replaces a status line tblock didn't write.
export function setStatusLine(to, { claudeHome, home }) {
  const file = settingsPath(claudeHome);
  const settings = readSettings(file);
  const current = settings.statusLine;
  if (to === 'on') {
    if (current && !ours(current)) {
      throw new Error(`Claude Code already has a status line (${current.command || current.type}). Remove statusLine from ${file} first, or add "${launcher(home)} statusline" to your own script.`);
    }
    settings.statusLine = { type: 'command', command: `"${launcher(home)}" statusline` };
  } else if (current && ours(current)) {
    delete settings.statusLine;
  } else {
    return { file, on: false, changed: false };
  }
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  return { file, on: to === 'on', changed: true };
}
