import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {upsertCrmCompany} from '../src/crm.js';
import {startWebsiteContacts,readWebsiteContacts,publicWebsiteContacts} from '../src/website-contact-store.js';
import {runWebsiteContactJobs} from '../src/website-contact-runner.js';
import {createBuyerSourceSearch} from '../src/buyer-source-search.js';
import {handleWebsiteContactRoute} from '../src/website-contact-routes.js';
import app from '../src/app.js';

async function fixture(t){
 const f=await buyerJobsFixture(t),context={workspaceId,userId:f.users.owner.id,role:'owner',sessionHash:f.users.owner.sessionTokenHash};
 const detail=await upsertCrmCompany(f.DB,context,{company_name:'Finance Group',website:'https://finance.example/'});
 const job=await startWebsiteContacts(f.env,context,{companyId:detail.company.id});
 return {...f,context,job,state:JSON.parse(job.state_json)};
}
async function tick(f,services){
 const waits=[],noop=async()=>({});
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runWebsiteContactJobs:(env,o)=>runWebsiteContactJobs(env,{...o,jobId:f.job.id,windowMs:5000,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});
 await Promise.all(waits);return readWebsiteContacts(f.env,workspaceId,{id:f.job.id});
}
const names=['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind','Emma Wilson','Felix Turner'];
const person=(name,i)=>({id:'p'+i,name,publicName:name,title:'Director',identityOrigin:'official',publicNameUrl:'https://finance.example/team',organization:'Finance Group'});
test('registered website scheduler checks three contacts concurrently and coalesces shared source reads',async t=>{
 const f=await fixture(t);Object.assign(f.state,{phase:'contacts',people:names.map(person)});f.DB.raw.prepare('UPDATE website_contact_jobs SET state_json=? WHERE id=?').run(JSON.stringify(f.state),f.job.id);
 let active=0,peak=0,reads=0;
 const services={read:async url=>{reads++;await new Promise(r=>setTimeout(r,30));return {url,markdown:'# Finance Group\nFinance Group provides financial services.'};},checkPerson:async(_candidate,p,{read})=>{active++;peak=Math.max(peak,active);try{await read('https://finance.example/shared');await new Promise(r=>setTimeout(r,30));return {complete:true};}finally{active--;}}};
 const row=await tick(f,services);
 assert.equal(peak,3,'bounded parallelism must replace serial contact processing');
 assert.equal(reads,1,'concurrent people must share one underlying source request');
 assert.equal(publicWebsiteContacts(row).counts.checked,6);assert.equal(row.status,'complete');
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,0);
});
test('management checks start before a large company crawl is exhausted',async t=>{
 const f=await fixture(t),events=[];
 const services={read:async url=>{events.push('read:'+url);return {url,markdown:'# Finance Group\nFinance Group provides financial services.\n### Anna Andersson\nChief Executive Officer\nanna.andersson@finance.example',links:Array.from({length:39},(_,i)=>'https://finance.example/team/'+i)};},search:async()=>[],apollo:async()=>{events.push('apollo');return {people:[]};},checkPerson:async()=>{events.push('check');return {complete:true};}};
 for(let i=0;i<2&&!events.includes('check');i++)await tick(f,services);
 assert.ok(events.includes('check'),'first contacts must not wait for the forty-page crawl');
 assert.ok(events.slice(0,events.indexOf('check')).filter(x=>x.startsWith('read:')).length<=4,events.join('\n'));
 assert.ok(events.indexOf('apollo')<events.indexOf('check'),'free leadership discovery remains early');
 const state=JSON.parse((await readWebsiteContacts(f.env,workspaceId,{id:f.job.id})).state_json);
 assert.equal(state.coverage.sourceLimit,40,'deeper research remains available, not silently removed');
});
test('website search can discover URLs without paying for discarded page extraction',async()=>{
 let body;const search=createBuyerSourceSearch({},'w',{scrapeResults:false,credential:async()=>({apiKey:'fixture'}),fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return Response.json({success:true,data:[{url:'https://finance.example/team',description:'Company team'}]});}});
 assert.equal((await search('leadership'))[0].url,'https://finance.example/team');
 assert.equal('scrapeOptions' in body,false,'underlying pages are acquired separately with explicit attribution');
});
test('native active-job wake preserves deadline and receipts and cannot resume a stopped job',async t=>{
 const f=await fixture(t),url='https://app.fixture.test/api/websites/contacts?workspace_id='+workspaceId,headers={Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'};
 const send=()=>handleWebsiteContactRoute(new Request(url,{method:'POST',headers,body:JSON.stringify({action:'wake',jobId:f.job.id})}),f.env,{},{});
 let response=await send();assert.equal(response.status,200,await response.clone().text());
 let saved=await readWebsiteContacts(f.env,workspaceId,{id:f.job.id});assert.equal(saved.deadline_at,f.job.deadline_at);assert.equal(saved.state_json,f.job.state_json);
 f.DB.raw.prepare("UPDATE website_contact_jobs SET status='canceled' WHERE id=?").run(f.job.id);
 response=await send();assert.equal(response.status,200);saved=await readWebsiteContacts(f.env,workspaceId,{id:f.job.id});assert.equal(saved.status,'canceled');assert.equal(saved.deadline_at,f.job.deadline_at);
});

test('five-minute pass stops honestly and keeps evidence rather than reporting a user pause',async t=>{
 const f=await fixture(t);assert.ok(f.job.deadline_at-Date.now()<=5*60000);assert.ok(f.job.deadline_at-Date.now()>4*60000);
 f.DB.raw.prepare('UPDATE website_contact_jobs SET deadline_at=? WHERE id=?').run(Date.now()-1,f.job.id);
 const row=await tick(f,{read:()=>assert.fail('An expired pass cannot acquire another source')});
 const view=publicWebsiteContacts(row);assert.equal(row.status,'incomplete');assert.equal(view.stopReason,'time_limit');assert.match(view.label,/time limit reached/i);assert.doesNotMatch(view.label,/paused|30 minutes/);assert.equal(view.passBudgetMs,5*60000);
});

test('native HTTP wake enters the worker and lease contention cannot duplicate a provider request',async t=>{
 const f=await fixture(t),url='https://app.fixture.test/api/websites/contacts?workspace_id='+workspaceId,headers={Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},waits=[],original=globalThis.fetch;let reads=0,release;
 t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async input=>{const address=typeof input==='string'?input:input.url;if(address==='https://finance.example/'){reads++;await new Promise(r=>{release=r;});return new Response('<html><title>Finance Group</title><main>Finance Group provides financial services.</main></html>',{headers:{'Content-Type':'text/html'}});}throw Error('Fixture blocks external traffic');};
 const send=()=>handleWebsiteContactRoute(new Request(url,{method:'POST',headers,body:JSON.stringify({action:'wake',jobId:f.job.id})}),f.env,{}, {waitUntil:p=>waits.push(p)});
 assert.equal((await send()).status,200);for(let i=0;i<100&&!release;i++)await new Promise(r=>setTimeout(r,5));assert.ok(release);
 assert.equal((await send()).status,200);await new Promise(r=>setTimeout(r,20));assert.equal(reads,1,'the second browser wake must respect the durable lease');
 release();await Promise.all(waits);const saved=await readWebsiteContacts(f.env,workspaceId,{id:f.job.id});assert.equal(publicWebsiteContacts(saved).counts.reads,1);assert.equal(saved.deadline_at,f.job.deadline_at);
});

test('parallel real mandatory plans retain three Gmail queries, deep checks and source receipts for every person',async t=>{
 const f=await fixture(t),page={url:'https://finance.example/team',markdown:'# Finance Group\nFinance Group provides financial services.\n'+names.slice(0,3).map(n=>'### '+n+'\nDirector\n').join('\n'),sourceRead:true,evidenceKind:'page_extract',extractedAt:new Date().toISOString()};
 Object.assign(f.state,{phase:'contacts',people:names.slice(0,3).map(person),tasks:[{kind:'read',value:page.url,status:'complete',attempts:1,result:page}]});f.DB.raw.prepare('UPDATE website_contact_jobs SET state_json=? WHERE id=?').run(JSON.stringify(f.state),f.job.id);
 let active=0,peak=0;const services={search:async()=>{active++;peak=Math.max(peak,active);try{await new Promise(r=>setTimeout(r,5));return [];}finally{active--;}},independent:async()=>({status:'not_configured'}),read:()=>assert.fail('The saved official page must be reused')};
 let row;for(let i=0;i<3;i++){row=await tick(f,services);if(row.status==='complete')break;}
 const view=publicWebsiteContacts(row);assert.equal(view.counts.checked,3);assert.equal(peak,3);
 for(const p of view.people){assert.equal(p.contactResearch.checks.gmail.queryLog.length,3);assert.equal(p.contactResearch.checks.gmail.status,'complete');assert.equal(p.contactResearch.checks.deep.status,'complete');}
 assert.equal(view.counts.reads,1);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,0);
});

test('changing company identity during concurrent reads rejects every late write',async t=>{
 const f=await fixture(t);Object.assign(f.state,{phase:'contacts',people:names.slice(0,3).map(person)});f.DB.raw.prepare('UPDATE website_contact_jobs SET state_json=? WHERE id=?').run(JSON.stringify(f.state),f.job.id);
 let started=0,release;const gate=new Promise(r=>{release=r;});
 const row=await tick(f,{checkPerson:async(_candidate,p,{read})=>{await read('https://finance.example/'+p.id);return {complete:true};},read:async url=>{started++;if(started===3){f.DB.raw.prepare("UPDATE crm_companies SET company_name='Replacement Company' WHERE id=?").run(f.job.company_id);release();}await gate;return {url,markdown:'# Finance Group\nFinance Group provides financial services.'};}});
 assert.equal(started,3);assert.equal(row.status,'canceled');assert.equal(publicWebsiteContacts(row).counts.reads,0);assert.equal(publicWebsiteContacts(row).counts.checked,0);
});
