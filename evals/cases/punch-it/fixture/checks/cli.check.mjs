import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const cli = new URL('../src/cli.js', import.meta.url).pathname;

test('list prints one line per order of the customer', () => {
  const out = execFileSync(process.execPath, [cli, 'list', 'c-2'], { encoding: 'utf8' });
  assert.equal(out, 'o-102  2026-09-14  12.00  open\n');
});
