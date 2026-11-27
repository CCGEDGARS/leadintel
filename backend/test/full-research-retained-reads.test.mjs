import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {putCustomerState} from '../src/customer-state.js';

// Live, 27 Nov 2026, release 5b8270d7: "Expand web research" for a company with six named people worked for ten
// minutes in "Contact evidence", then sent nothing for nineteen (the card said "Research delayed"), and the 30-minute
// run window paused it before company research and the evidence review started.
// A page read still in flight when a processing slice ends keeps its task row "running". Full research retains such a
// dispatch and never sends it again, but the contacts phase still counted the row as work it could retry, so it
// neither finished nor moved on: it ran empty slices until the eighteen-idle-slice bound, one per minute.
// A dispatch the runner will not send again is no longer counted as retryable contact work.
// The job enters through the HTTP start and the scheduler with its shared statement budget.
const NAMES=['Robert Lund','Alice Peters','Erik Holm'];
async function fullResearchWithReadsInFlight(t,{inFlight}){
 const f=await buyerJobsFixture(t);
 const candidate={...f.candidate,people:NAMES.map((name,i)=>({id:'p'+i,name,publicName:name,title:'Head of Procurement',organization:f.candidate.company,publicNameUrl:'https://'+f.candidate.domain+'/team',kept:true}))};
 f.payload.discovery.selectedProspects=[candidate];
 await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:1,payload:f.payload});
 const page=url=>({url,title:candidate.company,markdown:'# '+candidate.company+'\n'+candidate.company+' designs and manufactures industrial products.\n'+NAMES.map(n=>'## '+n+'\nHead of Procurement').join('\n'),links:[],metadata:{title:candidate.company,sourceURL:url,statusCode:200}});
 let thirdParty=0,held=0;
 const services={
  // The first third-party pages never answer: each ends only when its processing slice stops.
  read:async(url,signal)=>{
   if(!url.includes(candidate.domain)&&++thirdParty<=inFlight){held++;await new Promise((_,reject)=>{const stop=()=>reject(Object.assign(Error('This operation was aborted'),{name:'AbortError'}));if(signal?.aborted)stop();else signal?.addEventListener('abort',stop,{once:true});});}
   return page(url);
  },
  search:async query=>{const who=NAMES.find(n=>query.includes(n))||candidate.company;return [0,1].map(i=>({url:'https://directory'+i+'.example/'+encodeURIComponent(query).slice(0,60)+'/'+i,title:who+' – '+candidate.company,description:who+', Head of Procurement at '+candidate.company,markdown:who+', Head of Procurement at '+candidate.company}));},
  peopleSearch:async()=>[],apollo:async()=>({people:[]}),registry:async()=>({status:'unavailable'}),plan:async()=>({queries:[],findMorePeople:false,provider:'fixture'}),
  review:async()=>({supervisor:{status:'complete'},provider:'fixture'}),independent:async()=>({status:'not_configured'}),independentMinimumMs:0
 };
 const start=await app.fetch(new Request(f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Origin:f.env.APP_ORIGIN,Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify({action:'start',candidate,peopleFirst:true,fullResearch:true})}),f.env,{});
 assert.equal(start.status,200,await start.clone().text());
 const id=(await start.json()).job.id,q=sql=>f.DB.raw.prepare(sql),ticks=[];let done=0;
 for(let i=0;i<45;i++){
  q('UPDATE buyer_research_jobs SET next_at=0 WHERE id=?').run(id);
  const waits=[];
  await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runWebsiteContactJobs:async()=>[],runBuyerResearchJobs:env=>runBuyerResearchJobs(env,{jobId:id,services,windowMs:900})});
  await Promise.all(waits);
  const job=q('SELECT status,phase FROM buyer_research_jobs WHERE id=?').get(id);
  const now=Number(q("SELECT count(*) AS n FROM buyer_research_tasks WHERE job_id=? AND status='complete'").get(id).n);
  ticks.push({phase:job.phase,status:job.status,finished:now-done});done=now;
  if(!['queued','running'].includes(job.status))break;
 }
 const retained=Number(q("SELECT count(*) AS n FROM buyer_research_tasks WHERE job_id=? AND phase='contacts' AND kind='read' AND status='running'").get(id).n);
 const diagnostics=q('SELECT diagnostic_json FROM buyer_research_jobs WHERE id=?').get(id).diagnostic_json;
 return {ticks,held,retained,diagnostics,emptyContactSlices:ticks.filter(t=>t.phase==='contacts'&&t.finished===0).length};
}

test('Full research leaves Contact evidence once only retained page reads remain',async t=>{
 const run=await fullResearchWithReadsInFlight(t,{inFlight:2});
 // The reads were in flight when their slices stopped, and Full research kept them for review instead of sending them again.
 assert.equal(run.held,2);assert.equal(run.retained,2);
 // The phase does not spend its idle-slice bound waiting for dispatches it will never send.
 assert.ok(run.emptyContactSlices<=3,'empty contact slices: '+run.emptyContactSlices+' of '+run.ticks.length+' ticks');
 assert.doesNotMatch(run.diagnostics,/Phase work budget reached/);
 // The job goes on through company research and the evidence review.
 const last=run.ticks.at(-1);
 assert.equal(last.phase,'done',JSON.stringify(run.ticks.slice(-4)));
});

test('Full research without reads in flight finishes as before',async t=>{
 const run=await fullResearchWithReadsInFlight(t,{inFlight:0});
 assert.equal(run.retained,0);assert.equal(run.ticks.at(-1).phase,'done');
 assert.doesNotMatch(run.diagnostics,/Phase work budget reached/);
});
