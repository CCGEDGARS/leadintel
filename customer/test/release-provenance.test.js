const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'../..');
const buildPath=path.join(root,'scripts/build-vercel-static.sh');
const policyPath=path.join(root,'docs/superpowers/specs/2026-08-31-release-provenance.md');

test('every deployed artifact exposes exact Git provenance for stale-build detection',()=>{
  const build=fs.readFileSync(buildPath,'utf8');
  assert.match(build,/release\.json/);
  assert.match(build,/VERCEL_GIT_COMMIT_SHA/);
  assert.match(build,/VERCEL_GIT_COMMIT_REF/);
  assert.match(build,/git rev-parse HEAD/);
  assert.match(build,/Cache-Control|no-store|provenance/i);
});

test('LeadIntel has a mandatory proven-link gate before any build is presented as current',()=>{
  assert.equal(fs.existsSync(policyPath),true,'release provenance policy must exist');
  const policy=fs.readFileSync(policyPath,'utf8');
  assert.match(policy,/exact.*commit SHA/i);
  assert.match(policy,/CI.*success/i);
  assert.match(policy,/Vercel.*READY/i);
  assert.match(policy,/release\.json/i);
  assert.match(policy,/api\/health.*200/i);
  assert.match(policy,/never.*present.*old|never.*label.*current|do not.*present.*current/i);
});
