import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../process-map.js', import.meta.url), 'utf8');
const language = fs.readFileSync(new URL('../language.js', import.meta.url), 'utf8');

test('Commercial Intelligence Brief has no legacy sales-motion runtime injection', () => {
  assert.doesNotMatch(source, /How do customers typically buy from you\?/);
  assert.doesNotMatch(source, /data-question="sales_motion"/);
  assert.doesNotMatch(source, /configureSalesMotionQuestion03/);
});

test('legacy lookalike recovery is no longer bootstrapped', () => {
  assert.doesNotMatch(language, /step2-reference-question-runtime/);
  assert.doesNotMatch(source, /scheduleRepairs|ensureReferenceQuestion/);
});

test('Reference Customer Intelligence is presented as a core Lookalike targeting step', () => {
  assert.match(source, /Core targeting step/);
  assert.match(source, /Build your Lookalike Audience/);
  assert.match(source, /directly improves Discovery/);
  assert.match(source, /data-reference-customers-manage/);
  assert.match(source, /brand-identity-panel reference-customer-core-card/, 'Lookalike step must use the established green feature-panel treatment');
  assert.match(source, /brand-identity-summary/);
  assert.match(source, /brand-identity-status/);
  assert.match(source, /brand-identity-toggle/);
  assert.doesNotMatch(source, /Optional advanced tool/);
});

test('sales motion never creates a false lookalike ICP', () => {
  assert.match(source, /patchMarketLookalikeIsolation/);
  assert.match(source, /lookalikeCustomers:""/);
});
