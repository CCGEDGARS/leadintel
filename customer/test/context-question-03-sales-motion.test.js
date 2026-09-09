import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../process-map.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const language = fs.readFileSync(new URL('../language.js', import.meta.url), 'utf8');

test('Context Question 03 is present statically as sales motion', () => {
  const match = html.match(/<article class="question-card"[^>]*><span>03<\/span>[\s\S]*?<textarea data-question="sales_motion"[\s\S]*?<\/article>/);
  assert.ok(match, 'Question 03 must exist in static HTML with data-question="sales_motion" so it cannot disappear when runtime modules fail');
  assert.match(match[0], /How do customers typically buy from you\?/);
  assert.match(match[0], /Mostly direct B2B sales through outbound prospecting and referrals/);
});

test('Context Question 03 runtime keeps sales motion semantics', () => {
  assert.match(source, /How do customers typically buy from you\?/);
  assert.match(source, /data-question="sales_motion"/);
  assert.match(source, /Mostly direct B2B sales through outbound prospecting and referrals/);
});

test('sales motion is not written into legacy lookalike customer state', () => {
  assert.doesNotMatch(source, /sales_motion:value,lookalike_customers:value/);
  assert.doesNotMatch(source, /sales_motion:value\?"user":"missing",lookalike_customers:value\?"user":"missing"/);
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
