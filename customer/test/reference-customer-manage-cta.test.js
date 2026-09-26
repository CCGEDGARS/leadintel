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

test('Reference Customer manager opens before optional upload runtime loading', () => {
  assert.match(launcher, /if\(root\.LeadIntelReferenceCustomerUI\?\.open\)\{\s*root\.LeadIntelReferenceCustomerUI\.open\(segment\)/, 'already-loaded manager must open synchronously');
  const start = launcher.indexOf('async function ensureReferenceCustomerRuntime()');
  assert.notEqual(start, -1, 'ensureReferenceCustomerRuntime must exist');
  const end = launcher.indexOf('\n  function warmUploadRuntime', start + 1);
  const ensureFn = launcher.slice(start, end);
  assert.match(ensureFn, /reference-customers\.js/, 'launcher must load the base Reference Customer runtime when missing');
  assert.match(ensureFn, /reference-customer-ui\.js/, 'launcher must load the manager UI when missing');
  assert.doesNotMatch(ensureFn, /reference-customer-upload-mode\.js/, 'opening must not wait for optional upload mode');
  assert.match(launcher, /function warmUploadRuntime\(\)/, 'upload mode must warm separately');
  assert.match(launcher, /reference-customer-upload-mode\.js/, 'optional upload mode must still be loaded');
});
