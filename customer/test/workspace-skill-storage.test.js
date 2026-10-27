const {test}=require('node:test'),assert=require('node:assert/strict');const fs=require('node:fs');
test('workspace storage key policy explicitly meters skills without admitting arbitrary paths',()=>{const source=fs.readFileSync('backend/src/workspace-storage-objects.js','utf8');assert.match(source,/skills/);assert.match(source,/input/);assert.match(source,/package/);});
