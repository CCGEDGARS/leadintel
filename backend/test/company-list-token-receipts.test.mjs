import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import app from '../src/app.js';
import {profileMain,profileServices} from './company-list-profile-fixture.mjs';

// Live, 24 Nov 2026: a customer's list made 93 reasoning calls in three minutes and reached the monthly spending limit
// of the customer's provider account. Nothing stored said how many tokens a call or the list had used, so what a list
// costs could only be guessed. The provider's answer carries the counts; the list keeps them: on the receipt of the
// call, and summed per model for the whole list, because only the last 250 receipts are kept.
// These tests go through the workspace's own reasoning provider (a connected key and the provider's HTTP answer),
// not through the `generate` test service, which has no token counts.
async function setup(t,{answer=(prompt,fixture)=>fixture(prompt)}={}){
 const f=await buyerJobsFixture(t);f.payload.main={...f.payload.main,...profileMain()};f.version=1;
 await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:f.version++,payload:f.payload});
 try{f.DB.raw.exec(fs.readFileSync(new URL('../migrations/0010_workspace_ai_integrations.sql',import.meta.url),'utf8'));}catch{}
 f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 f.DB.raw.prepare('INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,?,?,?,?,1)').run(workspaceId,'openai',await encryptSecret('token-receipts-fixture-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY)),'fixture','gpt-6.1-sol');
 const services=profileServices({count:1}),served=[];
 f.env.COMPANY_LIST_TEST_SERVICES={search:services.search,read:services.read};
 // The provider's HTTP answer: the fixture's reasoning answer as text, with the token counts a provider reports.
 f.env.COPILOT_FETCH_IMPL=async(url,init={})=>{
  assert.match(String(url),/^https:\/\/api\.openai\.com\/v1\/responses$/);
  const prompt=JSON.parse(JSON.parse(init.body).input),call={stage:prompt.stage,...await answer(prompt,services.generate,served.length)};
  served.push(call);
  if(call.http)return new Response(JSON.stringify({error:{message:'upstream failed'}}),{status:call.http,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({output_text:call.text,usage:{input_tokens:call.input,output_tokens:call.output}}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 return {f,served};
}
const sizes={plan:[400,40],assess:[9000,700],review:[3000,150]};
const priced=async(prompt,fixture)=>({text:JSON.stringify(await fixture(prompt)),input:sizes[prompt.stage][0],output:sizes[prompt.stage][1]});
async function request(f,body,params={},waits=[]){return app.fetch(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{waitUntil:p=>waits.push(p)});}
const input={action:'start',name:'Counted list',count:1,budget:100,profileIds:['icp-core'],profileMode:'any',signalMode:'off',markets:['Sweden']};
async function start(f){const fingerprint=(await (await request(f,null,{options:'1'})).json()).options.contextFingerprint,waits=[],r=await request(f,{...input,contextFingerprint:fingerprint},{},waits);assert.equal(r.status,200,await r.clone().text());const body=await r.json();await Promise.all(waits);return body.list;}
async function tick(f,now=Date.now()){const waits=[],noop=async()=>{};await app.scheduled({cron:'* * * * *',scheduledTime:now},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);}
async function finish(f,id){for(let i=0;i<14;i++){const list=await readCompanyList(f.env,workspaceId,id);if(['complete','incomplete'].includes(list.status))return list;await tick(f,list.progress.nextAttemptAt?list.progress.nextAttemptAt+1:Date.now());}assert.fail('Company-list scheduler did not finish');}
const stateOf=(f,id)=>JSON.parse(f.DB.raw.prepare('SELECT state_json FROM company_lists WHERE id=?').get(id).state_json);
const sum=(rows,key)=>rows.reduce((n,row)=>n+(row[key]||0),0);

test('every reasoning call of a list keeps the tokens the provider reported, and the list keeps their sum per model',async t=>{
 const {f,served}=await setup(t,{answer:priced});
 const list=await finish(f,(await start(f)).id);
 assert.equal(list.status,'complete',list.progress.reason);assert.equal(list.results.length,1);
 assert.ok(served.some(c=>c.stage==='plan')&&served.some(c=>c.stage==='assess')&&served.some(c=>c.stage==='review'),'setup: the three kinds of call were made');
 const state=stateOf(f,list.id),asked=state.receipts.filter(r=>['analysis','evidence_review'].includes(r.operation));
 assert.equal(asked.length,served.length,'one receipt per call');
 for(const receipt of asked){
  assert.equal(receipt.provider,'openai');assert.equal(receipt.model,'gpt-6.1-sol');
  const [input,output]=receipt.operation==='evidence_review'?sizes.review:receipt.target==='search plan'?sizes.plan:sizes.assess;
  assert.equal(receipt.input,input,receipt.operation+' '+receipt.target);assert.equal(receipt.output,output);
 }
 assert.deepEqual(state.modelUse,{'openai:gpt-6.1-sol':{calls:served.length,input:sum(served,'input'),output:sum(served,'output')}});
 // A page read, a search or a register check is not a reasoning call and carries no token counts.
 for(const receipt of state.receipts.filter(r=>!asked.includes(r)))assert.equal(Object.hasOwn(receipt,'input')||Object.hasOwn(receipt,'output'),false,receipt.operation);
});

test('an answer that cannot be used was still paid for and is counted; a call the provider refused is not',async t=>{
 let refused=0,unusable=0;
 const {f,served}=await setup(t,{answer:async(prompt,fixture,index)=>{
  if(prompt.stage==='assess'&&!refused++)return {http:500};
  if(prompt.stage==='assess'&&!unusable++)return {text:'I could not decide.',input:9000,output:25};
  return priced(prompt,fixture);
 }});
 const list=await finish(f,(await start(f)).id),state=stateOf(f,list.id);
 const paid=served.filter(c=>!c.http);
 assert.ok(served.some(c=>c.http===500),'setup: one call was refused');assert.ok(paid.some(c=>c.text==='I could not decide.'),'setup: one answer was unusable');
 assert.deepEqual(state.modelUse,{'openai:gpt-6.1-sol':{calls:paid.length,input:sum(paid,'input'),output:sum(paid,'output')}});
 const failed=state.receipts.filter(r=>r.status==='failed'&&r.operation==='analysis');
 assert.equal(failed.filter(r=>r.input===9000&&r.output===25).length,1,'the unusable answer keeps its counts on its receipt');
 assert.equal(failed.filter(r=>!Object.hasOwn(r,'input')).length,1,'the refused call has none');
});

test('a list researched through the test reasoning service keeps no token counts',async t=>{
 const {f}=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=profileServices({count:1});
 const list=await finish(f,(await start(f)).id),state=stateOf(f,list.id);
 assert.equal(list.status,'complete');assert.equal(Object.hasOwn(state,'modelUse'),false);
});

test('a scheduler wake after restart cannot overspend a list and resume needs explicit new funds',async t=>{
 const {f,served}=await setup(t,{answer:priced});
 const {id}=await start(f);
 const state=stateOf(f,id);
 Object.assign(state,{phase:"planning",results:[],pending:[],queries:[],queryIndex:0,seen:[],round:0,roundStart:null,noProgressRounds:0});
 state.reasoningSpend={used:999999,limit:1000000};
 f.DB.raw.prepare("UPDATE company_lists SET status='queued',state_json=?,lease_until=0 WHERE id=?").run(JSON.stringify(state),id);
 const before=served.length;
 await tick(f);
 const paused=await readCompanyList(f.env,workspaceId,id);
 assert.equal(paused.failureCode,'research_spend',paused.progress.reason);
 assert.equal(paused.status,'incomplete');
 assert.equal(served.length,before);
 await tick(f);
 assert.equal(served.length,before);
 const response=await request(f,{action:'resume',id,revision:paused.revision});
 assert.equal(response.status,400);
 assert.equal(stateOf(f,id).reasoningSpend.limit,1000000);
 const waits=[];
 const accepted=await request(f,{action:'resume',id,revision:paused.revision,additionalReasoningUsd:1},{},waits);
 assert.equal(accepted.status,200,await accepted.clone().text());
 await Promise.all(waits);
 assert.equal(stateOf(f,id).reasoningSpend.limit,2000000);
 assert.ok(served.length>before);
});

test('parallel calls reserve once per attempt, retaining reservations after failure or restart',async()=>{
 const {reserveReasoning,researchPrompt}=await import('../src/company-list-spend.js');
 const state={reasoningSpend:{used:0,limit:50000}};
 const settle=reserveReasoning(state,'gpt-6.1-sol','x'.repeat(2000),3500);
 const persisted=structuredClone(state);
 assert.throws(()=>reserveReasoning(persisted,'gpt-6.1-sol','retry',3500),/budget/);
 assert.throws(()=>reserveReasoning(state,'gpt-6.1-sol','parallel',3500),/budget/);
 settle({input_tokens:500,output_tokens:50});
 assert.equal(state.reasoningSpend.used,1500);
 const page={url:'https://example.org',text:'Cited https://example.org/contact',links:['https://example.org/contact','https://example.org/jobs','https://example.org/jobs'],receipt:{providers:['internal']}};
 assert.deepEqual(researchPrompt({pages:[page]}).pages,[{url:page.url,text:page.text,links:['https://example.org/jobs']}]);
});

test('twenty unsuccessful source assessments pause the scheduler before another reasoning call',async t=>{
 const {f,served}=await setup(t,{answer:priced});
 const {id}=await start(f);
 const state=stateOf(f,id);
 Object.assign(state,{results:[],pending:[],queries:[],queryIndex:0,seen:[],round:0,roundStart:null,noProgressRounds:0,checked:20,yieldBaseline:{checked:0,matches:0}});
 f.DB.raw.prepare("UPDATE company_lists SET status='queued',state_json=?,lease_until=0 WHERE id=?").run(JSON.stringify(state),id);
 const before=served.length;
 await tick(f);
 const paused=await readCompanyList(f.env,workspaceId,id);
 assert.equal(paused.failureCode,'research_yield',paused.progress.reason);
 assert.equal(paused.status,'incomplete');
 assert.equal(served.length,before);
});
