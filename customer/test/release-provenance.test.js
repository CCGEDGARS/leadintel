const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'../..');
const buildPath=path.join(root,'scripts/build-vercel-static.sh');
const policyPath=path.join(root,'docs/superpowers/specs/2026-08-31-release-provenance.md');
const configPath=path.join(root,'release-integrity.config.json');
const corePath=path.join(root,'scripts/release-integrity-core.mjs');
const cliPath=path.join(root,'scripts/verify-release-integrity.mjs');
const workflowPath=path.join(root,'.github/workflows/release-integrity.yml');

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

test('machine-readable release integrity chain is repository-owned',()=>{
  for(const file of [configPath,corePath,cliPath,workflowPath])assert.equal(fs.existsSync(file),true,`${path.relative(root,file)} must exist`);
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  const core=fs.readFileSync(corePath,'utf8');
  const cli=fs.readFileSync(cliPath,'utf8');
  const workflow=fs.readFileSync(workflowPath,'utf8');
  assert.equal(config.application,'LeadIntel');
  assert.equal(config.productionUrl,'https://leadintel.ccgroup.lv');
  assert.match(core,/BLOCKED_STALE_DEPLOYMENT/);
  assert.match(core,/BLOCKED_BACKEND_HEALTH/);
  assert.match(core,/BLOCKED_SMOKE_CHECK/);
  assert.match(cli,/release-proof\.json/);
  assert.match(workflow,/release-proof\.json/);
});
