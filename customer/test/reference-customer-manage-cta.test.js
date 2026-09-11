import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../profile-action-runtime.js', import.meta.url), 'utf8');

test('Reference Customer manage CTA keeps the base UI click fallback available', () => {
  const marker = "const button=event.target?.closest?.('[data-reference-customers-manage]')";
  const start = runtime.indexOf(marker);
  assert.notEqual(start, -1, 'manage CTA handler must exist');
  const handler = runtime.slice(start, runtime.indexOf('},true);', start));
  assert.doesNotMatch(handler, /stopPropagation\s*\(/, 'manage CTA must not suppress the base Reference Customer UI handler');
});

test('Reference Customer opener recovers from a loaded UI open failure and restores upload runtime', () => {
  const start = runtime.indexOf('async function openReferenceCustomers()');
  assert.notEqual(start, -1, 'openReferenceCustomers must exist');
  const end = runtime.indexOf('\n  document.addEventListener', start);
  const fn = runtime.slice(start, end);
  assert.match(fn, /try\s*\{[\s\S]*LeadIntelReferenceCustomerUI\?\.open/, 'loaded UI open must be protected by try/catch');
  assert.match(fn, /reference-customer-upload-mode\.js/, 'fallback must restore the upload-mode runtime');
  assert.match(fn, /catch\s*\(/);
});
