const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const profile=require('../profile-engine.js');
const appSource=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('visible browser-restored website takes precedence over stale empty state',()=>{
  assert.equal(typeof profile.resolveWebsite,'function');
  assert.equal(profile.resolveWebsite('', 'www.ccgroup.lv'),'https://www.ccgroup.lv/');
  assert.equal(profile.resolveWebsite('https://old.example.com/','www.ccgroup.lv'),'https://www.ccgroup.lv/');
});

test('navigation and completeness use the currently visible website value',()=>{
  assert.match(appSource,/function currentWebsite\(\)/);
  assert.match(appSource,/calculateCompleteness\([^)]*website:currentWebsite\(\)/);
  assert.match(appSource,/canAccessModule\([^)]*website:currentWebsite\(\)/);
});
