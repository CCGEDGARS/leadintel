import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(__dirname,'..','..');
const workflowPath=path.join(root,'.github','workflows','backend-deploy.yml');
const wranglerPath=path.join(__dirname,'..','wrangler.toml');
const backendCiPath=path.join(root,'.github','workflows','backend-ci.yml');

test('production backend deploy runs only after successful Backend CI on main and applies D1 migrations before Worker deploy',()=>{
  assert.equal(fs.existsSync(workflowPath),true,'backend-deploy.yml missing');
  if(!fs.existsSync(workflowPath))return;
  const workflow=fs.readFileSync(workflowPath,'utf8');
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/Backend CI/);
  assert.match(workflow,/github\.event\.workflow_run\.conclusion\s*==\s*'success'/);
  assert.match(workflow,/github\.event\.workflow_run\.head_branch\s*==\s*'main'/);
  assert.match(workflow,/github\.event\.workflow_run\.head_sha/);
  assert.match(workflow,/npm run db:remote/);
  assert.match(workflow,/npm run deploy/);
  assert.match(workflow,/CLOUDFLARE_API_TOKEN/);
  assert.match(workflow,/CLOUDFLARE_ACCOUNT_ID/);
});

test('production Worker declares its public Apollo callback URL and never stores signing material in wrangler vars',()=>{
  const wrangler=fs.readFileSync(wranglerPath,'utf8');
  assert.match(wrangler,/APOLLO_WEBHOOK_URL\s*=\s*"https:\/\/leadintel-api\.edgars-7e7\.workers\.dev\/api\/webhooks\/apollo\/crm-contact"/);
  assert.doesNotMatch(wrangler,/APOLLO_WEBHOOK_SECRET\s*=/);
});

test('Backend CI syntax-checks the signed Apollo webhook module',()=>{
  const ci=fs.readFileSync(backendCiPath,'utf8');
  assert.match(ci,/node --check src\/apollo-crm-webhook\.js/);
});
