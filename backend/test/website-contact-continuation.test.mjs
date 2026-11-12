import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {upsertCrmCompany} from '../src/crm.js';
import {startWebsiteContacts,readWebsiteContacts,publicWebsiteContacts} from '../src/website-contact-store.js';
import {runWebsiteContactJobs} from '../src/website-contact-runner.js';
import app from '../src/app.js';

async function fixture(t){
 const f=await buyerJobsFixture(t),context={workspaceId,userId:f.users.owner.id,role:'owner',sessionHash:f.users.owner.sessionTokenHash};
 const detail=await upsertCrmCompany(f.DB,context,{company_name:'Finance Group',website:'https://finance.example/'});
 const job=await startWebsiteContacts(f.env,context,{companyId:detail.company.id});
 return {...f,context,job,state:JSON.parse(job.state_json)};
}
const person=(id,name)=>({id,name,publicName:name,title:'Director',organization:'Finance Group',identityOrigin:'official',publicNameUrl:'https://finance.example/team'});
async function tick(f,services,windowMs=3000){
 const pending=[],noop=async()=>({});
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>pending.push(p)},{runWebsiteContactJobs:(env,options)=>runWebsiteContactJobs(env,{...options,jobId:f.job.id,windowMs,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});
 await Promise.all(pending);
 return readWebsiteContacts(f.env,workspaceId,{id:f.job.id});
}
test('a sliced contact cannot starve later people across registered scheduler wakes',async t=>{
 const f=await fixture(t);Object.assign(f.state,{phase:'contacts',people:[person('slow','Anna Andersson'),person('next','Bo Svensson'),person('last','Cecilia Berg')]});
 f.DB.raw.prepare('UPDATE website_contact_jobs SET state_json=? WHERE id=?').run(JSON.stringify(f.state),f.job.id);
 const calls=[],services={checkPerson:async(_candidate,p)=>{calls.push(p.id);if(p.id==='slow'){p.contactResearch={checks:{official:{status:'complete',queryLog:[{query:'Read official identity',status:'complete'}]}}};throw Object.assign(Error('Controlled processing slice ended'),{code:'TIME_BUDGET'});}return {complete:true};}};
 await tick(f,services);const row=await tick(f,services),view=publicWebsiteContacts(row);
 assert.ok(calls.includes('next')&&calls.includes('last'),'later people must receive processing time');
 assert.equal(view.counts.checked,2);assert.equal(view.counts.pending,1);assert.equal(row.status,'queued');
 assert.equal(view.people.find(p=>p.id==='slow').contactResearch.checks.official.status,'complete');
 assert.equal(view.people.find(p=>p.id==='slow').freeResearchStatus,undefined,'interruption must not pretend coverage is complete');
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,0);
});
test('a slow source uses bounded attempts before other official pages are read', {timeout:6000},async t=>{
 const f=await fixture(t),home={url:'https://finance.example/',markdown:'# Finance Group\nFinance Group provides financial services.',links:['https://finance.example/team/blocked','https://finance.example/team'],sourceRead:true,extractedAt:new Date().toISOString()};
 Object.assign(f.state,{discoveryStep:7,tasks:[{kind:'read',value:home.url,status:'complete',attempts:1,result:home}]});
 f.DB.raw.prepare('UPDATE website_contact_jobs SET state_json=? WHERE id=?').run(JSON.stringify(f.state),f.job.id);
 let blocked=0,team=0;
 const services={read:async(url,signal)=>{if(url.endsWith('/blocked')){blocked++;return new Promise((_,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason||Error('Source timed out')),{once:true});});}team++;return {url,markdown:'# Finance Group\n### Bo Svensson\nDirector\nbo.svensson@finance.example',links:[]};},search:async()=>[],apollo:async()=>({people:[]}),checkPerson:async()=>({complete:true})};
 let row;for(let i=0;i<6;i++)row=await tick(f,services,400);
 const state=JSON.parse(row.state_json),failed=state.tasks.find(t=>t.value.endsWith('/blocked'));
 assert.equal(blocked,2,'a source timeout must consume its bounded retry, not reset forever');
 assert.equal(team,1,'later readable evidence must still be acquired');
 assert.equal(failed.attempts,2);assert.equal(failed.status,'failed');
 assert.ok(state.people.some(p=>p.name==='Bo Svensson'));
 const view=publicWebsiteContacts(row);assert.ok(view.sourceIssues.some(i=>i.value.endsWith('/blocked')&&i.attempts===2));
});

test('a source response arriving after its operation timeout cannot add evidence', {timeout:4000},async t=>{
 const f=await fixture(t),url='https://finance.example/team/slow',home={url:'https://finance.example/',markdown:'# Finance Group\nFinance Group provides financial services.',links:[url],sourceRead:true,extractedAt:new Date().toISOString()};
 Object.assign(f.state,{discoveryStep:7,tasks:[{kind:'read',value:home.url,status:'complete',attempts:1,result:home}]});f.DB.raw.prepare('UPDATE website_contact_jobs SET state_json=? WHERE id=?').run(JSON.stringify(f.state),f.job.id);
 let release;const services={read:()=>new Promise(resolve=>{release=resolve;})};
 const row=await tick(f,services,250),before=row.state_json;
 assert.equal(JSON.parse(before).tasks.find(t=>t.value===url).status,'failed');
 f.DB.raw.prepare("UPDATE crm_companies SET company_name='Replaced Finance Group' WHERE id=?").run(f.job.company_id);
 release({url,markdown:'# Finance Group\n### Wrong Late Person\nCEO\nlate@finance.example'});await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await readWebsiteContacts(f.env,workspaceId,{id:f.job.id})).state_json,before,'late provider work must not mutate the saved checkpoint');
 assert.doesNotMatch(before,/Wrong Late Person/);
});
