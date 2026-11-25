import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import app from '../src/app.js';
import {profileMain,profileServices} from './company-list-profile-fixture.mjs';

// Same authenticated HTTP start and registered scheduler as the profile journeys;
// only the business register is a controlled service.
async function setup(t){const f=await buyerJobsFixture(t);f.payload.main={...f.payload.main,...profileMain()};f.version=1;await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:f.version++,payload:f.payload});return f;}
async function request(f,body,params={},waits=[]){return app.fetch(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{waitUntil:p=>waits.push(p)});}
const input={action:'start',name:'Sized list',count:3,budget:100,profileIds:['icp-core'],profileMode:'any',signalMode:'off',markets:['Sweden']};
async function start(f,change={},expected=200){const fingerprint=(await (await request(f,null,{options:'1'})).json()).options.contextFingerprint,waits=[],r=await request(f,{...input,contextFingerprint:fingerprint,...change},{},waits);assert.equal(r.status,expected,await r.clone().text());const body=await r.json();await Promise.all(waits);return body.list||body;}
async function tick(f){const waits=[],noop=async()=>{};await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);}
async function finish(f,id){for(let i=0;i<12;i++){await tick(f);const list=await readCompanyList(f.env,workspaceId,id);if(['complete','incomplete'].includes(list.status))return list;}assert.fail('Company-list scheduler did not finish');}
const stateOf=(f,id)=>JSON.parse(f.DB.raw.prepare('SELECT state_json FROM company_lists WHERE id=?').get(id).state_json);
const found=(company,employees)=>({status:'found',registry:'SE-TEST',country:'SE',id:'55'+company.replace(/\D/g,'').padStart(6,'0'),name:company.toUpperCase()+' AB',city:'Stockholm',active:true,statusLabel:'ACTIVE',industry:{code:'289900',label:'Manufacture of special-purpose machinery'},employees:{count:employees},revenue:null,marketingProtected:false,source:{name:'Test register',url:'https://register.example/'+company,checkedAt:'2026-11-20T12:00:00.000Z'}});
const target={employees:{min:25,max:250},industries:['28'],registryOnly:true};

test('a known register mismatch is dropped before the evidence review; unknown facts keep the company flagged',async t=>{
 const f=await setup(t),prompts=[],asked=[];
 f.env.COMPANY_LIST_TEST_SERVICES={...profileServices({count:3,observe:p=>prompts.push(p)}),registry:async(query,options)=>{
  asked.push({...query,pages:query.pages.map(p=>p.url),hasSignal:Boolean(options?.signal)});
  if(query.company==='Factory0')return found('Factory0',120);
  if(query.company==='Factory1')return found('Factory1',833);
  return {status:'unavailable',registry:'SE-TEST',country:'SE'};
 }};
 const first=await start(f,{target}),list=await finish(f,first.id);
 assert.deepEqual(list.criteria.target,{version:1,employees:{min:25,max:250},revenue:null,industries:['28'],registryOnly:true});
 assert.deepEqual(list.results.map(r=>r.company).sort(),['Factory0','Factory2']);
 const kept=Object.fromEntries(list.results.map(r=>[r.company,r]));
 assert.deepEqual(kept.Factory0.target.checks.map(c=>[c.key,c.status]),[['registry','match'],['industry','match'],['employees','match']]);
 assert.equal(kept.Factory0.target.register.id,'55000000');assert.equal(kept.Factory0.score,90);
 assert.equal(kept.Factory2.target.register,null);assert.ok(kept.Factory2.target.checks.every(c=>c.status==='unknown'));
 assert.equal(kept.Factory0.quality.status,'reviewed');assert.equal(kept.Factory2.quality.status,'reviewed');

 const state=stateOf(f,first.id),dropped=state.reviews.filter(r=>r.company==='Factory1');
 assert.deepEqual(dropped.map(r=>[r.status,r.reason]),[['rejected','Outside the target criteria: 833 employees (outside 25–250)']]);
 assert.equal(prompts.filter(p=>p.stage==='review'&&p.candidate.company==='Factory1').length,0,'no paid review for a company the register excludes');
 assert.deepEqual(asked.map(a=>a.company).sort(),['Factory0','Factory1','Factory2']);
 assert.deepEqual(asked.find(a=>a.company==='Factory0'),{market:'Sweden',company:'Factory0',website:'https://factory0.example/',pages:['https://factory0.example/'],hasSignal:true});
 assert.equal(state.receipts.filter(r=>r.operation==='register_check'&&r.status==='complete').length,3);
});

