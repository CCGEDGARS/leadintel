export const VERDICTS=Object.freeze({
  PROVEN:'PROVEN',
  BLOCKED_CI:'BLOCKED_CI',
  BLOCKED_STALE_DEPLOYMENT:'BLOCKED_STALE_DEPLOYMENT',
  BLOCKED_BACKEND_HEALTH:'BLOCKED_BACKEND_HEALTH',
  BLOCKED_SMOKE_CHECK:'BLOCKED_SMOKE_CHECK',
  INCOMPLETE_VERIFICATION:'INCOMPLETE_VERIFICATION'
});

const SHA_RE=/^[0-9a-f]{40}$/i;
const DEFAULT_REQUEST_TIMEOUT_MS=15000;

function required(value,name){
  if(value===undefined||value===null||value==='')throw new Error(`Missing required ${name}`);
  return value;
}

function validAbsoluteUrl(value,name){
  required(value,name);
  let url;
  try{url=new URL(value);}catch{throw new Error(`Invalid ${name}`);}
  if(!['http:','https:'].includes(url.protocol))throw new Error(`Invalid ${name}`);
  return url.href;
}

export function validateConfig(config){
  if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('Invalid release integrity config');
  if(Number(config.schemaVersion)!==1)throw new Error('Unsupported schemaVersion');
  required(config.application,'application');
  required(config.service,'service');
  validAbsoluteUrl(config.productionUrl,'productionUrl');
  required(config.manifestPath,'manifestPath');
  required(config.expectedRef,'expectedRef');
  if(!config.backendHealth||typeof config.backendHealth!=='object')throw new Error('Missing required backendHealth');
  validAbsoluteUrl(config.backendHealth.url,'backendHealth.url');
  if(!Number.isInteger(Number(config.backendHealth.status)))throw new Error('Invalid backendHealth.status');
  if(!config.backendHealth.json||typeof config.backendHealth.json!=='object')throw new Error('Invalid backendHealth.json');
  if(!Array.isArray(config.smokeChecks)||config.smokeChecks.length===0)throw new Error('At least one smoke check is required');
  for(const check of config.smokeChecks){
    required(check?.id,'smoke check id');
    if(check.type!=='text')throw new Error(`Unsupported smoke check type for ${check.id}`);
    required(check.url,`smoke check url for ${check.id}`);
    if(!Number.isInteger(Number(check.status)))throw new Error(`Invalid smoke check status for ${check.id}`);
  }
  if(config.retry?.timeoutMs!==undefined&&(!Number.isFinite(Number(config.retry.timeoutMs))||Number(config.retry.timeoutMs)<=0))throw new Error('Invalid retry.timeoutMs');
  return config;
}

export function cacheBustedUrl(value,nonce=crypto.randomUUID()){
  const url=new URL(value);
  url.searchParams.set('verify',String(nonce));
  return url.href;
}

export function matchesExpectedJson(actual,expected){
  if(expected===null||typeof expected!=='object')return Object.is(actual,expected);
  if(Array.isArray(expected)){
    if(!Array.isArray(actual)||actual.length<expected.length)return false;
    return expected.every((value,index)=>matchesExpectedJson(actual[index],value));
  }
  if(!actual||typeof actual!=='object'||Array.isArray(actual))return false;
  return Object.entries(expected).every(([key,value])=>Object.prototype.hasOwnProperty.call(actual,key)&&matchesExpectedJson(actual[key],value));
}

function joinUrl(base,path){return new URL(path,base).href;}
function sleep(ms){return ms>0?new Promise(resolve=>setTimeout(resolve,ms)):Promise.resolve();}
function requestTimeout(config){return Math.max(1,Number(config?.retry?.timeoutMs)||DEFAULT_REQUEST_TIMEOUT_MS);}

export async function fetchWithTimeout(fetchImpl,url,options={},timeoutMs=DEFAULT_REQUEST_TIMEOUT_MS){
  if(typeof fetchImpl!=='function')throw new Error('No fetch implementation available');
  const ms=Math.max(1,Number(timeoutMs)||DEFAULT_REQUEST_TIMEOUT_MS);
  const controller=new AbortController();
  let timer;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      controller.abort();
      reject(new Error(`Request timeout after ${ms}ms`));
    },ms);
  });
  try{
    return await Promise.race([
      Promise.resolve().then(()=>fetchImpl(url,{...options,signal:controller.signal})),
      timeout
    ]);
  }finally{
    if(timer)clearTimeout(timer);
  }
}

