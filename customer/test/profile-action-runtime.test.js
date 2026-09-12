import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../profile-action-runtime.js', import.meta.url), 'utf8');

test('profile action runtime mirrors approval presentation without owning actions', () => {
  assert.match(source, /approved\?'Continue to Market Strategy →':'Approve Profile'/);
  assert.match(source, /if\(button\.disabled\)button\.disabled=false/);
  assert.match(source, /approved\?'Continue to Market Strategy →':'Approve Profile'/);
  assert.doesNotMatch(source, /document\.addEventListener\(['"]click['"]/);
  assert.doesNotMatch(source, /openMarketStrategy/);
  assert.doesNotMatch(source, /persistApprovedState/);
});

test('profile approval runtime is loaded by the process map with the single-owner cache key', () => {
  const processMap = fs.readFileSync(new URL('../process-map.js', import.meta.url), 'utf8');
  assert.match(processMap, /profile-action-runtime\.js\?v=20260912-bottom-profile-actions-v1/);
});


test('profile approval reads only editable textarea fields', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /querySelectorAll\(["']textarea\\[data-profile-field\\]["']\)/);
  assert.doesNotMatch(app, /querySelectorAll\(["']\\[data-profile-field\\]["']\)/);
});