test('a register that throws is treated as unavailable and never drops a company',async t=>{
 const f=await setup(t);
 f.env.COMPANY_LIST_TEST_SERVICES={...profileServices({count:2}),registry:async()=>{throw new Error('register offline');}};
 const list=await finish(f,(await start(f,{target,count:2})).id);
 assert.equal(list.status,'complete');assert.equal(list.results.length,2);
 assert.ok(list.results.every(r=>r.target.register===null&&r.target.checks[0].detail==='The business register could not be checked'));
});

test('lists without structured criteria never ask the register',async t=>{
 const f=await setup(t);
 f.env.COMPANY_LIST_TEST_SERVICES={...profileServices({count:2}),registry:async()=>assert.fail('register must not be asked')};
 const list=await finish(f,(await start(f,{count:2})).id);
 assert.equal(list.status,'complete');assert.equal(list.results.length,2);
 assert.ok(list.results.every(r=>!Object.hasOwn(r,'target')));assert.equal(Object.hasOwn(list.criteria,'target'),false);
 assert.equal(stateOf(f,list.id).receipts.some(r=>r.operation==='register_check'),false);
});

test('invalid structured criteria are refused at the authenticated start',async t=>{
 const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=profileServices({count:1});
 const refused=await start(f,{target:{employees:{min:300,max:25}}},400);
 assert.match(JSON.stringify(refused),/Employee minimum cannot exceed the maximum/);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM company_lists').get().n,0);
});

test('the assessment prompt asks for a quoted industry statement only when industries are selected',async t=>{
 for(const [criteria,expected] of [[target,true],[{employees:{max:250}},false],[undefined,false]])await t.test(JSON.stringify(criteria??null),async t=>{
  const f=await setup(t),prompts=[];
  f.env.COMPANY_LIST_TEST_SERVICES={...profileServices({count:1,observe:p=>prompts.push(p)}),registry:async()=>({status:'unavailable'})};
  await finish(f,(await start(f,{count:1,...(criteria?{target:criteria}:{})})).id);
  const assess=prompts.find(p=>p.stage==='assess');
  assert.equal(/industry:\{division,url,quote\}/.test(assess.instructions),expected);
 });
});

test('annual disclosure needs a literal source and independent confirmation before a strict financial match counts',async t=>{
 for(const [label,confirmed,literal,expected] of [['verified',true,true,1],['unreviewed',false,true,0],['invented',true,false,0]]){
  await t.test(label,async t=>{
   const f=await setup(t),base=profileServices({count:1}),year=new Date().getUTCFullYear()-1;
   const quote='Factory0 reported net revenue of DKK 30 million for calendar year '+year+'.';
   f.env.COMPANY_LIST_TEST_SERVICES={...base,registry:async()=>found('Factory0',100),annualEuroRate:async()=>({rate:7.5,url:'https://data-api.ecb.europa.eu/example'}),
    read:async url=>{const page=await base.read(url);return {...page,markdown:page.markdown+(literal?' '+quote:'')};},
    generate:async prompt=>{
     const answer=await base.generate(prompt);
     if(prompt.stage==='assess')answer.annualRevenue={url:prompt.pages[0].url,quote};
     if(prompt.stage==='review')answer.annualRevenueConfirmed=confirmed;
     return answer;
    }};
   const list=await finish(f,(await start(f,{count:1,minimumScore:80,target:{...target,revenue:{min:3000000,currency:'EUR'}}})).id);
   assert.equal(list.results.length,expected,list.progress.reason);
   if(expected){
    const check=list.results[0].target.checks.find(c=>c.key==='revenue');
    assert.equal(check.evidence.quote,quote);assert.match(check.detail,/4,000,000 EUR/);
   }
  });
 }
});

test('register outage retains a qualified candidate and resumes at its register check',async t=>{
 const f=await setup(t),base=profileServices({count:1});let available=false,reads=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,read:async url=>{reads++;return base.read(url);},
  registry:async()=>available?found('Factory0',100):{status:'unavailable'}};
 const first=await start(f,{count:1,minimumScore:80,target});
 let list=await readCompanyList(f.env,workspaceId,first.id);
 for(let i=0;i<5&&!list.progress.nextAttemptAt;i++){await tick(f);list=await readCompanyList(f.env,workspaceId,first.id);}
 assert.equal(list.failureCode,'registry_offline');
 assert.equal(list.incompleteChecks.length,0);
 const before=reads;available=true;
 await runCompanyListJobs(f.env,{jobId:first.id,now:list.progress.nextAttemptAt+1});
 list=await finish(f,first.id);
 assert.equal(list.results.length,1);
 assert.equal(reads,before);
});
