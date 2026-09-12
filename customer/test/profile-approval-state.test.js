const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','canonical-profile-runtime.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('profile approval remains authoritative after Approve Profile is clicked',()=>{
  assert.match(app,/state\.approved=true/);
  assert.match(app,/textContent=approved\?"Continue to Market Strategy →":"Approve Profile"/);
  assert.doesNotMatch(runtime,/#approve-profile,#approve-profile-bottom/);
});
