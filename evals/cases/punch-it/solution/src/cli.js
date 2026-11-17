#!/usr/bin/env node
import { listOrders } from './orders.js';

const [command, customer] = process.argv.slice(2);

if (command === 'list' && customer) {
  for (const o of listOrders(customer)) console.log(`${o.id}  ${o.placedAt}  ${o.total.toFixed(2)}  ${o.status}`);
} else if (command === 'export' && customer) {
  const rows = listOrders(customer).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  console.log('id,placedAt,total,status');
  for (const o of rows) console.log([o.id, o.placedAt, o.total.toFixed(2), o.status].join(','));
} else {
  console.error('usage: orders list <customer> | orders export <customer>');
  process.exit(1);
}
