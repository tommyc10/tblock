// `tblock usage`: tokens and list-price cost across agent sessions, grouped by day, project, model, or session,
// so a user sees where their tokens go and how much of it is cheap cache reads. Node built-ins only.
import { basename } from 'node:path';
import { dayKey, parseSince, readClaudeRuns, readCopilotRuns } from './log.mjs';
import { addUsage, cacheHit, emptyUsage, normalizeModel, priceOf, tokensOf } from './usage.mjs';

export const GROUPS = ['day', 'project', 'model', 'session'];
const SESSION_ROWS = 15;
const BAR = 18;

const newRow = (key, label) => ({ key, label, usage: emptyUsage(), subagents: emptyUsage(), cost: 0, priced: false, unpriced: false, sessions: new Set() });

function addSlice(row, slice, prices) {
  addUsage(row.usage, slice.usage);
  if (slice.subagent) addUsage(row.subagents, slice.usage);
  const cost = priceOf(slice.model, slice.usage, prices);
  if (cost === null) row.unpriced = true;
  else { row.cost += cost; row.priced = true; }
  row.sessions.add(slice.session);
}

// One slice per run, day, model, and main-or-subagent, for days on or after `since`.
export function slicesOf(runs, since) {
  const from = dayKey(since.getTime());
  const slices = [];
  for (const run of runs) {
    for (const [day, { main, subagents }] of run.days) {
      if (day < from) continue;
      for (const [subagent, byModel] of [[false, main], [true, subagents]]) {
        for (const [model, usage] of byModel) {
          slices.push({ day, model, usage, subagent, session: `${run.harness}:${run.id}`, run });
        }
      }
    }
  }
  return slices;
}

const label = {
  day: (s) => s.day,
  project: (s) => (s.run.cwd ? basename(s.run.cwd.replace(/\\/g, '/')) : 'unknown'),
  model: (s) => normalizeModel(s.model),
  session: (s) => s.run.title || s.run.prompt || s.run.id.slice(0, 8),
};

export function report(runs, since, prices, by = 'day') {
  const rows = new Map();
  const total = newRow('total', 'total');
  for (const slice of slicesOf(runs, since)) {
    const key = by === 'session' ? slice.session : label[by](slice);
    if (!rows.has(key)) rows.set(key, newRow(key, label[by](slice)));
    addSlice(rows.get(key), slice, prices);
    addSlice(total, slice, prices);
  }
  const list = [...rows.values()];
  if (by === 'day') list.sort((a, b) => a.key.localeCompare(b.key));
  else list.sort((a, b) => b.cost - a.cost || tokensOf(b.usage) - tokensOf(a.usage));
  return { by, since, rows: list, total };
}

const count = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const money = (row) => (!row.priced ? null : `${row.unpriced ? '≥' : ''}${row.cost < 0.01 ? '<$0.01' : `$${row.cost.toFixed(2)}`}`);
const percent = (x) => (x === null ? '–' : `${Math.round(x * 100)}%`);
const subShare = (row) => (tokensOf(row.usage) ? tokensOf(row.subagents) / tokensOf(row.usage) : null);
const dayLabel = (key) => new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function bar(ui, value, max) {
  if (!max) return '';
  const cells = Math.max(value > 0 ? 1 : 0, Math.round((value / max) * BAR));
  return ui.color ? ui.tone('accent', '█'.repeat(cells)) : '#'.repeat(cells);
}

export function renderUsage({ by, since, rows, total }, ui) {
  if (!rows.length) return [`  ${ui.dim(`No agent sessions since ${dayLabel(dayKey(since.getTime()))}.`)}`];
  const out = [];
  // Bars follow cost when every model has a price, and tokens when one doesn't, so an unpriced model never looks free.
  const byCost = rows.every((r) => r.priced && !r.unpriced);
  const measure = (r) => (byCost ? r.cost : tokensOf(r.usage));
  const max = Math.max(...rows.map(measure));
  const shown = by === 'session' ? rows.slice(0, SESSION_ROWS) : rows;
  const name = (r) => (by === 'day' ? dayLabel(r.key) : ui.clip(r.label, 36));
  out.push(ui.section(`by ${by}`));
  out.push(ui.table(shown.map((r) => [
    ui.bold(name(r)), count(tokensOf(r.usage)), percent(cacheHit(r.usage)), percent(subShare(r)), money(r) || ui.dim('no price'), bar(ui, measure(r), max),
  ]), { head: [by, 'tokens', 'cached', 'subagents', 'cost', byCost ? '' : 'tokens'] }));
  if (shown.length < rows.length) out.push(ui.dim(`  … and ${rows.length - shown.length} more. --json lists them all.`));

  const u = total.usage;
  out.push('', ui.section('total'));
  out.push(`  ${ui.bold(count(tokensOf(u)))} tokens  ·  ${ui.bold(money(total) || '$0.00')} at list price  ·  ${ui.bold(String(total.sessions.size))} ${total.sessions.size === 1 ? 'session' : 'sessions'}`);
  out.push(ui.table([
    [ui.dim('input'), count(u.input), ui.dim('output'), count(u.output), ui.dim('cache read'), count(u.cacheRead), ui.dim('cache write'), count(u.cacheWrite5m + u.cacheWrite1h)],
  ], { gap: 2 }));
  out.push(`  ${ui.dim('cache hit')} ${percent(cacheHit(u))}  ·  ${ui.dim('subagents')} ${percent(subShare(total))} ${ui.dim('of tokens')}`);
  out.push('', ui.dim('  Cache reads cost about a tenth of fresh input, so a high cache hit keeps a big token count cheap.'));
  out.push(ui.dim('  Dollars are API list prices from pricing.json. A Claude subscription or a Copilot plan bills differently.'));
  return out;
}

const plainRow = (r) => ({
  key: r.key, label: r.label, tokens: tokensOf(r.usage), usage: r.usage, subagentTokens: tokensOf(r.subagents),
  cacheHit: cacheHit(r.usage), cost: r.priced ? r.cost : null, unpriced: r.unpriced, sessions: r.sessions.size,
});

export function usageCommand({ ui, json, flags, claudeHome, copilotHome, prices, cwd, now = new Date() }) {
  const unknown = flags.filter((f) => !f.startsWith('--since=') && !f.startsWith('--by=') && f !== '--here');
  if (unknown.length) throw new Error(`usage takes --since=<when>, --by=<${GROUPS.join('|')}>, and --here, not ${unknown.join(' ')}`);
  const by = flags.find((f) => f.startsWith('--by='))?.slice('--by='.length) || 'day';
  if (!GROUPS.includes(by)) throw new Error(`--by takes ${GROUPS.join(', ')}, not "${by}"`);
  const since = parseSince(flags.find((f) => f.startsWith('--since='))?.slice('--since='.length) || '7d', now);
  const here = flags.includes('--here') ? cwd.replace(/\\/g, '/').toLowerCase() : null;
  const runs = [...readClaudeRuns(claudeHome, since), ...readCopilotRuns(copilotHome, since)]
    .filter((r) => !here || (r.cwd || '').replace(/\\/g, '/').toLowerCase().startsWith(here));
  const result = report(runs, since, prices, by);
  if (json) {
    return `${JSON.stringify({ since: since.toISOString(), by, rows: result.rows.map(plainRow), total: plainRow(result.total) }, null, 2)}\n`;
  }
  return `${renderUsage(result, ui).join('\n')}\n`;
}
