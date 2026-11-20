import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import app from '../src/app.js';
import {profileMain,profileServices} from './company-list-profile-fixture.mjs';

// Same authenticated HTTP start and registered scheduler as the other list journeys.
// Found in the live run of 20 Nov 2026 (list 35810222): the planner pasted the size rule
// into every query and searched a company directory, and one page whose reasoning answer
// was refused stopped the whole list under a "service temporarily unavailable" message.
async function setup(t){const f=await buyerJobsFixture(t);f.payload.main={...f.payload.main,...profileMain()};f.version=1;await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:f.version++,payload:f.payload});return f;}
async function request(f,body,params={},waits=[]){return app.fetch(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{waitUntil:p=>waits.push(p)});}
const input={action:'start',name:'Sized list',count:2,budget:100,profileIds:['icp-core'],profileMode:'any',signalMode:'off',markets:['Sweden']};
async function start(f,change={}){const fingerprint=(await (await request(f,null,{options:'1'})).json()).options.contextFingerprint,waits=[],r=await request(f,{...input,contextFingerprint:fingerprint,...change},{},waits);assert.equal(r.status,200,await r.clone().text());const body=await r.json();await Promise.all(waits);return body.list;}
async function tick(f,now=Date.now()){const waits=[],noop=async()=>{};await app.scheduled({cron:'* * * * *',scheduledTime:now},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);}
// Follows the list through its scheduled retries; `seen` receives every intermediate state.
async function finish(f,id,seen=()=>{}){for(let i=0;i<14;i++){const list=await readCompanyList(f.env,workspaceId,id);seen(list);if(['complete','incomplete'].includes(list.status))return list;await tick(f,list.progress.nextAttemptAt?list.progress.nextAttemptAt+1:Date.now());}assert.fail('Company-list scheduler did not finish');}
const stateOf=(f,id)=>JSON.parse(f.DB.raw.prepare('SELECT state_json FROM company_lists WHERE id=?').get(id).state_json);
const target={employees:{min:25,max:250},industries:['25','28'],registryOnly:true};

