const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'../..');
const integritySkillPath=path.join(root,'.agents/skills/release-integrity/SKILL.md');
const verificationSkillPath=path.join(root,'.agents/skills/release-verification/SKILL.md');
const templatePath=path.join(root,'docs/release-integrity-template.md');
const provenancePath=path.join(root,'docs/superpowers/specs/2026-08-31-release-provenance.md');
const agentsPath=path.join(root,'AGENTS.md');

test('release integrity skill enforces exact proof and fixed status vocabulary',()=>{
  assert.equal(fs.existsSync(integritySkillPath),true,'release-integrity skill must exist');
  const skill=fs.readFileSync(integritySkillPath,'utf8');
  assert.match(skill,/release-proof\.json/);
  assert.match(skill,/exact.*SHA/i);
  assert.match(skill,/fail[- ]closed/i);
  assert.match(skill,/no silent fallback|never silently fall back/i);
  for(const label of ['LATEST CODE','VERIFIED PREVIEW','PROVEN PRODUCTION','LAST KNOWN WORKING'])assert.match(skill,new RegExp(label));
  assert.match(skill,/unresolved gate/i);
});

test('general release verification delegates current/proven claims to release integrity',()=>{
  const skill=fs.readFileSync(verificationSkillPath,'utf8');
  assert.match(skill,/release-integrity/i);
  assert.match(skill,/release-proof\.json/i);
});

test('repository-wide agent instructions make release integrity mandatory',()=>{
  assert.equal(fs.existsSync(agentsPath),true,'AGENTS.md must make the release rule persistent for repo agents');
  const agents=fs.readFileSync(agentsPath,'utf8');
  assert.match(agents,/release-integrity/i);
  assert.match(agents,/release-proof\.json/i);
  assert.match(agents,/PROVEN PRODUCTION/);
  assert.match(agents,/never.*older|no silent fallback/i);
});

test('reusable CCGROUP template documents the portable release integrity package',()=>{
  assert.equal(fs.existsSync(templatePath),true,'release integrity template must exist');
  const template=fs.readFileSync(templatePath,'utf8');
  for(const item of ['release-integrity.config.json','scripts/release-integrity-core.mjs','scripts/verify-release-integrity.mjs','.github/workflows/release-integrity.yml','.agents/skills/release-integrity/SKILL.md'])assert.match(template,new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(template,/future CCGROUP|CCGROUP applications/i);
});

test('provenance policy distinguishes old working production from latest production',()=>{
  const policy=fs.readFileSync(provenancePath,'utf8');
  assert.match(policy,/LAST KNOWN WORKING/);
  assert.match(policy,/PROVEN PRODUCTION/);
  assert.match(policy,/release-proof\.json/);
  assert.match(policy,/fail[- ]closed/i);
});
