import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {createCopilotResearchJob,runCopilotResearchJobs} from '../src/copilot-research-jobs.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';

for(const peerQueries of [0,120])test(`actual minute scheduler bounds two active buyer jobs with ${peerQueries} admitted peer queries`,async t=>{
 const f=await buyerJobsFixture(t);
 for(const [domain,company] of [['forge.example','Forge Industries'],['forge-second.example','Forge Second']]){
  await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate:{company,domain,buyerRoles:['Head of Procurement'],people:[]}});
 }
 const conversationId=crypto.randomUUID();f.DB.raw.prepare('INSERT INTO copilot_conversations(id,workspace_id,created_by,title) VALUES(?,?,?,?)').run(conversationId,workspaceId,f.users.owner.id,'Public research');
 const copilot=await createCopilotResearchJob(f.env,{workspaceId,conversationId,userId:f.users.owner.id,sessionHash:f.users.owner.sessionTokenHash,question:'Analyze https://public.example/'});
 const services={
  search:async()=>[],
  read:async url=>{
   const origin=new URL(url).origin,links=Array.from({length:35},(_,i)=>`${origin}/contact/${i}`);
   return {url,markdown:'# Company contacts\n'+links.map((link,i)=>`[Contact ${i}](${link})`).join('\n'),links,metadata:{sourceURL:url}};
  }
 };
 let runtime,peerCompleted=0;const waits=[],noop=async()=>({completed:0});
 const jobs={
  runCopilotResearchJobs:(env,options)=>runCopilotResearchJobs(env,{...options,services:{plan:async()=>({companyName:'Public',companyDomain:'public.example'}),search:async()=>({results:[],web_search:true}),read:async url=>({url,markdown:'Public company makes industrial machinery for businesses. '.repeat(3)}),apollo:async()=>({people:[]}),answer:async()=>({answer:'Public company research [1].'})}}),
  runBuyerResearchJobs:async(env,options)=>{runtime=env;return runBuyerResearchJobs(env,{...options,services});},
  runWritingReferenceJobs:async env=>{
   if(!peerQueries)return {completed:0};
   assert.equal(env.bookInvocationBudget.admit(peerQueries),true,'A bounded peer workload can reserve shared invocation capacity');
   try{for(let i=0;i<peerQueries;i++){await env.DB.prepare('SELECT 1 AS n').first();peerCompleted++;}}
   finally{env.bookInvocationBudget.release(peerQueries);}
   return {completed:peerCompleted};
  },
  runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop
 };
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:promise=>waits.push(promise)},jobs);
 await Promise.all(waits);
 const used=runtime.bookInvocationBudget.used;
 t.diagnostic(`Shared minute invocation prepared ${used} statements; admitted peer completed ${peerCompleted}/${peerQueries} queries`);
 assert.ok(used<=900,`The shared minute invocation must retain D1 headroom; prepared ${used} statements`);
 assert.equal(peerCompleted,peerQueries,'The admitted peer workload must finish within the same shared budget');
 const copilotSaved=f.DB.raw.prepare('SELECT status,revision,state_json FROM copilot_research_jobs WHERE id=?').get(copilot.id);assert.ok(copilotSaved.revision>1,'Copilot shares the actual minute invocation and saves progress');assert.notEqual(copilotSaved.status,'running');
 const saved=f.DB.raw.prepare('SELECT status,phase,revision,result_json FROM buyer_research_jobs ORDER BY rowid').all();
 assert.equal(saved.length,2);
 assert.ok(saved.every(job=>job.status==='queued'),'Budget exhaustion leaves both official-source jobs queued, without abandoned running leases');
 assert.ok(saved.some(job=>job.revision>1),'The worker must checkpoint actual progress before yielding');
 assert.ok(saved.some(job=>JSON.parse(job.result_json).buyerDiscovery?.officialContactInventory?.sourcePages?.length>0),'Completed official source evidence survives the budget checkpoint');
 assert.ok(f.DB.raw.prepare("SELECT count(*) AS n FROM buyer_research_tasks WHERE status='complete'").get().n>0,'Completed source-task receipts remain durable');
});
