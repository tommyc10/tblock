import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const cli = new URL('../src/cli.js', import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('export prints the header and the customer\'s orders, newest first, totals to two places', () => {
  const r = run('export', 'c-1');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'id,placedAt,total,status\no-103,2026-10-01,7.25,open\no-101,2026-09-02,42.50,shipped\no-104,2026-08-19,100.00,refunded\n');
});

test('export leaves other customers out', () => {
  assert.equal(run('export', 'c-2').stdout, 'id,placedAt,total,status\no-102,2026-09-14,12.00,open\n');
});

test('a customer with no orders gets only the header and exit 0', () => {
  const r = run('export', 'c-9');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'id,placedAt,total,status\n');
});

test('export with no customer is a usage error', () => {
  const r = run('export');
  assert.notEqual(r.status, 0);
  assert.equal(r.stdout, '');
});
