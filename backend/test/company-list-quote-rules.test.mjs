import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import app from '../src/app.js';
import {profileMain,profileServices} from './company-list-profile-fixture.mjs';

// The application drops an assessed company when a quote is shorter than twelve characters or when the location label
// is not written inside the location quote. On 22 Nov 2026 a replay of a live list showed 18 of 24 company websites
// lost to these two checks although the model had judged them a fit: the prompt had never stated them.
async function setup(t){const f=await buyerJobsFixture(t);f.payload.main={...f.payload.main,...profileMain()};f.version=1;await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:f.version++,payload:f.payload});return f;}
async function request(f,body,params={},waits=[]){return app.fetch(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{waitUntil:p=>waits.push(p)});}
async function start(f){const fingerprint=(await (await request(f,null,{options:'1'})).json()).options.contextFingerprint,waits=[],r=await request(f,{action:'start',name:'Quote rules',count:3,budget:100,profileIds:['icp-core'],profileMode:'any',signalMode:'off',markets:['Sweden'],contextFingerprint:fingerprint},{},waits);assert.equal(r.status,200,await r.clone().text());const body=await r.json();await Promise.all(waits);return body.list||body;}
async function tick(f){const waits=[],noop=async()=>{};await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);}
async function finish(f,id){for(let i=0;i<12;i++){await tick(f);const list=await readCompanyList(f.env,workspaceId,id);if(['complete','incomplete'].includes(list.status))return list;}assert.fail('Company-list scheduler did not finish');}
const stateOf=(f,id)=>JSON.parse(f.DB.raw.prepare('SELECT state_json FROM company_lists WHERE id=?').get(id).state_json);

test('the assessment prompt states the quote rules that the application enforces on every answer',async t=>{
 const f=await setup(t),prompts=[],base=profileServices({count:3,observe:p=>prompts.push(p)});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>{
  const answer=await base.generate(p);
  if(p.stage!=='assess')return answer;
  // Factory0 follows the rules. Factory1 adds words to the place name. Factory2 quotes the company name alone.
  if(answer.company==='Factory1')answer.location.label='Greater Stockholm, Sweden';
  if(answer.company==='Factory2')answer.identity.quote='Factory2';
  return answer;
 }};
 const list=await finish(f,(await start(f)).id),state=stateOf(f,list.id);
 assert.deepEqual(state.results.map(r=>r.company),['Factory0'],'only the answer that follows the rules is kept');
 assert.equal(state.results[0].location,'Stockholm');
 assert.deepEqual(state.reviews.filter(r=>r.status==='needs_evidence').map(r=>new URL(r.url).hostname).sort(),['factory1.example','factory2.example']);

 const instructions=prompts.find(p=>p.stage==='assess').instructions;
 assert.match(instructions,/Copy each quote exactly as it is written on the page, at least 12 characters long\./);
 assert.match(instructions,/the identity quote is a phrase or line that contains the company name, never the name alone\./);
 assert.match(instructions,/location\.label is a place name copied exactly as it is written inside location\.quote, for example the town from the address; add no country or other words to it\./);
});
