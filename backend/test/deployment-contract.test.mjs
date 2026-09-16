import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {verifyBucketInfo,bucketListState} from '../scripts/verify-r2-bucket-json.mjs';

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
  const provision=workflow.indexOf('npx wrangler r2 bucket info "$EXPECTED_BUCKET" --json');
  const deploy=workflow.indexOf('run: npm run deploy');
  assert.ok(install>=0&&provision>install&&deploy>provision,'R2 provisioning must run after npm ci and before Worker deploy');
  assert.match(workflow,/npx wrangler r2 bucket create "\$EXPECTED_BUCKET"/);
  assert.match(workflow,/npx wrangler r2 bucket list --json/);
  assert.match(workflow,/verify-r2-bucket-json\.mjs info "\$EXPECTED_BUCKET"/);
  assert.match(workflow,/verify-r2-bucket-json\.mjs list "\$EXPECTED_BUCKET"/);
  assert.equal((workflow.match(/verify-r2-bucket-json\.mjs info "\$EXPECTED_BUCKET"/g)||[]).length,2,'initial and final info responses must both be parsed');
  assert.match(workflow,/R2 bucket verification failed for an existing bucket; refusing to deploy/);
  assert.match(workflow,/R2 bucket is absent; creating leadintel-brand-assets/);
  assert.match(workflow,/set -euo pipefail/);
});

test('R2 info verification accepts only valid JSON naming the exact production bucket',()=>{
  assert.equal(verifyBucketInfo('{"name":"leadintel-brand-assets"}','leadintel-brand-assets'),'found');
  for(const input of ['not-json','null','[]','{}','{"name":"other-bucket"}','{"name":42}']){
    assert.throws(()=>verifyBucketInfo(input,'leadintel-brand-assets'),/R2 bucket info/);
  }
});

test('R2 list verification distinguishes only valid exact absence from an existing bucket',()=>{
  assert.equal(bucketListState('[{"name":"leadintel-brand-assets"}]','leadintel-brand-assets'),'found');
  assert.equal(bucketListState('{"buckets":[{"name":"other-bucket"}]}','leadintel-brand-assets'),'absent');
  for(const input of ['not-json','null','{}','{"buckets":{}}','[{"name":42}]']){
    assert.throws(()=>bucketListState(input,'leadintel-brand-assets'),/R2 bucket list/);
  }
});

test('R2 verification CLI fails closed on malformed and mismatched successful command output',()=>{
  const script=path.join(root,'backend','scripts','verify-r2-bucket-json.mjs');
  for(const input of ['not-json','{"name":"other-bucket"}','{}']){
    const result=spawnSync(process.execPath,[script,'info','leadintel-brand-assets'],{input,encoding:'utf8'});
    assert.notEqual(result.status,0,input);
  }
  const valid=spawnSync(process.execPath,[script,'info','leadintel-brand-assets'],{input:'{"name":"leadintel-brand-assets"}',encoding:'utf8'});
  assert.equal(valid.status,0,valid.stderr);
  assert.equal(valid.stdout,'found');
});

test('production Worker declares its public Apollo callback URL and never stores signing material in wrangler vars',()=>{
  const wrangler=fs.readFileSync(wranglerPath,'utf8');
  assert.match(wrangler,/APOLLO_WEBHOOK_URL\s*=\s*"https:\/\/leadintel-api\.edgars-7e7\.workers\.dev\/api\/webhooks\/apollo\/crm-contact"/);
  assert.doesNotMatch(wrangler,/APOLLO_WEBHOOK_SECRET\s*=/);
  assert.doesNotMatch(wrangler,/BRAND_ASSET_IMPORT_HOSTS/,'disabled remote imports must not retain a misleading allowlist setting');
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
