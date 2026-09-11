import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const processMap=fs.readFileSync(new URL('../process-map.js',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../profile-action-runtime.js',import.meta.url),'utf8');

test('approved-profile runtime cannot reload or globally observe the whole document',()=>{
  assert.match(processMap,/profile-action-runtime\.js\?v=20260911-emergency-stable-v2/);
  assert.match(runtime,/PROFILE_ACTION_VERSION='20260911-reference-upload-cta-v3'/);
  assert.doesNotMatch(runtime,/location\?\.reload|location\.reload|window\.location\.reload/);
  assert.doesNotMatch(runtime,/new MutationObserver/,'approval UI sync must not install a global DOM observer that can starve first paint');
  assert.match(runtime,/leadintel:module-opened/);
  assert.match(runtime,/leadintel:profile-approved/);
});
