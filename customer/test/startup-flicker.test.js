const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const app=read('app.js');
const persistence=read('workspace-persistence.js');

test('workspace persistence initializes before app state and never reloads the page during startup cleanup',()=>{
  const importIndex=app.indexOf("import './workspace-persistence.js?v=20260903-startup-flicker-v1';");
  const stateIndex=app.indexOf('let state=loadState();');
  assert.ok(importIndex>=0,'app.js must import the persistence boundary directly');
  assert.ok(importIndex<stateIndex,'persistence boundary must execute before app state is loaded or written');
  assert.doesNotMatch(persistence,/location\?*\.reload|location\.reload|root\.location\?\.reload/,'startup cleanup must not force a browser reload');
  assert.match(persistence,/const changed=prepareForLoad\(\);/,'startup cleanup still runs before the app initializes');
});
