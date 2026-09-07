import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('LinkedIn public signal extension is loaded and clearly labelled',()=>{
  const processMap=fs.readFileSync(new URL('../process-map.js',import.meta.url),'utf8');
  const extension=fs.readFileSync(new URL('../linkedin-signals.js',import.meta.url),'utf8');
  assert.match(processMap,/linkedin-signals\.js/);
  assert.match(extension,/LinkedIn public signals/);
  assert.match(extension,/does not bypass LinkedIn login restrictions/);
  assert.match(extension,/linkedin-public-index/);
  assert.doesNotMatch(extension,/sourceKind\s*:\s*["']linkedin-api["']/);
});
