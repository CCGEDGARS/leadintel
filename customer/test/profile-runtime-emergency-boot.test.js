import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const processMap=fs.readFileSync(new URL('../process-map.js',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../profile-action-runtime.js',import.meta.url),'utf8');

test('profile action runtime is cache-busted after the approval regression rollback',()=>{
  assert.match(processMap,/profile-action-runtime\.js\?v=20260911-emergency-stable-v1/);
  assert.match(runtime,/PROFILE_ACTION_VERSION='20260911-reference-upload-cta-v1'/);
  assert.match(runtime,/setTimeout\(\(\)=>root\.location\?\.reload\?\.\(\),60\)/);
});
