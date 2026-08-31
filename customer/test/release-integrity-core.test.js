const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.join(__dirname,'../..');
const corePath=path.join(root,'scripts/release-integrity-core.mjs');

async function loadCore(){
  assert.equal(fs.existsSync(corePath),true,'release integrity core must exist');
  return import(`${pathToFileURL(corePath).href}?test=${Date.now()}-${Math.random()}`);
}

function response({status=200,json,text,headers={}}={}){
  return {
    ok:status>=200&&status<300,
    status,
    headers:{get:name=>headers[String(name).toLowerCase()]||null},
    async json(){if(json instanceof Error)throw json;return json;},
    async text(){return text??JSON.stringify(json??{});}
  };
}

function baseConfig(){
  return {
    schemaVersion:1,
    application:'LeadIntel',
    service:'leadintel-customer',
    productionUrl:'https://leadintel.ccgroup.lv',
    manifestPath:'/release.json',
    expectedRef:'main',
    backendHealth:{
      url:'https://leadintel-api.example/api/health',
      status:200,
      json:{status:'ok',service:'leadintel-api'}
    },
    smokeChecks:[
      {id:'customer-shell',type:'text',url:'/customer/',status:200,contains:['Commercial Intelligence'],notContains:['legacy-only-marker']}
    ],
    retry:{attempts:1,delayMs:0,timeoutMs:1000}
  };
}

const SHA='0123456789abcdef0123456789abcdef01234567';

async function provenFetch(url){
  const value=String(url);
  if(value.includes('/release.json'))return response({json:{service:'leadintel-customer',commit:SHA,ref:'main',provenance:'vercel-git'}});
  if(value.includes('/api/health'))return response({json:{status:'ok',service:'leadintel-api'}});
  if(value.includes('/customer/'))return response({text:'Commercial Intelligence'});
  return response({status:404,text:'missing'});
}

test('CI failure blocks verification before any network request',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  let calls=0;
  const proof=await verifyRelease({config:baseConfig(),expectedSha:SHA,ciConclusion:'failure',ciRunId:'123',environment:'production',fetchImpl:async()=>{calls++;return provenFetch('');}});
  assert.equal(calls,0);
  assert.equal(proof.verdict,VERDICTS.BLOCKED_CI);
  assert.equal(proof.ci.passed,false);
  assert.match(proof.failures.join(' '),/CI/i);
});

test('manifest SHA mismatch is classified as stale deployment',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  const fetchImpl=async url=>String(url).includes('/release.json')
    ? response({json:{service:'leadintel-customer',commit:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',ref:'main'}})
    : provenFetch(url);
  const proof=await verifyRelease({config:baseConfig(),expectedSha:SHA,ciConclusion:'success',ciRunId:'124',environment:'production',fetchImpl,nonce:'stale'});
  assert.equal(proof.verdict,VERDICTS.BLOCKED_STALE_DEPLOYMENT);
  assert.equal(proof.manifest.passed,false);
  assert.equal(proof.manifest.commit,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
});

test('missing live manifest cannot be proven',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  const fetchImpl=async url=>String(url).includes('/release.json')?response({status:404,text:'missing'}):provenFetch(url);
  const proof=await verifyRelease({config:baseConfig(),expectedSha:SHA,ciConclusion:'success',ciRunId:'125',environment:'production',fetchImpl,nonce:'missing'});
  assert.equal(proof.verdict,VERDICTS.INCOMPLETE_VERIFICATION);
  assert.equal(proof.manifest.passed,false);
});

test('backend health failure blocks integrated production proof',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  const fetchImpl=async url=>String(url).includes('/api/health')?response({status:503,json:{status:'error'}}):provenFetch(url);
  const proof=await verifyRelease({config:baseConfig(),expectedSha:SHA,ciConclusion:'success',ciRunId:'126',environment:'production',fetchImpl,nonce:'backend'});
  assert.equal(proof.verdict,VERDICTS.BLOCKED_BACKEND_HEALTH);
  assert.equal(proof.backend.passed,false);
});

test('failed mandatory smoke check blocks proof',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  const fetchImpl=async url=>String(url).includes('/customer/')?response({text:'wrong shell'}):provenFetch(url);
  const proof=await verifyRelease({config:baseConfig(),expectedSha:SHA,ciConclusion:'success',ciRunId:'127',environment:'production',fetchImpl,nonce:'smoke'});
  assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);
  assert.equal(proof.smokeChecks[0].passed,false);
});

test('all mandatory gates produce PROVEN with exact evidence',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  const proof=await verifyRelease({config:baseConfig(),expectedSha:SHA,ciConclusion:'success',ciRunId:'128',environment:'production',fetchImpl:provenFetch,now:()=>new Date('2026-08-31T18:30:00.000Z'),nonce:'proof'});
  assert.equal(proof.verdict,VERDICTS.PROVEN);
  assert.equal(proof.expected.sha,SHA);
  assert.equal(proof.manifest.commit,SHA);
  assert.equal(proof.ci.passed,true);
  assert.equal(proof.backend.passed,true);
  assert.equal(proof.smokeChecks.every(check=>check.passed),true);
  assert.equal(proof.verifiedAt,'2026-08-31T18:30:00.000Z');
});

test('a skipped mandatory gate can never return PROVEN',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  const config=baseConfig();
  delete config.backendHealth;
  const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'129',environment:'production',fetchImpl:provenFetch,nonce:'skip'});
  assert.notEqual(proof.verdict,VERDICTS.PROVEN);
  assert.match(proof.failures.join(' '),/backend/i);
});

test('manifest fetch URL is cache-busted and deterministic when nonce is supplied',async()=>{
  const {cacheBustedUrl}=await loadCore();
  const url=cacheBustedUrl('https://leadintel.ccgroup.lv/release.json','abc123');
  assert.equal(url,'https://leadintel.ccgroup.lv/release.json?verify=abc123');
});

test('configuration and expected SHA are validated fail-closed',async()=>{
  const {validateConfig}=await loadCore();
  assert.throws(()=>validateConfig({...baseConfig(),productionUrl:''}),/productionUrl/i);
  assert.throws(()=>validateConfig({...baseConfig(),smokeChecks:[]}),/smoke/i);
});