test('the search planner never receives the size rule; it gets the industry names and is told to look for company websites',async t=>{
 const f=await setup(t),prompts=[];
 f.env.COMPANY_LIST_TEST_SERVICES={...profileServices({count:1,observe:p=>prompts.push(structuredClone(p))}),registry:async()=>({status:'unavailable'})};
 await finish(f,(await start(f,{count:1,target})).id);
 const plan=prompts.find(p=>p.stage==='plan'),assess=prompts.find(p=>p.stage==='assess');
 assert.equal(Object.hasOwn(plan.criteria,'target'),false,'the planner prompt carries no structured criteria');
 assert.doesNotMatch(JSON.stringify(plan),/"employees"|"registryOnly"|\b250\b|verified against the business register/);
 assert.match(plan.instructions,/Fabricated metal products/);assert.match(plan.instructions,/Machinery and equipment/);
 assert.match(plan.instructions,/companies' own websites/);assert.match(plan.instructions,/never put employee counts/i);
 assert.match(plan.instructions,/small and mid-sized/,'an employee maximum becomes a size word, not a number');
 assert.equal(Object.hasOwn(assess.criteria,'target'),false);
});

// Second live run (20 Nov 2026, list daa2fd4b): the assessment saw "25–250 employees ·
// register only", asked every company website to prove it and kept none, so the register
// check, which answers exactly that, never ran.
test('no reasoning prompt carries the size, industry or register rules; the register alone decides them',async t=>{
 const f=await setup(t),prompts=[],asked=[];
 f.env.COMPANY_LIST_TEST_SERVICES={...profileServices({count:2,observe:p=>prompts.push(structuredClone(p))}),registry:async query=>{
  asked.push(query.company);
  const base={status:'found',registry:'SE-TEST',country:'SE',name:query.company.toUpperCase()+' AB',city:'Stockholm',active:true,statusLabel:'ACTIVE',industry:{code:'289900',label:'Manufacture of special-purpose machinery'},revenue:null,marketingProtected:false,source:{name:'Test register',url:'https://register.example/'+query.company,checkedAt:'2026-11-20T12:00:00.000Z'}};
  return query.company==='Factory0'?{...base,id:'5500000000',employees:{count:120}}:{...base,id:'5500000001',employees:{count:833}};
 }};
 const first=await start(f,{count:1,target:{employees:{min:25,max:250},industries:['28'],registryOnly:true}}),list=await finish(f,first.id);
 assert.deepEqual([...new Set(prompts.map(p=>p.stage))].sort(),['assess','plan','review']);
 for(const p of prompts){
  assert.equal(Object.hasOwn(p.criteria,'target'),false,p.stage+' prompt carries no structured criteria');
  assert.doesNotMatch(JSON.stringify(p),/"employees"|"registryOnly"|"register"|"checks"/,p.stage+' prompt carries no register facts');
 }
 const review=prompts.find(p=>p.stage==='review');
 assert.equal(review.candidate.company,'Factory0');assert.equal(Object.hasOwn(review.candidate,'target'),false,'the reviewer does not see the register outcome');
 assert.match(prompts.find(p=>p.stage==='assess').instructions,/industry:\{division,url,quote\}/,'the industry statement is still asked for');
 assert.equal(list.status,'complete');assert.deepEqual(list.results.map(r=>r.company),['Factory0']);
 assert.deepEqual(list.results[0].target.checks.map(c=>[c.key,c.status]),[['registry','match'],['industry','match'],['employees','match']],'the kept company still carries its register checks');
 assert.equal(list.results[0].target.register.id,'5500000000');
 assert.ok(asked.includes('Factory0'));
});

test('a list without structured criteria plans exactly as before',async t=>{
 const f=await setup(t),prompts=[];
 f.env.COMPANY_LIST_TEST_SERVICES=profileServices({count:1,observe:p=>prompts.push(structuredClone(p))});
 await finish(f,(await start(f,{count:1})).id);
 const plan=prompts.find(p=>p.stage==='plan');
 assert.doesNotMatch(plan.instructions,/size and industry rules|own websites/);
 assert.equal(Object.hasOwn(plan.criteria,'target'),false);
});

test('a page whose reasoning answer is unusable is skipped after two attempts and the list goes on',async t=>{
 const f=await setup(t),base=profileServices({count:3}),attempts=[],states=[];
 f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>{
  if(p.stage==='assess'&&p.pages.at(-1).url.includes('factory1.')){attempts.push(p.pages.at(-1).url);return [{company:'A'},{company:'B'}];}
  return base.generate(p);
 }};
 const first=await start(f),list=await finish(f,first.id,l=>states.push(l));
 const retrying=states.find(l=>l.progress.phase==='retrying');
 assert.ok(retrying,'the first refused answer is retried once');
 assert.equal(retrying.failureCode,'invalid_response');
 assert.match(retrying.progress.reason,/answer that could not be used/);
 assert.doesNotMatch(retrying.progress.reason,/temporarily unavailable|connections/i);

 assert.equal(list.status,'complete',list.progress.reason);
 assert.deepEqual(list.results.map(r=>r.company).sort(),['Factory0','Factory2']);
 assert.equal(attempts.length,2,'the same page is not asked a third time');
 assert.equal(list.failureCode,'');
 const state=stateOf(f,first.id),skipped=state.reviews.filter(r=>r.url==='https://factory1.example/');
 assert.equal(skipped.length,1);assert.equal(skipped[0].status,'needs_evidence');
 assert.match(skipped[0].reason,/could not be assessed/);
 const refused=state.receipts.filter(r=>r.status==='failed');
 assert.deepEqual(refused.map(r=>[r.operation,r.failure,r.detail]),[['analysis','invalid_response','top_level_list'],['analysis','invalid_response','top_level_list']]);
});

test('a search plan that stays unusable stops after three attempts and says what happened',async t=>{
 const f=await setup(t),base=profileServices({count:1});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>p.stage==='plan'?{queries:'not a list'}:base.generate(p)};
 const first=await start(f,{count:1}),list=await finish(f,first.id);
 assert.equal(list.status,'incomplete');assert.equal(list.failureCode,'invalid_response');
 assert.equal(list.progress.operationTotals.failed,3);
 assert.match(list.progress.reason,/answer that could not be used/);assert.match(list.progress.reason,/three attempts/);
 assert.doesNotMatch(list.progress.reason,/temporarily unavailable|Check connections/);
 assert.deepEqual(stateOf(f,first.id).receipts.map(r=>[r.failure,r.detail]),[['invalid_response','field_not_list:queries'],['invalid_response','field_not_list:queries'],['invalid_response','field_not_list:queries']]);
});

test('a provider outage keeps its own wording and its three attempts',async t=>{
 const f=await setup(t),base=profileServices({count:1});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>{if(p.stage==='assess')throw Object.assign(Error('Reasoning request failed (503)'),{status:503});return base.generate(p);}};
 const first=await start(f,{count:1}),list=await finish(f,first.id);
 assert.equal(list.status,'incomplete');assert.equal(list.failureCode,'provider_temporary');
 assert.match(list.progress.reason,/temporarily unavailable/);assert.match(list.progress.reason,/Check connections and resume/);
 assert.equal(list.progress.operationTotals.failed,3);
 assert.equal(stateOf(f,first.id).reviews.length,0,'an outage is not recorded as an unassessable source');
});
