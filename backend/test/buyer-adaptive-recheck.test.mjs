import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,parse} from '../src/buyer-research-store.js';
import {createBuyerSourceSearch} from '../src/buyer-source-search.js';
import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
test('selected Recheck uses server history, retains same-person receipts and advances alternative queries',async t=>{
 const f=await buyerJobsFixture(t),old=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),candidate=parse(old.result_json),person=candidate.people[0];
 const plan=D.buyerRecheckPlan(candidate,person),stamp=new Date().toISOString();
 person.contactResearch={version:1,identityKey:D.buyerResearchIdentityKey(candidate,person),checks:{followup:{status:'complete',checkedAt:stamp,queryLog:plan.queries.map(query=>({query,status:'complete',checkedAt:stamp,sourceReads:[]}))}}};
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='done',result_json=? WHERE id=?").run(JSON.stringify(candidate),old.id);
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,force:true,personIds:[person.id],paidResearch:true}),input=parse(job.input_json);
 assert.equal(job.phase,'contacts');assert.equal(Boolean(input.paidResearch),false);assert.equal(input.recheck.maxActiveMs,120000);
 assert.ok(input.recheck.plans[person.id].queries.length);assert.ok(input.recheck.plans[person.id].queries.every(query=>!plan.queries.includes(query)));
 assert.equal(input.candidate.people[0].contactResearch.checks.followup.queryLog.length,4);
 // A reused ID with a new person's name cannot reuse earlier checks.
 const changed={...f.candidate,people:[{...f.candidate.people[0],name:'Different Person',publicName:'Different Person'}]};
 const other=await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate:changed,force:true,personIds:[person.id]});
 assert.equal(parse(other.input_json).candidate.people[0].contactResearch,undefined);
});
test('alternative search actually consults the configured grounded path after nonempty primary results',async()=>{
 let grounded=0;const search=createBuyerSourceSearch({},'w',{credential:async()=>({apiKey:'fixture'}),fetchImpl:async()=>new Response(JSON.stringify({success:true,data:[{url:'https://example.com/old'}]})),grounded:async()=>{grounded++;return {status:'complete',web_search:true,results:[{url:'https://example.com/new.pdf'}]};}});
 const ordinary=await search('ordinary');assert.equal(grounded,0);assert.equal(ordinary.length,1);
 const diverse=await search('gap',{diversify:true});assert.equal(grounded,1);assert.equal(diverse.length,2);assert.deepEqual(diverse.searchProviders,['firecrawl','grounded']);
});
test('unavailable alternative provider retains successful primary evidence',async()=>{
 const search=createBuyerSourceSearch({},'w',{credential:async()=>({apiKey:'fixture'}),fetchImpl:async()=>new Response(JSON.stringify({success:true,data:[{url:'https://example.com/contact'}]})),grounded:async()=>{throw Error('offline');}});
 const rows=await search('gap',{diversify:true});assert.equal(rows.length,1);assert.equal(rows[0].searchProvider,'firecrawl');
});
test('query families are portable and exhausted fresh searches are not repeated',()=>{
 for(const [company,domain,name] of [['Forge','forge.example','Anna Buyer'],['Clinic','clinic.example','Marta Silva']]){
 const c={company,domain},p={name,title:'Director'},first=D.buyerRecheckPlan(c,p),history=[];
 for(let i=0;i<4;i++){const plan=D.buyerRecheckPlan(c,p,history);for(const query of plan.queries){assert.ok(query.includes(name));assert.ok(query.includes(company)||query.includes(domain));history.push({query,status:'complete',checkedAt:new Date().toISOString()});}}
 assert.equal(D.buyerRecheckPlan(c,p,history).exhausted,true);assert.ok(first.queries.length<=4);
 }
});
test('focused Recheck stops contact processing at its active-time budget and is not reopened by legacy recovery',async t=>{
 const {runBuyerResearchJobs}=await import('../src/buyer-research-runner.js'),{recoverInterruptedContactJob}=await import('../src/buyer-research-store.js'),f=await buyerJobsFixture(t);
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,force:true,personIds:['robert']});let now=Date.now();
 await runBuyerResearchJobs(f.env,{jobId:job.id,now,maxJobs:1,windowMs:500000,clock:()=>now,services:{search:async()=>{now+=121000;throw Object.assign(Error('slice interrupted'),{code:'TIME_BUDGET'});}}});
 const result=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id);assert.equal(result.phase,'review');assert.match(result.diagnostic_json,/budget reached/);
 const candidate=parse(result.result_json);candidate.buyerDiscovery.officialContactInventory={research:{status:'partial',discoveryScope:'old'}};
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='done',result_json=? WHERE id=?").run(JSON.stringify(candidate),job.id);
 assert.equal(await recoverInterruptedContactJob(f.env,{jobId:job.id}),null);
});
