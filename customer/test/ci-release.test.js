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

test('automatic release integrity runs after the relevant verified workflow completes for main',()=>{
  assert.equal(fs.existsSync(releaseWorkflowPath),true,'release-integrity workflow must exist');
  const workflow=fs.readFileSync(releaseWorkflowPath,'utf8');
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/workflows:\s*\[[\s\S]*Backend Deploy/);
  assert.match(workflow,/workflows:\s*\[[\s\S]*Customer V2 CI/);
  assert.match(workflow,/types:\s*\[?\s*completed/i);
  assert.match(workflow,/branches:\s*\[?\s*main/i);
  assert.match(workflow,/EVENT_WORKFLOW/);
});

test('automatic release proof requires exact Customer V2 CI and backend evidence when backend changes are present',()=>{
  assert.equal(fs.existsSync(releaseWorkflowPath),true,'release-integrity workflow must exist');
  const workflow=fs.readFileSync(releaseWorkflowPath,'utf8');
  assert.match(workflow,/github\.event\.workflow_run\.head_sha/);
  assert.match(workflow,/github\.event\.workflow_run\.conclusion/);
  assert.match(workflow,/id:\s*automatic_ci/);
  assert.match(workflow,/Customer V2 CI/);
  assert.match(workflow,/Backend Deploy/);
  assert.match(workflow,/changed_backend/);
  assert.match(workflow,/backend_required/);
  assert.match(workflow,/actions\/workflows\/backend-deploy\.yml\/runs/);
  assert.match(workflow,/ci_conclusion=failure/);
  assert.match(workflow,/steps\.automatic_ci\.outputs\.conclusion/);
  assert.match(workflow,/--expected-sha[\s\S]{0,180}workflow_run\.head_sha/);
  assert.match(workflow,/--ci-conclusion[\s\S]{0,180}steps\.automatic_ci\.outputs\.conclusion/);
  assert.doesNotMatch(workflow,/--expected-sha[^\n]*github\.sha/);
});

test('manual re-verification requires both Customer V2 CI and Backend Deploy evidence and blocks invalid evidence safely',()=>{
  assert.equal(fs.existsSync(releaseWorkflowPath),true,'release-integrity workflow must exist');
  const workflow=fs.readFileSync(releaseWorkflowPath,'utf8');
  assert.match(workflow,/deploy_run_id:/);
  assert.match(workflow,/DEPLOY_RUN_ID/);
  assert.match(workflow,/Backend Deploy/);
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
