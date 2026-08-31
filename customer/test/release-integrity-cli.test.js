const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.join(__dirname,'../..');
const cliPath=path.join(root,'scripts/verify-release-integrity.mjs');

async function loadCli(){
  assert.equal(fs.existsSync(cliPath),true,'release integrity CLI must exist');
  return import(`${pathToFileURL(cliPath).href}?test=${Date.now()}-${Math.random()}`);
}

const SHA='0123456789abcdef0123456789abcdef01234567';

test('CLI requires explicit expected SHA and CI conclusion',async()=>{
  const {parseArgs}=await loadCli();
  assert.throws(()=>parseArgs([]),/expected-sha/i);
  assert.throws(()=>parseArgs(['--expected-sha',SHA]),/ci-conclusion/i);
});

test('CLI defaults to production config and release-proof.json',async()=>{
  const {parseArgs}=await loadCli();
  const args=parseArgs(['--expected-sha',SHA,'--ci-conclusion','success','--ci-run-id','99']);
  assert.equal(args.expectedSha,SHA);
  assert.equal(args.ciConclusion,'success');
  assert.equal(args.ciRunId,'99');
  assert.equal(args.environment,'production');
  assert.equal(args.configPath,'release-integrity.config.json');
  assert.equal(args.proofPath,'release-proof.json');
});

test('only PROVEN verdict receives zero exit code',async()=>{
  const {exitCodeForVerdict}=await loadCli();
  assert.equal(exitCodeForVerdict('PROVEN'),0);
  for(const verdict of ['BLOCKED_CI','BLOCKED_STALE_DEPLOYMENT','BLOCKED_BACKEND_HEALTH','BLOCKED_SMOKE_CHECK','INCOMPLETE_VERIFICATION']){
    assert.notEqual(exitCodeForVerdict(verdict),0,verdict);
  }
});

test('proof writer persists structured JSON for blocked or proven verdicts',async()=>{
  const {writeProof}=await loadCli();
  const os=require('node:os');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'leadintel-release-proof-'));
  const target=path.join(temp,'proof.json');
  const proof={schemaVersion:1,application:'LeadIntel',verdict:'BLOCKED_CI',failures:['CI failed']};
  await writeProof(target,proof);
  const saved=JSON.parse(fs.readFileSync(target,'utf8'));
  assert.deepEqual(saved,proof);
  assert.equal(fs.readFileSync(target,'utf8').endsWith('\n'),true);
});

test('CLI source never serializes secret-bearing environment or auth fields into proof',async()=>{
  await loadCli();
  const source=fs.readFileSync(cliPath,'utf8');
  assert.doesNotMatch(source,/process\.env\s*[,}]/);
  assert.doesNotMatch(source,/authorization\s*:/i);
  assert.doesNotMatch(source,/cookie\s*:/i);
  assert.doesNotMatch(source,/api[_-]?key\s*:/i);
});