async function fetchJson(fetchImpl,url,timeoutMs){
  const response=await fetchWithTimeout(fetchImpl,url,{headers:{'cache-control':'no-store','pragma':'no-cache'}},timeoutMs);
  if(!response||typeof response.status!=='number')throw new Error('Invalid fetch response');
  if(!response.ok)return {response,data:null,error:`HTTP ${response.status}`};
  try{return {response,data:await response.json(),error:null};}
  catch(error){return {response,data:null,error:`Invalid JSON: ${error.message||error}`};}
}

async function fetchText(fetchImpl,url,timeoutMs){
  const response=await fetchWithTimeout(fetchImpl,url,{headers:{'cache-control':'no-store','pragma':'no-cache'}},timeoutMs);
  if(!response||typeof response.status!=='number')throw new Error('Invalid fetch response');
  const body=await response.text();
  return {response,body};
}

function makeBaseProof({config,expectedSha,ciConclusion,ciRunId,environment,now}){
  return {
    schemaVersion:1,
    application:config?.application||'',
    environment:environment||'production',
    verifiedAt:now().toISOString(),
    expected:{sha:String(expectedSha||''),ref:config?.expectedRef||''},
    ci:{runId:String(ciRunId||''),conclusion:String(ciConclusion||''),passed:false},
    manifest:{url:'',status:null,commit:'',ref:'',service:'',passed:false},
    backend:{url:config?.backendHealth?.url||'',status:null,passed:false},
    smokeChecks:[],
    deployment:{required:false,passed:null},
    verdict:VERDICTS.INCOMPLETE_VERIFICATION,
    failures:[]
  };
}

function setFailure(proof,verdict,message){
  proof.verdict=verdict;
  proof.failures.push(message);
  return proof;
}

async function verifyManifest({config,expectedSha,fetchImpl,nonce,proof}){
  const manifestBase=joinUrl(config.productionUrl,config.manifestPath);
  const retry=config.retry||{};
  const attempts=Math.max(1,Number(retry.attempts)||1);
  const delayMs=Math.max(0,Number(retry.delayMs)||0);
  const timeoutMs=requestTimeout(config);
  let last={kind:'incomplete',message:'Manifest verification did not run'};
  for(let attempt=1;attempt<=attempts;attempt++){
    const url=cacheBustedUrl(manifestBase,attempt===1?nonce:`${nonce}-${attempt}`);
    proof.manifest.url=url;
    try{
      const {response,data,error}=await fetchJson(fetchImpl,url,timeoutMs);
      proof.manifest.status=response.status;
      if(error||!data){
        last={kind:'incomplete',message:`Live release manifest unavailable: ${error||'empty response'}`};
      }else{
        proof.manifest.commit=String(data.commit||'');
        proof.manifest.ref=String(data.ref||'');
        proof.manifest.service=String(data.service||'');
        if(proof.manifest.commit!==expectedSha){
          last={kind:'stale',message:`Live manifest SHA ${proof.manifest.commit||'(missing)'} does not match expected ${expectedSha}`};
        }else if(proof.manifest.ref!==config.expectedRef){
          last={kind:'stale',message:`Live manifest ref ${proof.manifest.ref||'(missing)'} does not match expected ${config.expectedRef}`};
        }else if(proof.manifest.service!==config.service){
          last={kind:'stale',message:`Live manifest service ${proof.manifest.service||'(missing)'} does not match expected ${config.service}`};
        }else{
          proof.manifest.passed=true;
          return null;
        }
      }
    }catch(error){last={kind:'incomplete',message:`Live release manifest verification failed: ${error.message||error}`};}
    if(attempt<attempts)await sleep(delayMs);
  }
  return last;
}

