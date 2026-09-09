import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../process-map.js', import.meta.url), 'utf8');
const language = fs.readFileSync(new URL('../language.js', import.meta.url), 'utf8');

test('Context Question 03 is sales motion, not legacy lookalike input', () => {
  assert.match(source, /How do customers typically buy from you\?/);
  assert.match(source, /data-question="sales_motion"/);
  assert.match(source, /Mostly direct B2B sales through outbound prospecting and referrals/);
});

test('legacy lookalike recovery is no longer bootstrapped', () => {
  assert.doesNotMatch(language, /step2-reference-question-runtime/);
  assert.doesNotMatch(source, /scheduleRepairs|ensureReferenceQuestion/);
});

test('Reference Customer Intelligence remains a separate optional tool', () => {
  assert.match(source, /Reference Customer Intelligence/);
  assert.match(source, /data-reference-customers-manage/);
});

test('sales motion never creates a false lookalike ICP', () => {
  assert.match(source, /patchMarketLookalikeIsolation/);
  assert.match(source, /lookalikeCustomers:""/);
});
