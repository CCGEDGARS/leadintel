const test=require('node:test'),assert=require('node:assert/strict');
const {createClient,requestInput}=require('../buyer-research-jobs.js');
const D=require('../discovery-engine.js');
const roles=['Project/Engineering Director — specifications and technical approval','Operations Director','Purchasing Manager'];
const profile={priorityOffers:'Engineering services',idealCustomer:'Industrial operators',targetMarkets:'Denmark',decisionMakers:roles.join('; ')};
const fresh=()=>({company:'Equipment Buyer',domain:'buyer.example',buyerRoles:'',buyerDiscovery:{opportunityRoles:[]},people:[]});

test('an empty stored role list cannot shadow the profile when a fresh selection crosses the real server normalizer',async()=>{
 const {normalizeBuyerInput}=await import('../../backend/src/buyer-research-store.js');
 for(const empty of [[],['','  ']]){
  const owner={...fresh(),buyerDiscovery:{opportunityRoles:empty}},input=normalizeBuyerInput(requestInput(owner,profile));
  for(const role of roles)assert.ok(input.roles.includes(role),'the start request must retain '+role);
  assert.deepEqual(input.roles,D.buyerSelectionRoles(profile));
 }
});

test('a first click observes the real normalized job and does not silently fail while the server research exists',async()=>{
 const {normalizeBuyerInput}=await import('../../backend/src/buyer-research-store.js'),owner=fresh();let job=null,posts=0;
 const bridge={workspace:{id:'workspace'},session:{authenticated:true,user:{id:'owner'}}};
 const client=createClient({getBridge:()=>bridge,pollMs:1,fetchImpl:async(_url,init)=>{
  if(init.method==='POST'){posts++;const input=normalizeBuyerInput(JSON.parse(init.body));job={id:'new-job',domain:owner.domain,status:'complete',phase:'done',revision:1,candidate:input.candidate,input,progress:{}};}
  return {ok:true,json:async()=>({job})};
 }});
 const result=await client.research(owner,{profile});assert.ok(result,'a successful server start must not become a false start failure');assert.equal(result.id,'new-job');assert.equal(owner.buyerResearchJob.id,'new-job');assert.equal(posts,1);
});

test('manual company roles remain authoritative and arrays containing only whitespace fall back',async()=>{
 const {normalizeBuyerInput}=await import('../../backend/src/buyer-research-store.js');
 const owner={...fresh(),buyerRoles:'Medical Director',buyerRolesSource:'manual'};
 assert.deepEqual(normalizeBuyerInput(requestInput(owner,profile)).roles,D.buyerSelectionRoles({decisionMakers:'Medical Director'}));
 const blank={...fresh(),buyerRoles:['  ','']};assert.deepEqual(normalizeBuyerInput(requestInput(blank,profile)).roles,D.buyerSelectionRoles(profile));
});

test('a started job with a different committee reports its scope instead of silently returning null',async()=>{
 const owner=fresh(),bridge={workspace:{id:'workspace'},session:{authenticated:true,user:{id:'owner'}}};let job=null;
 const client=createClient({getBridge:()=>bridge,fetchImpl:async(_url,init)=>{if(init.method==='POST')job={id:'wrong-roles',domain:owner.domain,status:'queued',phase:'official',revision:1,candidate:{...owner,buyerRoles:'Executive leadership; Procurement Director'},input:{roles:['Executive leadership','Procurement Director']}};return {ok:true,json:async()=>({job})};}});
 await assert.rejects(client.research(owner,{profile}),error=>error.code==='BUYER_JOB_ROLES_MISMATCH'&&error.jobId==='wrong-roles');assert.equal(owner.buyerResearchJob,undefined);
});
test('restoring a different committee diagnoses it without changing roles or sending a new start',async()=>{
 const owner=fresh(),bridge={workspace:{id:'workspace'},session:{authenticated:true,user:{id:'owner'}}},calls=[];let mismatch;
 const client=createClient({getBridge:()=>bridge,fetchImpl:async(_url,init)=>{calls.push(init.method);return {ok:true,json:async()=>({job:{id:'old-job',domain:owner.domain,status:'running',phase:'dossier',revision:1,candidate:{...owner,buyerRoles:'Executive leadership; Procurement Director'},input:{roles:['Executive leadership','Procurement Director']}}})};}});
 assert.equal(await client.restore(owner,{profile,onMismatch:error=>mismatch=error}),null);assert.equal(mismatch.code,'BUYER_JOB_ROLES_MISMATCH');assert.deepEqual(calls,['GET']);assert.equal(owner.buyerRoles,'');assert.equal(owner.buyerResearchJob,undefined);
});