async function verifyBackend({config,fetchImpl,proof}){
  try{
    const {response,data,error}=await fetchJson(fetchImpl,config.backendHealth.url,requestTimeout(config));
    proof.backend.status=response.status;
    if(error)return `Backend health failed: ${error}`;
    if(response.status!==Number(config.backendHealth.status))return `Backend health status ${response.status} does not match expected ${config.backendHealth.status}`;
    if(!matchesExpectedJson(data,config.backendHealth.json))return 'Backend health payload does not match expected service identity';
    proof.backend.passed=true;
    return null;
  }catch(error){return `Backend health verification failed: ${error.message||error}`;}
}

async function verifySmokeChecks({config,fetchImpl,proof}){
  const failures=[];
  const timeoutMs=requestTimeout(config);
  for(const check of config.smokeChecks){
    const result={id:check.id,url:joinUrl(config.productionUrl,check.url),status:null,passed:false,failures:[]};
    try{
      const {response,body}=await fetchText(fetchImpl,result.url,timeoutMs);
      result.status=response.status;
      if(response.status!==Number(check.status))result.failures.push(`status ${response.status} != ${check.status}`);
      for(const token of check.contains||[])if(!body.includes(token))result.failures.push(`missing required text: ${token}`);
      for(const token of check.notContains||[])if(body.includes(token))result.failures.push(`forbidden text present: ${token}`);
      result.passed=result.failures.length===0;
    }catch(error){result.failures.push(error.message||String(error));}
    if(!result.passed)failures.push(`${check.id}: ${result.failures.join('; ')}`);
    proof.smokeChecks.push(result);
  }
  return failures;
}

export async function verifyRelease({
  config,
  expectedSha,
  ciConclusion,
  ciRunId='',
  environment='production',
  fetchImpl=globalThis.fetch,
  now=()=>new Date(),
  nonce=crypto.randomUUID()
}={}){
  let validatedConfig=config;
  try{validatedConfig=validateConfig(config);}catch(error){
    const proof=makeBaseProof({config,expectedSha,ciConclusion,ciRunId,environment,now});
    return setFailure(proof,VERDICTS.INCOMPLETE_VERIFICATION,error.message||String(error));
  }
  const proof=makeBaseProof({config:validatedConfig,expectedSha,ciConclusion,ciRunId,environment,now});
  if(!SHA_RE.test(String(expectedSha||'')))return setFailure(proof,VERDICTS.INCOMPLETE_VERIFICATION,'Expected Git SHA must be an explicit 40-character hexadecimal commit SHA');
  if(String(ciConclusion||'').toLowerCase()!=='success')return setFailure(proof,VERDICTS.BLOCKED_CI,`Required CI did not succeed for ${expectedSha}: ${ciConclusion||'missing conclusion'}`);
  proof.ci.passed=true;
  if(typeof fetchImpl!=='function')return setFailure(proof,VERDICTS.INCOMPLETE_VERIFICATION,'No fetch implementation available');

  const manifestFailure=await verifyManifest({config:validatedConfig,expectedSha,fetchImpl,nonce,proof});
  if(manifestFailure){
    return setFailure(proof,manifestFailure.kind==='stale'?VERDICTS.BLOCKED_STALE_DEPLOYMENT:VERDICTS.INCOMPLETE_VERIFICATION,manifestFailure.message);
  }

  const backendFailure=await verifyBackend({config:validatedConfig,fetchImpl,proof});
  if(backendFailure)return setFailure(proof,VERDICTS.BLOCKED_BACKEND_HEALTH,backendFailure);

  const smokeFailures=await verifySmokeChecks({config:validatedConfig,fetchImpl,proof});
  if(smokeFailures.length){
    proof.failures.push(...smokeFailures);
    proof.verdict=VERDICTS.BLOCKED_SMOKE_CHECK;
    return proof;
  }

  if(!proof.ci.passed||!proof.manifest.passed||!proof.backend.passed||proof.smokeChecks.length!==validatedConfig.smokeChecks.length||!proof.smokeChecks.every(check=>check.passed)){
    return setFailure(proof,VERDICTS.INCOMPLETE_VERIFICATION,'One or more mandatory release gates were skipped or incomplete');
  }

  proof.verdict=VERDICTS.PROVEN;
  return proof;
}
