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

test('Reference Customer launcher opens the already-loaded UI synchronously', () => {
  assert.doesNotMatch(launcher, /await\s+import\s*\(/, 'launcher click path must not wait on dynamic imports');
  assert.doesNotMatch(launcher, /let\s+opening\s*=|opening=\(/, 'launcher must not maintain a pending async opening state');
  assert.match(launcher, /LeadIntelReferenceCustomerUI\?\.open/);
  assert.match(launcher, /function\s+open\s*\(\)/);
  assert.match(launcher, /return\s+true/);
});
