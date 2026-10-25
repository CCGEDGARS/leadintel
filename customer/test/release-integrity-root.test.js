const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const repoRoot=path.join(__dirname,'..','..');
const config=JSON.parse(fs.readFileSync(path.join(repoRoot,'release-integrity.config.json'),'utf8'));
const rootHtml=fs.readFileSync(path.join(repoRoot,'index.html'),'utf8');
const backendCi=fs.readFileSync(path.join(repoRoot,'.github','workflows','backend-ci.yml'),'utf8');

function smoke(id){return config.smokeChecks.find(item=>item.id===id);}
function escaped(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

test('release integrity validates the invitation-only sign-in page at the production root',()=>{
  const entry=smoke('production-entry');
  assert.ok(entry,'production-entry smoke check must exist');
  assert.equal(entry.url,'/');
  assert.equal(entry.status,200);
  assert.ok(entry.contains.includes('Sign in to LeadIntel'),'root proof must require the sign-in page');
  assert.ok(entry.contains.includes('href="/api/auth/google/start"'),'root proof must require Google sign-in');
  assert.ok(entry.contains.includes('href="/api/auth/microsoft/start"'),'root proof must require Microsoft sign-in');
  assert.ok(entry.contains.includes('invite-required'),'root proof must require the invitation notice');
  assert.ok(entry.contains.includes("response.ok)location.replace('/customer/')"),'root proof must require the session-guarded workspace redirect');
  assert.ok(entry.notContains.includes('href="LeadIntel.html"'),'root proof must reject the retired legacy chooser');
  assert.ok(entry.notContains.includes("location.replace('/v2/')"),'root proof must continue rejecting the retired v2 redirect');
  for(const marker of entry.contains)assert.match(rootHtml,new RegExp(escaped(marker)));
  for(const marker of entry.notContains)assert.doesNotMatch(rootHtml,new RegExp(escaped(marker)));
  const gate=smoke('invite-only-workspace-gate');
  assert.ok(gate,'workspace gate smoke check must exist');
  assert.equal(gate.url,'/customer/access-gate.js');
  const gateSource=fs.readFileSync(path.join(repoRoot,'customer','access-gate.js'),'utf8');
  for(const marker of gate.contains)assert.match(gateSource,new RegExp(escaped(marker)));
});

test('release policy changes trigger backend verification so automatic proof always has an exact-SHA deployment',()=>{
  for(const tracked of [
    'release-integrity.config.json',
    '.github/workflows/release-integrity.yml',
    'scripts/verify-release-integrity.mjs'
  ])assert.match(backendCi,new RegExp(escaped(tracked)),`${tracked} must trigger Backend CI`);
});
