const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','canonical-profile-runtime.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('profile approval remains authoritative when the profile continuation is clicked',()=>{
  assert.match(app,/state\.approved=true/);
  assert.match(app,/Continue to Market Strategy/);
  assert.match(app,/\$\("approve-profile"\)\.addEventListener\("click",\(\)=>approveProfile\(\)\)/);
  assert.match(app,/\$\("continue-market-strategy"\)\.addEventListener\("click",openMarketStrategy\)/);
  assert.match(app,/continueButton\.disabled=!approved/);
  assert.doesNotMatch(runtime,/approve-profile-bottom/);
});
