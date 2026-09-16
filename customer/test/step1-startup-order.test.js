const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

test('workspace persistence boundary initializes before app state is loaded',()=>{
  const importMatch=app.match(/^import ['"]\.\/workspace-persistence\.js\?v=20260916-brand-assets-v10['"];?/m);
  assert.ok(importMatch,'app.js must import the persistence boundary directly');
  const importIndex=app.indexOf(importMatch[0]);
  const stateIndex=app.indexOf('let state=loadState()');
  assert.ok(importIndex>=0&&stateIndex>importIndex,'persistence must initialize before app state is loaded');
});

test('process map reuses the same startup-order persistence module URL',()=>{
  assert.match(processMap,/import ['"]\.\/workspace-persistence\.js\?v=20260916-brand-assets-v10['"]/);
});
