const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const backend=fs.readFileSync(path.join(root,'.github/workflows/backend-ci.yml'),'utf8');
const customer=fs.readFileSync(path.join(root,'.github/workflows/customer-ci.yml'),'utf8');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
const releaseWorkflowPath=path.join(root,'.github/workflows/release-integrity.yml');

test('backend and customer CI protect main CRM releases',()=>{
  assert.match(backend,/branches:\s*[\s\S]*-\s*['"]?main['"]?/);
  assert.match(customer,/branches:\s*[\s\S]*-\s*['"]?main['"]?/);
  assert.match(backend,/node --check src\/crm\.js/);
  assert.match(backend,/node --check src\/crm-routes\.js/);
  assert.match(customer,/node --check customer\/crm-engine\.js/);
  assert.match(customer,/node --check customer\/crm-ui\.js/);
});

test('customer CI contains no retired GitHub Pages workflow dependency',()=>{
  assert.doesNotMatch(customer,/deploy-pages\.yml/);
});

test('README names current Vercel customer workspace and Cloudflare D1 backend',()=>{
  assert.match(readme,/https:\/\/leadintel\.ccgroup\.lv\/customer\//);
  assert.match(readme,/Vercel/i);
  assert.match(readme,/Cloudflare Worker \+ D1/i);
  assert.doesNotMatch(readme,/GitHub Pages fallback/i);
  assert.doesNotMatch(readme,/Production root:[^\n]*redirects to V2/i);
});

test('release integrity runs only after Customer V2 CI completes for main',()=>{
  assert.equal(fs.existsSync(releaseWorkflowPath),true,'release-integrity workflow must exist');
  const workflow=fs.readFileSync(releaseWorkflowPath,'utf8');
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/Customer V2 CI/);
  assert.match(workflow,/types:\s*\[?\s*completed/i);
  assert.match(workflow,/branches:\s*\[?\s*main/i);
  assert.match(workflow,/workflow_dispatch:/);
});

test('automatic release proof verifies the exact CI head SHA and conclusion',()=>{
  assert.equal(fs.existsSync(releaseWorkflowPath),true,'release-integrity workflow must exist');
  const workflow=fs.readFileSync(releaseWorkflowPath,'utf8');
  assert.match(workflow,/github\.event\.workflow_run\.head_sha/);
  assert.match(workflow,/github\.event\.workflow_run\.conclusion/);
  assert.match(workflow,/--expected-sha[\s\S]{0,120}workflow_run\.head_sha/);
  assert.match(workflow,/--ci-conclusion[\s\S]{0,120}workflow_run\.conclusion/);
  assert.doesNotMatch(workflow,/--expected-sha[^\n]*github\.sha/);
});

test('manual re-verification converts invalid CI evidence into a blocked proof instead of dying before proof generation',()=>{
  assert.equal(fs.existsSync(releaseWorkflowPath),true,'release-integrity workflow must exist');
  const workflow=fs.readFileSync(releaseWorkflowPath,'utf8');
  assert.match(workflow,/id:\s*manual_ci/);
  assert.match(workflow,/conclusion=failure/);
  assert.match(workflow,/GITHUB_OUTPUT/);
  assert.match(workflow,/steps\.manual_ci\.outputs\.conclusion/);
  assert.match(workflow,/--ci-conclusion[\s\S]{0,180}steps\.manual_ci\.outputs\.conclusion/);
});

test('release proof artifact is retained even when verifier blocks the release',()=>{
  assert.equal(fs.existsSync(releaseWorkflowPath),true,'release-integrity workflow must exist');
  const workflow=fs.readFileSync(releaseWorkflowPath,'utf8');
  assert.match(workflow,/actions\/upload-artifact@/);
  assert.match(workflow,/if:\s*always\(\)/);
  assert.match(workflow,/release-proof-/);
  assert.match(workflow,/release-proof\.json/);
});
