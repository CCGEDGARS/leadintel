import test from 'node:test';
import assert from 'node:assert/strict';
import Client from '../../customer/buyer-research-jobs.js';
import largeSnapshot from '../../customer/test/fixtures/buyer-large-snapshot.cjs';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState,getCustomerState} from '../src/customer-state.js';
import {activeBuyerProfile,startBuyerJob} from '../src/buyer-research-store.js';
import {handleBuyerResearchRoute} from '../src/buyer-research-routes.js';
async function richFixture(t){
 const f=await buyerJobsFixture(t),names=['Robert Lund','Alice Berg','Cecilia Berg','David Lind','Erik Dahl','Frida West','Gustav North','Hanna East','Ingrid South','Johan Lake'];
 const owner=largeSnapshot({...f.candidate,people:names.map((name,i)=>({...f.candidate.people[0],id:'buyer-'+i,name,publicName:name}))});
 f.payload.discovery.selectedProspects=[owner];await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:1,payload:f.payload});
 const before=await getCustomerState(f.env,workspaceId);assert.ok(Buffer.byteLength(JSON.stringify(before.payload))>1000000);
 const send=async body=>handleBuyerResearchRoute(new Request('https://app.fixture.test/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify(body)}),f.env);
 return {...f,owner,before,send,profile:activeBuyerProfile(f.payload)};
}
test('a large saved workspace starts research through the real authenticated route without duplicating its history',async t=>{
 const f=await richFixture(t),body={action:'start',...Client.requestInput(f.owner,f.profile)},response=await f.send(body);assert.ok(Buffer.byteLength(JSON.stringify(body))<64000);assert.equal(response.status,200,await response.clone().text());
 const {job}=await response.json();assert.equal(job.status,'queued');assert.equal(job.candidate.people.length,10);assert.equal(job.candidate.people[9].name,'Johan Lake');
 const input=JSON.parse(f.DB.raw.prepare('SELECT input_json FROM buyer_research_jobs WHERE id=?').get(job.id).input_json);assert.equal(input.candidate.people[0].contactResearch,undefined);assert.equal(input.profile.priorityOffers,'industrial automation');
 assert.deepEqual(await getCustomerState(f.env,workspaceId),f.before);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_enrichment_requests').get().n,0);
 const oversized=await f.send({action:'start',candidate:{domain:f.owner.domain,company:f.owner.company},unused:'x'.repeat(270000)});assert.equal(oversized.status,400);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_jobs').get().n,1,'the backend request limit remains enforced');
});
test('the real browser client resumes a large saved job by revision and preserves completed source receipts',async t=>{
 const f=await richFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,{action:'start',...Client.requestInput(f.owner,f.profile)});
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='official',revision=7,result_json=? WHERE id=?").run(JSON.stringify(f.owner),job.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,result_json) VALUES(?,'completed-source','read','official','https://forge.example/team','complete',2,'{\"sourceRead\":true}')").run(job.id);
 const before=f.DB.raw.prepare('SELECT input_json,result_json FROM buyer_research_jobs WHERE id=?').get(job.id),receipt=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks').get(),commands=[],controller=new AbortController(),bridge={workspace:{id:workspaceId},session:{authenticated:true,user:{id:f.users.owner.id}}};
 const client=Client.createClient({apiBase:'https://app.fixture.test',getBridge:()=>bridge,pollMs:2,fetchImpl:async(url,init)=>{if(init.method==='POST')commands.push(JSON.parse(init.body));return handleBuyerResearchRoute(new Request(url,{...init,headers:{...init.headers,Cookie:'leadintel_session='+f.users.owner.token}}),f.env);}});
 await assert.rejects(client.research(f.owner,{profile:f.profile,force:true,resumeIncomplete:true,signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});
 assert.equal(commands.length,1);assert.deepEqual(commands[0],{action:'resume',jobId:job.id,expectedRevision:7});const row=f.DB.raw.prepare('SELECT status,revision,input_json,result_json FROM buyer_research_jobs WHERE id=?').get(job.id);assert.equal(row.status,'queued');assert.equal(row.revision,8);const resumedInput=JSON.parse(row.input_json),originalInput=JSON.parse(before.input_json);assert.ok(Date.parse(resumedInput.executionWindowStartedAt)>=Date.parse(originalInput.executionWindowStartedAt));delete resumedInput.executionWindowStartedAt;delete originalInput.executionWindowStartedAt;assert.deepEqual(resumedInput,originalInput);assert.equal(row.result_json,before.result_json);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks').get(),receipt);assert.deepEqual(await getCustomerState(f.env,workspaceId),f.before);
});
test('a queued compact-input checkpoint and workspace reopen retain sourced authority and current role holds',async t=>{
 const f=await richFixture(t),p=f.owner.people[0],quote='Robert Lund has full authority for the project delivery area and reports directly to the CEO.';
 p.title='Area Director';p.identityEvidenceDate=new Date().toISOString();p.decisionEvidence=[{url:'https://forge.example/team',date:new Date().toISOString(),quote}];f.owner.people[1].opportunityScope={status:'review_required',reason:'Current employment requires review',url:'https://forge.example/team',checkedAt:new Date().toISOString()};
 await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:2,payload:f.payload});const before=await getCustomerState(f.env,workspaceId),controller=new AbortController(),writes=[],bridge={workspace:{id:workspaceId},session:{authenticated:true,user:{id:f.users.owner.id}}};
 const client=Client.createClient({apiBase:'https://app.fixture.test',getBridge:()=>bridge,pollMs:2,fetchImpl:(url,init)=>handleBuyerResearchRoute(new Request(url,{...init,headers:{...init.headers,Cookie:'leadintel_session='+f.users.owner.token}}),f.env)});
 await assert.rejects(client.research(f.owner,{profile:f.profile,signal:controller.signal,onProgress:()=>controller.abort(),persist:()=>{const payload=structuredClone(before.payload);payload.discovery.selectedProspects=[structuredClone(f.owner)];writes.push(putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:before.version,payload}));}}),{name:'AbortError'});await Promise.all(writes);
 const stored=await getCustomerState(f.env,workspaceId),reopened=globalThis.LeadIntelDiscovery.normalizeDiscoveryState(stored.payload.discovery).selectedProspects[0];assert.equal(reopened.people[0].decisionEvidence[0].quote,quote);assert.equal(globalThis.LeadIntelDiscovery.isExecutiveBuyer(reopened.people[0]),true);assert.equal(globalThis.LeadIntelDiscovery.qualifyBuyer(reopened.people[0],{decisionMakers:['Executive leadership']},reopened).eligible,true);assert.equal(globalThis.LeadIntelDiscovery.qualifyBuyer(reopened.people[1],{decisionMakers:['Head of Procurement']},reopened).eligible,false);assert.equal(reopened.people[1].opportunityScope.reason,'Current employment requires review');
});
