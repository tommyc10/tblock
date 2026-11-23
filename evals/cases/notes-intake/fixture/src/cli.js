#!/usr/bin/env node
import { listOrders } from './orders.js';

const [command, customer] = process.argv.slice(2);

if (command === 'list' && customer) {
  for (const o of listOrders(customer)) console.log(`${o.id}  ${o.placedAt}  ${o.total.toFixed(2)}  ${o.status}`);
} else {
  console.error('usage: orders list <customer>');
  process.exit(1);
}
