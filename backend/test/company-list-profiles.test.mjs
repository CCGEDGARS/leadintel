import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {handleCompanyListsRoute,runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import app from '../src/app.js';
import {profileMain,profileServices} from './company-list-profile-fixture.mjs';
const M=globalThis.LeadIntelCompanyLists;
async function setup(t){const f=await buyerJobsFixture(t);f.payload.main={...f.payload.main,...profileMain()};f.version=1;await save(f);return f;}
async function save(f){await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:f.version++,payload:f.payload});}
async function request(f,body,params={},waits=[]){return handleCompanyListsRoute(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{}, {waitUntil:p=>waits.push(p)});}
async function options(f){return (await (await request(f,null,{options:'1'})).json()).options;}
const input={action:'start',name:'Selected profiles',count:5,budget:100,profileIds:['icp-core'],profileMode:'any',signalMode:'off',referenceIds:['current:r1'],markets:['Sweden']};
async function tick(f){const waits=[],noop=async()=>{};let registered=false;await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs:(env,o)=>{registered=true;return runCompanyListJobs(env,o);},runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);assert.equal(registered,true,'registered scheduler must admit the company-list worker');}
async function finish(f,id){for(let i=0;i<10;i++){await tick(f);const list=await readCompanyList(f.env,workspaceId,id);if(['complete','incomplete'].includes(list.status))return list;}assert.fail('Company-list scheduler did not finish');}
async function start(f,change={}){const waits=[],r=await request(f,{...input,contextFingerprint:(await options(f)).contextFingerprint,...change},{},waits);assert.equal(r.status,200,await r.clone().text());const list=(await r.json()).list;await Promise.all(waits);return list;}

test('each of the four selected profiles crosses authenticated HTTP, SQLite checkpoints and the registered scheduler',async t=>{
 for(const profile of profileMain().market.icps)await t.test(profile.name,async t=>{
  const f=await setup(t),prompts=[];f.env.COMPANY_LIST_TEST_SERVICES=profileServices({observe:p=>prompts.push(p)});
  const first=await start(f,{profileIds:[profile.id],signalMode:profile.type==='trigger-led'?'require':'off',signalIds:['hiring']});
  assert.notEqual((await readCompanyList(f.env,workspaceId,first.id)).status,'complete','the browser wake alone must not finish this fixture');
  const list=await finish(f,first.id);assert.equal(list.status,'complete');assert.equal(list.results.length,5);
  assert.ok(prompts.every(p=>p.criteria.profiles.length===1&&p.criteria.profiles[0].id===profile.id));
  assert.ok(list.results.every(r=>r.quality.version===M.PROFILE_VERSION&&r.audit.review.status==='complete'&&r.profileMatches[0].profileId===profile.id));
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_companies').get().n,0);
 });
});
test('profile any/all and buying-signal Off, Prioritize and Require change actual saved results and scores',async t=>{
 const cases=[
  {signalMode:'off',profileMode:'any',names:['Factory0','Factory1','Factory2'],scores:[90,90,90]},
  {signalMode:'boost',profileMode:'any',names:['Factory0','Factory1','Factory2'],scores:[98,94,90]},
  {signalMode:'require',profileMode:'any',mode:'any',names:['Factory0','Factory1'],scores:[98,94]},
  {signalMode:'require',profileMode:'any',mode:'all',names:['Factory0'],scores:[98]},
  {signalMode:'off',profileMode:'all',names:['Factory0'],scores:[90]}
 ];
 for(const c of cases)await t.test(JSON.stringify(c),async t=>{
  const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=profileServices({count:3,coverage:name=>({profiles:name==='Factory0'?true:[name==='Factory1'?'icp-core':'icp-reference-lookalike'],signals:name==='Factory0'?true:name==='Factory1'?['hiring']:[]})});
  const list=await finish(f,(await start(f,{profileIds:['icp-core','icp-reference-lookalike'],count:3,signalIds:['hiring','expansion'],...c})).id);
  assert.deepEqual(list.results.map(r=>r.company),c.names);assert.deepEqual(list.results.map(r=>r.score),c.scores);
  assert.equal(list.status,c.names.length===3?'complete':'incomplete');if(list.status==='incomplete')assert.equal(list.failureCode,'search_exhausted');
 });
});
test('stale previews fail before spend; Strategy edits affect new runs while in-progress lists and saved CRM evidence remain frozen',async t=>{
 const f=await setup(t),before=await options(f);f.env.COMPANY_LIST_TEST_SERVICES=profileServices();
 assert.equal((await request(f,{...input,signalIds:['lookalike'],profileIds:undefined})).status,409,'old clients must reload explicit profiles');
 const first=await start(f,{profileIds:['icp-reference-lookalike']});
 f.payload.main.market.icps[1].active=false;f.payload.main.market.icps[0].description='Medical equipment manufacturers';
 f.payload.main.market.deletedSignalIds.push('hiring');f.payload.main.market.signals.push({id:'modernization',name:'Modernization',keywords:'medical automation',active:true});await save(f);
 const stale=await request(f,{...input,contextFingerprint:before.contextFingerprint});assert.equal(stale.status,409);assert.match(await stale.text(),/changed|review/i);
 let old=await finish(f,first.id);assert.equal(old.status,'complete');assert.equal(old.criteria.profiles[0].description,'Substantive reference similarity');
 const current=await options(f);assert.equal(current.profiles.find(p=>p.type==='lookalike').active,false);assert.deepEqual(current.buyingSignals.map(s=>s.id),['expansion','modernization']);
 assert.equal((await request(f,{...input,contextFingerprint:current.contextFingerprint,profileIds:['icp-reference-lookalike']})).status,400);
 assert.equal((await request(f,{...input,contextFingerprint:current.contextFingerprint,signalMode:'require',signalIds:['hiring']})).status,400);
 old=(await (await request(f,{action:'save',id:old.id,revision:old.revision})).json()).list;assert.equal(old.saved,true);
 const stored=f.DB.raw.prepare('SELECT research_snapshot_json FROM crm_intelligence LIMIT 1').get();assert.match(stored.research_snapshot_json,/Substantive reference similarity|Lookalike/);
 const csv=M.csv((await (await request(f,null,{id:old.id})).json()).list);assert.match(csv,/Lookalike/);assert.doesNotMatch(csv,/Medical equipment/);
 const next=await finish(f,(await start(f,{count:1,signalMode:'boost',signalIds:['modernization']})).id);assert.equal(next.criteria.profiles[0].description,'Medical equipment manufacturers');assert.deepEqual(next.criteria.signals.map(s=>s.id),['modernization']);
 f.payload.main.market.icps.forEach(p=>p.active=false);await save(f);const off=await options(f);assert.equal(off.profiles.filter(p=>p.active).length,0);assert.equal((await request(f,{...input,contextFingerprint:off.contextFingerprint})).status,400);
});
test('editing a definition without changing its id invalidates a reviewed preview',async t=>{
 const f=await setup(t),before=await options(f);f.payload.main.market.signals[0].keywords='technical maintenance recruitment';await save(f);
 const r=await request(f,{...input,contextFingerprint:before.contextFingerprint,signalMode:'require',signalIds:['hiring']});assert.equal(r.status,409);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM company_lists').get().n,0);
});
