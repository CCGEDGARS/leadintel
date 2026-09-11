import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const processMap=fs.readFileSync(new URL('../process-map.js',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../profile-action-runtime.js',import.meta.url),'utf8');

test('approved-profile runtime cannot reload, globally observe the whole document, or own Reference Customer launch clicks',()=>{
  assert.match(processMap,/profile-action-runtime\.js\?v=20260911-emergency-stable-v1/);
  assert.doesNotMatch(runtime,/location\?\.reload|location\.reload|window\.location\.reload/);
  assert.doesNotMatch(runtime,/new MutationObserver/,'approval UI sync must not install a global DOM observer that can starve first paint');
  assert.doesNotMatch(runtime,/data-reference-customers-manage/,'profile approval runtime must remain isolated from Reference Customer launch behavior');
  assert.match(runtime,/leadintel:module-opened/);
  assert.match(runtime,/leadintel:profile-approved/);
});
