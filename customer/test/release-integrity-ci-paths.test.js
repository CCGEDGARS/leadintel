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
