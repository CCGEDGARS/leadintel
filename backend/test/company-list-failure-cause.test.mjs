import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import {generateText} from '../src/ai-provider.js';
import app from '../src/app.js';
import {profileMain,profileServices} from './company-list-profile-fixture.mjs';

// Live, 24 Nov 2026: a customer's list stopped with "A research service is temporarily unavailable" and the connection
// test said "connection check failed". The cause was the monthly spending limit of the customer's Anthropic account
// (HTTP 400, "You have reached your specified API usage limits…"), which nothing recognised, and neither the list nor
// its receipts kept which provider had refused or how. Nobody in the call could tell why it had stopped.
// A stopped list now keeps the provider and the kind of refusal beside its failure code, and the failed receipt keeps
// the provider, the HTTP status and the provider's code. These tests go through the workspace's own reasoning provider.
const BODY={
 anthropicSpendLimit:[400,{type:'error',error:{type:'invalid_request_error',message:'You have reached your specified API usage limits. You will regain access on 2026-12-01 at 00:00 UTC.'}}],
 anthropicWorkspaceLimit:[400,{type:'error',error:{type:'invalid_request_error',message:'You have reached your specified workspace API usage limits. You will regain access on 2026-12-01 at 00:00 UTC.'}}],
 anthropicNoCredit:[400,{type:'error',error:{type:'invalid_request_error',message:'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'}}],
 anthropicOverloaded:[529,{type:'error',error:{type:'overloaded_error',message:'Overloaded'}}],
 openaiNoQuota:[429,{error:{message:'You exceeded your current quota, please check your plan and billing details.',type:'insufficient_quota',code:'insufficient_quota'}}],
 openaiRateLimit:[429,{error:{message:'Rate limit reached for requests.',type:'requests',code:'rate_limit_exceeded'}}],
 openaiBadKey:[401,{error:{message:'Incorrect API key provided.',type:'invalid_request_error',code:'invalid_api_key'}}]
};
const MODEL={openai:'gpt-6.1-sol',anthropic:'claude-sonnet-5-5'};
async function setup(t,provider,answer){
 const f=await buyerJobsFixture(t);f.payload.main={...f.payload.main,...profileMain()};f.version=1;
 await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:f.version++,payload:f.payload});
 try{f.DB.raw.exec(fs.readFileSync(new URL('../migrations/0010_workspace_ai_integrations.sql',import.meta.url),'utf8'));}catch{}
 f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 f.DB.raw.prepare('INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,?,?,?,?,1)').run(workspaceId,provider,await encryptSecret('failure-cause-fixture-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY)),'fixture',MODEL[provider]);
 const services=profileServices({count:1});let calls=0;
 f.env.COMPANY_LIST_TEST_SERVICES={search:services.search,read:services.read};
 f.env.COPILOT_FETCH_IMPL=async(url,init={})=>{
  const request=JSON.parse(init.body),prompt=JSON.parse(provider==='openai'?request.input:request.messages[0].content);
  const [status,body]=answer(calls++,prompt)||[200,null];
  if(status!==200)return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  const text=JSON.stringify(await services.generate(prompt));
  return new Response(JSON.stringify(provider==='openai'?{output_text:text,usage:{input_tokens:100,output_tokens:10}}:{content:[{type:'text',text}],usage:{input_tokens:100,output_tokens:10}}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 return f;
}
async function request(f,body,params={},waits=[]){return app.fetch(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{waitUntil:p=>waits.push(p)});}
const input={action:'start',name:'Refused list',count:1,budget:100,profileIds:['icp-core'],profileMode:'any',signalMode:'off',markets:['Sweden']};
async function start(f,overrides={}){const fingerprint=(await (await request(f,null,{options:'1'})).json()).options.contextFingerprint,waits=[],r=await request(f,{...input,...overrides,contextFingerprint:fingerprint},{},waits);assert.equal(r.status,200,await r.clone().text());const body=await r.json();await Promise.all(waits);return body.list;}
async function tick(f,now=Date.now()){const waits=[],noop=async()=>{};await app.scheduled({cron:'* * * * *',scheduledTime:now},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);}
async function finish(f,id,seen=()=>{}){for(let i=0;i<14;i++){const list=await readCompanyList(f.env,workspaceId,id);seen(list);if(['complete','incomplete'].includes(list.status))return list;await tick(f,list.progress.nextAttemptAt?list.progress.nextAttemptAt+1:Date.now());}assert.fail('Company-list scheduler did not finish');}
const stateOf=(f,id)=>JSON.parse(f.DB.raw.prepare('SELECT state_json FROM company_lists WHERE id=?').get(id).state_json);
const always=answer=>()=>answer;

test('a list the provider refused keeps who refused and how',async t=>{
 for(const [name,provider,answer,code,cause] of [
  ['Anthropic account spending limit','anthropic',BODY.anthropicSpendLimit,'funds',{provider:'Anthropic',kind:'spending_limit',status:400}],
  ['Anthropic workspace spending limit','anthropic',BODY.anthropicWorkspaceLimit,'funds',{provider:'Anthropic',kind:'spending_limit',status:400}],
  ['Anthropic balance empty','anthropic',BODY.anthropicNoCredit,'funds',{provider:'Anthropic',kind:'credits',status:400}],
  ['OpenAI quota used up','openai',BODY.openaiNoQuota,'funds',{provider:'OpenAI',kind:'credits',status:429}],
  ['OpenAI key rejected','openai',BODY.openaiBadKey,'connection',{provider:'OpenAI',kind:'key',status:401}]]){
  await t.test(name,async t=>{
   const f=await setup(t,provider,always(answer)),list=await finish(f,(await start(f)).id);
   assert.equal(list.status,'incomplete');assert.equal(list.failureCode,code);
   assert.deepEqual({provider:list.failureCause?.provider,kind:list.failureCause?.kind,status:list.failureCause?.status},cause);
   const failed=stateOf(f,list.id).receipts.find(r=>r.status==='failed');
   assert.equal(failed.provider,provider);assert.equal(failed.http,cause.status);assert.ok(failed.providerCode,'the provider\'s own code is kept');
  });
 }
});

test('a provider that does not answer is named while the list retries and when it gives up',async t=>{
 const f=await setup(t,'anthropic',always(BODY.anthropicOverloaded)),during=[];
 const list=await finish(f,(await start(f)).id,seen=>{if(seen.status==='queued'&&seen.failureCause)during.push(seen.failureCause.kind+':'+seen.failureCause.status);});
 assert.ok(during.includes('unavailable:529'),'named while it retries: '+during.join(','));
 assert.equal(list.status,'incomplete');assert.equal(list.failureCode,'provider_temporary');
 assert.deepEqual({provider:list.failureCause.provider,kind:list.failureCause.kind,status:list.failureCause.status},{provider:'Anthropic',kind:'unavailable',status:529});
});

test('a rate limit is named as one',async t=>{
 const f=await setup(t,'openai',always(BODY.openaiRateLimit)),kinds=new Set();
 await finish(f,(await start(f)).id,seen=>{if(seen.failureCause)kinds.add(seen.failureCause.provider+':'+seen.failureCause.kind);});
 assert.deepEqual([...kinds],['OpenAI:rate_limit']);
});

test('a list that recovers does not keep showing the earlier refusal',async t=>{
 const f=await setup(t,'anthropic',call=>call===0?BODY.anthropicOverloaded:null),list=await finish(f,(await start(f)).id);
 assert.equal(list.status,'complete',list.progress.reason);assert.equal(list.failureCause,null);
});

test('Anthropic\'s wording for a reached spending limit is recognised as a billing stop, not as a bad request',async()=>{
 for(const [status,body] of [BODY.anthropicSpendLimit,BODY.anthropicWorkspaceLimit]){
  await assert.rejects(generateText({provider:'anthropic',apiKey:'k',model:'claude-sonnet-5-5',prompt:'p',maxOutputTokens:10,fetchImpl:async()=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})}),
   error=>{assert.match(error.message,/^Anthropic request failed \(400\) · code: billing_hard_limit_reached/);assert.doesNotMatch(error.message,/regain access|2026-12-01/,'the provider\'s own sentence is not passed on');return true;});
 }
});


test('a first OpenAI planning outage can discover from the selected industry and finish independent review',async t=>{
 for(const lanes of [1,4])await t.test('lanes '+lanes,async t=>{
  const f=await setup(t,'openai',(i,p)=>i===0&&p.stage==='plan'?[502,{}]:null);
  f.env.COMPANY_LIST_LANES=lanes;
  const services=f.env.COMPANY_LIST_TEST_SERVICES,queries=[];
  f.env.COMPANY_LIST_TEST_SERVICES={...services,search:async(q,o)=>{queries.push(q);return services.search(q,o);},registry:async()=>({status:'found',active:true,industry:{code:'2511'}})};
  const list=await finish(f,(await start(f,{target:{industries:['25'],registryOnly:false}})).id);
  assert.equal(list.status,'complete',list.progress.reason);assert.equal(list.results.length,1);
  assert.match(queries[0],/Fabricated metal products companies Sweden/);
  assert.equal(list.results[0].quality.status,'reviewed');
  assert.ok(list.receipts.some(r=>r.stage==='plan'&&r.status==='failed'&&r.http===502));
 });
});

test('an interrupted planning stream recovers using a single ordinary request on the next attempt',async t=>{
 const f=await setup(t,'openai',()=>null);f.env.COMPANY_LIST_LANES=4;
 const original=f.env.COPILOT_FETCH_IMPL,transports=[];
 f.env.COPILOT_FETCH_IMPL=async(url,init)=>{
  const body=JSON.parse(init.body);
  if(JSON.parse(body.input).stage==='plan'){
   transports.push(Boolean(body.stream));
   if(transports.length===1)return new Response('data: {"type":"response.failed","response":{"error":{"code":"server_error"}}}\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }
  return original(url,init);
 };
 const list=await finish(f,(await start(f)).id);
 assert.equal(list.status,'complete',list.progress.reason);assert.deepEqual(transports.slice(0,2),[true,false]);
 const failed=list.receipts.find(r=>r.status==='failed');
 assert.equal(failed.providerCode,'server_error');assert.equal(failed.http,undefined);
});

test('a streamed quota error stops after one attempt even with industry discovery available',async t=>{
 const f=await setup(t,'openai',()=>null);f.env.COMPANY_LIST_LANES=4;
 f.env.COPILOT_FETCH_IMPL=async()=>new Response('data: {"type":"error","code":"insufficient_quota","message":"private provider message"}\n\n',{headers:{'Content-Type':'text/event-stream'}});
 const list=await finish(f,(await start(f,{target:{industries:['25']}})).id);
 assert.equal(list.failureCode,'funds');assert.equal(list.progress.operations,1);assert.equal(list.failureCause.code,'insufficient_quota');assert.doesNotMatch(JSON.stringify(list),/private provider message/);
});
