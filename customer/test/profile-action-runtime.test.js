import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../profile-action-runtime.js', import.meta.url), 'utf8');

test('profile approval uses one clear stateful control', () => {
  assert.match(source, /approved\?'✓ Profile Approved':'Approve Profile'/);
  assert.match(source, /button\.disabled=approved/);
  assert.match(source, /card\.hidden=true/);
});

test('profile approval runtime is loaded by the process map', () => {
  const processMap = fs.readFileSync(new URL('../process-map.js', import.meta.url), 'utf8');
  assert.match(processMap, /profile-action-runtime\.js/);
});
