const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

test('workspace persistence boundary initializes before app state is loaded',()=>{
  const importMatch=app.match(/^import ['"]\.\/workspace-persistence\.js\?[^'"\s]+['"];?/m);
  assert.ok(importMatch,'app.js must import the persistence boundary directly');
  assert.match(importMatch[0],/workspace-save=20261020-v1/);
  const importIndex=app.indexOf(importMatch[0]);
  const stateIndex=app.indexOf('state=loadState()',app.lastIndexOf('function init()'));
  assert.ok(importIndex>=0&&stateIndex>importIndex,'persistence must initialize before app state is loaded');
});

test('process map reuses the same startup-order persistence module URL',()=>{
  const signature=app.match(/^import ['"]\.\/workspace-persistence\.js\?[^'"\s]+['"];?/m)?.[0];
  assert.ok(signature);assert.ok(processMap.includes(signature),'both entry points must use one persistence module identity');
});
