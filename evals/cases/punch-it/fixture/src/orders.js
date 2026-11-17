import { readFileSync } from 'node:fs';

const file = new URL('../data/orders.json', import.meta.url);

export function listOrders(customer) {
  const all = JSON.parse(readFileSync(file, 'utf8'));
  return all.filter((o) => o.customer === customer);
}
