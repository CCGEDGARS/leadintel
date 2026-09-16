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
const customerCiPath=path.join(root,'.github','workflows','customer-ci.yml');

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
  const install=workflow.indexOf('run: npm ci');
  const migrate=workflow.indexOf('run: npm run db:remote');
  const deploy=workflow.indexOf('run: npm run deploy');
  assert.ok(install>=0&&migrate>install&&deploy>migrate,'D1 migrations must run after npm ci and before Worker deploy');
  assert.doesNotMatch(workflow,/wrangler r2 bucket/,'production deploy must not depend on optional account-level R2 activation');
  assert.match(workflow,/set -euo pipefail/);
});

test('production Worker declares its public Apollo callback URL and never stores signing material in wrangler vars',()=>{
  const wrangler=fs.readFileSync(wranglerPath,'utf8');
  assert.match(wrangler,/APOLLO_WEBHOOK_URL\s*=\s*"https:\/\/leadintel-api\.edgars-7e7\.workers\.dev\/api\/webhooks\/apollo\/crm-contact"/);
  assert.doesNotMatch(wrangler,/APOLLO_WEBHOOK_SECRET\s*=/);
  assert.doesNotMatch(wrangler,/BRAND_ASSET_IMPORT_HOSTS/,'disabled remote imports must not retain a misleading allowlist setting');
  assert.doesNotMatch(wrangler,/\[\[r2_buckets\]\]/,'brand assets use the existing D1 deployment and must not require account-level R2 activation');
});

test('Backend CI syntax-checks the signed Apollo webhook module and protects deployment workflow changes',()=>{
  const ci=fs.readFileSync(backendCiPath,'utf8');
  assert.match(ci,/node --check src\/apollo-crm-webhook\.js/);
  assert.match(ci,/\.github\/workflows\/backend-deploy\.yml/);
});

test('Customer V2 CI runs for deployable backend changes so integrated release proof can use the exact same SHA',()=>{
  const ci=fs.readFileSync(customerCiPath,'utf8');
  assert.match(ci,/- 'backend\/\*\*'/);
  assert.match(ci,/\.github\/workflows\/backend-ci\.yml/);
  assert.match(ci,/\.github\/workflows\/backend-deploy\.yml/);
});
