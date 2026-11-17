import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const cli = new URL('../src/cli.js', import.meta.url).pathname;

test('list keeps its format and order', () => {
  const r = spawnSync(process.execPath, [cli, 'list', 'c-1'], { encoding: 'utf8' });
  assert.equal(r.stdout, 'o-101  2026-09-02  42.50  shipped\no-103  2026-10-01  7.25  open\no-104  2026-08-19  100.00  refunded\n');
});
