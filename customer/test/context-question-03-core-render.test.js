import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../process-map.js', import.meta.url), 'utf8');

test('Context navigation owns Question 03 and recreates it before/after Step 2 opens', () => {
  assert.match(source, /function ensureContextQuestion03\(\)/);
  assert.match(source, /data-question="lookalike_customers"/);
  assert.match(source, /data-reference-customers-manage/);
  assert.match(source, /insertBefore\(card,question04\)/);
  assert.match(source, /if\(target===2\)ensureContextQuestion03\(\)/);
  assert.match(source, /if\(target===2\)setTimeout\(ensureContextQuestion03,0\)/);
  assert.match(source, /leadintel:module-opened/);
});
