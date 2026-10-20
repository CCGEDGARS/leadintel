const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'../..');
const customer=fs.readFileSync(path.join(root,'.github/workflows/customer-ci.yml'),'utf8');

test('Customer V2 CI is triggered by release integrity source and policy changes',()=>{
  for(const requiredPath of [
    'release-integrity.config.json',
    'scripts/release-integrity-core.mjs',
    'scripts/verify-release-integrity.mjs',
    '.github/workflows/release-integrity.yml',
    '.agents/skills/release-integrity/**',
    '.agents/skills/release-verification/SKILL.md',
    'docs/release-integrity-template.md',
    'docs/superpowers/specs/2026-08-31-release-provenance.md',
    'AGENTS.md'
  ])assert.match(customer,new RegExp(requiredPath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('Customer V2 CI syntax-checks release integrity executables',()=>{
  assert.match(customer,/node --check scripts\/release-integrity-core\.mjs/);
  assert.match(customer,/node --check scripts\/verify-release-integrity\.mjs/);
});

const workflow=fs.readFileSync(path.join(root,'.github/workflows/release-integrity.yml'),'utf8');
const {spawnSync}=require('node:child_process');
function selectedBackendEvidence(runs){
 const line=workflow.split('\n').find(line=>line.includes('actions/workflows/backend-deploy.yml/runs')&&line.includes('.status == "completed"'));
 assert.ok(line,'the actual workflow must resolve completed backend runs');
 const expression=line.match(/jq -r --arg sha "\$\{EXPECTED_SHA\}" '([^']+)'/)[1];
 const result=spawnSync('jq',['-r','--arg','sha','expected',expression],{input:JSON.stringify({workflow_runs:runs}),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return result.stdout.trim().split('\n').filter(Boolean)[0]||'';
}
test('backend release evidence ignores skipped runs while retaining real failure and exact-SHA gates',()=>{
 const run=(id,conclusion,head_sha='expected',status='completed')=>({id,conclusion,head_sha,status});
 assert.equal(selectedBackendEvidence([run(3,'skipped'),run(2,'success'),run(1,'success','other')]),'2\texpected\tsuccess');
 assert.equal(selectedBackendEvidence([run(4,'skipped'),run(3,'failure'),run(2,'success')]),'3\texpected\tfailure','a real latest deployment failure must never fall back to older success');
 assert.equal(selectedBackendEvidence([run(3,'skipped'),run(2,'success','other'),run(1,null,'expected','in_progress')]),'','a skipped or unfinished run cannot prove deployment');
});
test('a skipped upstream workflow cannot initiate a failed production proof',()=>{
 assert.match(workflow,/prove-production:\s*\n\s*if:\s*\$\{\{ github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.conclusion != 'skipped' \}\}/);
});
