import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../process-map.js', import.meta.url), 'utf8');

test('Context Question 03 is sales motion, not legacy lookalike input', () => {
  assert.match(source, /How do customers typically buy from you\?/);
  assert.match(source, /data-question="sales_motion"/);
  assert.match(source, /Mostly direct B2B sales through outbound prospecting and referrals/);
});

test('legacy lookalike storage is isolated from the visible Context field', () => {
  assert.match(source, /data-legacy-sales-motion/);
  assert.match(source, /answers\.lookalike_customers/);
  assert.match(source, /answers\.sales_motion/);
});

test('Reference Customer Intelligence remains a separate optional tool', () => {
  assert.match(source, /Reference Customer Intelligence/);
  assert.match(source, /data-reference-customers-manage/);
});

test('sales motion never creates a false lookalike ICP', () => {
  assert.match(source, /patchMarketLookalikeIsolation/);
  assert.match(source, /lookalikeCustomers:""/);
});
