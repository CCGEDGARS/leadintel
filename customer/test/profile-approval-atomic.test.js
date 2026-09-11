import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function approveBody(){
  const match=source.match(/function approveProfile\(\)\{([\s\S]*?)\n\}/);
  assert.ok(match,'approveProfile() must exist');
  return match[1];
}

test('profile approval is persisted before market strategy generation can fail',()=>{
  const body=approveBody();
  const approvedAt=body.indexOf('state.approved=true');
  const savedAt=body.indexOf('saveState()');
  const seedAt=body.indexOf('seedMarketStrategy()');
  assert.ok(approvedAt>=0,'approval state must be set');
  assert.ok(savedAt>approvedAt,'approval state must be persisted');
  assert.ok(seedAt>savedAt,'market strategy generation must happen only after approval is persisted');
});

test('market strategy generation cannot make the Approve Profile button inert',()=>{
  const body=approveBody();
  assert.match(body,/try\{seedMarketStrategy\(\);saveState\(\);\}catch\(error\)\{/);
  assert.match(body,/renderProfile\(\)/);
  assert.match(body,/leadintel:profile-approved/);
});
