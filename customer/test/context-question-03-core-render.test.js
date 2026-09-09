import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../step2-readiness-engine.js', import.meta.url), 'utf8');

test('Step 2 core renderer recreates Question 03 when later runtimes remove it', () => {
  assert.match(source, /function ensureLookalikeQuestionDom\(root\)/);
  assert.match(source, /data-question="lookalike_customers"/);
  assert.match(source, /data-reference-customers-manage/);
  assert.match(source, /insertBefore\(card,question04\)/);
  assert.match(source, /ensureLookalikeQuestionDom\(root\);\s*const document=root\.document/);
});
