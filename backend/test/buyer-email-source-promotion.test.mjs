import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {sha256} from '../src/security.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
const D=globalThis.LeadIntelDiscovery;

for(const originalBinding of ['confirmed','overwritten'])test(`actual scheduler retains or recovers a ${originalBinding} accepted source from its durable read receipt`,async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),candidate=structuredClone(f.candidate),person=candidate.people[0],E1='https://forge.example/team/confirmed',E2='https://forge.example/contact/new',email='robert.lund@forge.example',checkedAt=new Date(Date.now()-60000).toISOString(),quote=`### ${person.name}\n${person.title}\n${email}\nForge Industries`;
 Object.assign(person,{publicName:person.name,identityStatus:'confirmed',nameVerification:'confirmed',publicNameUrl:E1,publicEmail:email,publicEmailUrl:originalBinding==='confirmed'?E1:E2,publicEmailEvidence:{version:2,url:originalBinding==='confirmed'?E1:E2,quote,sourceKind:'official',...(originalBinding==='confirmed'?{sourceRead:true}:{}),checkedAt},publicEmailSourceCheck:{version:2,status:'confirmed',email,url:E1,checkedAt}});
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts',result_json=? WHERE id=?").run(JSON.stringify(candidate),job.id);
 const key=await sha256('read|'+E1),page={url:E1,markdown:quote,sourceRead:true,extractedAt:checkedAt};
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,result_json,updated_at) VALUES(?,?,'read','official',?,'complete',1,?,datetime('now','-1 minute'))").run(job.id,key,E1,JSON.stringify(page));
 for(let i=0;i<30;i++)f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,status,attempts,result_json) VALUES(?,?,'read','official','complete',1,?)").run(job.id,'context-'+i,JSON.stringify({url:`https://forge.example/context/${i}`,markdown:'Forge Industries official project and company background.',sourceRead:true,extractedAt:new Date().toISOString()}));
 const reads=[];let searches=0;const services={search:async()=>++searches===1?[{url:E2,title:'Forge Industries staff',description:`${person.name}, ${person.title}, ${email}`,sourceRead:false,evidenceKind:'search_excerpt'}]:[],read:async url=>{reads.push(url);throw Error('The new source remains unread; existing source receipts must be reused');},independent:async()=>({status:'not_configured',results:[]})};
 const pending=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>pending.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,jobId:job.id,maxJobs:1,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(pending);
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id}),result=JSON.parse(saved.result_json),value=result.people.find(p=>p.id===person.id);
 assert.equal(value.publicEmailUrl,E1);assert.equal(value.publicEmailEvidence.url,E1);assert.equal(value.publicEmailEvidence.sourceRead,true);assert.equal(D.acceptedOfficialBuyerEmail(result,value),email);
 assert.equal(value.publicEmailSourceCheck.url,E1,'Confirmation remains bound to the original read URL');assert.equal(reads.includes(E1),false,'The durable accepted source must never be fetched again');
 const receipt=f.DB.raw.prepare('SELECT attempts,status,result_json FROM buyer_research_tasks WHERE job_id=? AND task_key=?').get(job.id,key);assert.equal(receipt.attempts,1);assert.equal(receipt.status,'complete');assert.equal(receipt.result_json,JSON.stringify(page));
 assert.equal(value.publicEmailEvidence.checkedAt,checkedAt,'Reusing E1 cannot invent a new source-read timestamp');
});
