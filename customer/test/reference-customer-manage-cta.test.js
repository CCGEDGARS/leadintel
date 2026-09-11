import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const launcher = fs.readFileSync(new URL('../reference-customer-launcher.js', import.meta.url), 'utf8');
const profileRuntime = fs.readFileSync(new URL('../profile-action-runtime.js', import.meta.url), 'utf8');

test('Reference Customer manage CTA is handled by the dedicated launcher without suppressing other UI handlers', () => {
  const marker = "const button=event.target?.closest?.('[data-reference-customers-manage]')";
  const start = launcher.indexOf(marker);
  assert.notEqual(start, -1, 'dedicated manage CTA handler must exist');
  const handler = launcher.slice(start, launcher.indexOf('\n  });', start));
  assert.doesNotMatch(handler, /stopPropagation\s*\(/, 'manage CTA must not suppress other Reference Customer UI handlers');
  assert.doesNotMatch(handler, /stopImmediatePropagation\s*\(/);
  assert.doesNotMatch(profileRuntime, /data-reference-customers-manage/, 'profile approval runtime must not own Reference Customer launch clicks');
});

test('Reference Customer launcher restores the upload runtime before opening the manager', () => {
  const start = launcher.indexOf('async function ensureReferenceCustomerRuntime()');
  assert.notEqual(start, -1, 'ensureReferenceCustomerRuntime must exist');
  const end = launcher.indexOf('\n  async function open()', start);
  const fn = launcher.slice(start, end);
  assert.match(fn, /reference-customers\.js/, 'launcher must load the base Reference Customer runtime');
  assert.match(fn, /reference-customer-ui\.js/, 'launcher must load the manager UI');
  assert.match(fn, /reference-customer-upload-mode\.js/, 'launcher must restore the upload-mode runtime');
  assert.match(launcher, /LeadIntelReferenceCustomerUI\?\.open/, 'launcher must open the Reference Customer manager');
});
