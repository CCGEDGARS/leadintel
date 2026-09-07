import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('only the active research mode is labelled Researching while a run is active',()=>{
  assert.doesNotMatch(app,/researchButtons\.forEach\(button=>\{button\.disabled=true;button\.textContent="Researching…";\}\)/);
  assert.match(app,/activeResearchButtonId/);
  assert.match(app,/status==="running"\?\(id===activeResearchButtonId\?"Researching…":label\)/);
});
