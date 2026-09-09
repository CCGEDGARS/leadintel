import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../process-map.js', import.meta.url), 'utf8');

test('Context Question 03 is restored after late research and workspace lifecycle events', () => {
  assert.match(source, /function ensureContextQuestion03\(\)/);
  assert.match(source, /function restoreContextQuestion03Soon\(\)/);
  assert.match(source, /data-question="lookalike_customers"/);
  assert.match(source, /data-reference-customers-manage/);
  assert.match(source, /leadintel:server-ready/);
  assert.match(source, /leadintel:workspace-changed/);
  assert.match(source, /leadintel:module-opened/);
  assert.match(source, /\[0,120,400,1000\]/);
  assert.doesNotMatch(source, /MutationObserver\([^)]*ensureContextQuestion03/);
});
