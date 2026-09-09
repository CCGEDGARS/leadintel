import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../company-research-ui.js', import.meta.url), 'utf8');

test('company research render owns and restores Context Question 03', () => {
  assert.match(source, /function ensureLookalikeContextCard\(\)/);
  assert.match(source, /data-question="lookalike_customers"/);
  assert.match(source, /data-reference-customers-manage/);
  assert.match(source, /function renderResearchReview\(\)\{\s*ensureLookalikeContextCard\(\);/);
});
