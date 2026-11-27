import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {planBuyerSearch} from '../src/buyer-search-plan.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import {sha256} from '../src/security.js';

// Live, 27 Nov 2026, release d3a7e486: "Expand web research" on a company from a fresh company list stopped after one
// minute with "Research needs attention" and no people. The job's only diagnostic was "identities: provider or source
// unavailable": the new "Full research query plan" step asks the workspace's reasoning model which queries to run, the
// model call failed, and nothing caught it. No search, no people search and no contact check ran, and the plan's task
// row stayed "running", so the resumed job stopped on "A prior provider request has no confirmed outcome".
// The plan step already falls back to its own rule plan when no model is connected or the answer cannot be read.
// A model call that fails now takes the same fallback, and the saved plan says why.
// These tests enter through the HTTP start and the scheduler, with the workspace's own reasoning provider.
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const ANSWER={
 // The model spent its output allowance before writing any text.
 noText:()=>json(200,{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{type:'reasoning',summary:[]}],usage:{input_tokens:400,output_tokens:220}}),
 serverError:()=>json(500,{error:{message:'The server had an error while processing your request.',type:'server_error'}}),
 rateLimit:()=>json(429,{error:{message:'Rate limit reached for requests.',type:'requests',code:'rate_limit_exceeded'}}),
 secondQueryAndMorePeople:()=>json(200,{output_text:'{"indices":[1],"findMorePeople":true}',usage:{input_tokens:400,output_tokens:20}})
};
async function setup(t,answer){
 const f=await buyerJobsFixture(t);
 try{f.DB.raw.exec(fs.readFileSync(new URL('../migrations/0010_workspace_ai_integrations.sql',import.meta.url),'utf8'));}catch{}
 f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 f.DB.raw.prepare('INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,?,?,?,?,1)').run(workspaceId,'openai',await encryptSecret('plan-failure-fixture-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY)),'fixture','gpt-6-luna');
 f.modelCalls=[];
 f.env.COPILOT_FETCH_IMPL=async(url,init={})=>{f.modelCalls.push(JSON.parse(init.body));return answer();};
 return f;
}
function call(f,body){
 return app.fetch(new Request(f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',
  headers:{Origin:f.env.APP_ORIGIN,Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify(body)}),f.env,{});
}
// One Full research job started over HTTP and worked by the scheduler until it leaves the identities phase or stops.
async function fullResearch(f){
 const seen={searches:[],peopleSearches:0};
 const home='https://'+f.candidate.domain+'/',name=f.candidate.company;
 const page=url=>({url,title:name,markdown:'# '+name+'\n'+name+' designs and manufactures industrial products.',links:[],metadata:{title:name,sourceURL:url,statusCode:200}});
 const services={read:async url=>page(url||home),search:async query=>{seen.searches.push(query);return [];},peopleSearch:async()=>{seen.peopleSearches++;return [];},
  apollo:async()=>({people:[]}),registry:async()=>({status:'unavailable'}),review:async()=>({supervisor:{status:'complete'},provider:'fixture'})};
 const response=await call(f,{...f.body,peopleFirst:true,fullResearch:true});assert.equal(response.status,200,await response.clone().text());
 const id=(await response.json()).job.id;
 const row=()=>f.DB.raw.prepare('SELECT status,phase,diagnostic_json FROM buyer_research_jobs WHERE id=?').get(id);
 const tick=async()=>{const waits=[];await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runWebsiteContactJobs:async()=>[],runBuyerResearchJobs:env=>runBuyerResearchJobs(env,{jobId:id,services,windowMs:50000})});await Promise.all(waits);};
 for(let i=0;i<8;i++){
  f.DB.raw.prepare('UPDATE buyer_research_jobs SET next_at=0 WHERE id=?').run(id);
  await tick();
  const now=row();if(!['queued','running'].includes(now.status)||!['official','identities'].includes(now.phase))break;
 }
 const job=row(),planKey=await sha256('independent|Full research query plan');
 const plan=f.DB.raw.prepare('SELECT status,result_json FROM buyer_research_tasks WHERE job_id=? AND task_key=?').get(id,planKey);
 return {id,job,diagnostics:JSON.parse(job.diagnostic_json||'[]'),plan,seen};
}

for(const [label,answer,cause] of [
 ['returns no text',ANSWER.noText,/no text/i],
 ['answers with a server error',ANSWER.serverError,/HTTP 500/],
 ['refuses with a rate limit',ANSWER.rateLimit,/HTTP 429/]
]){
 test('Full research goes on with the rule plan when the planning model '+label,async t=>{
  const f=await setup(t,answer),run=await fullResearch(f);
  assert.equal(f.modelCalls.length,1,'the planning model is asked once');
  // The job did not stop where the live one did.
  assert.ok(!run.diagnostics.some(d=>/provider or source unavailable|prior provider request/.test(d.reason||'')),JSON.stringify(run.diagnostics));
  assert.ok(!(run.job.status==='needs_review'&&run.job.phase==='identities'),'stopped in identities: '+run.job.diagnostic_json);
  // The plan step finished with a saved outcome, so a later slice or a resume has nothing uncertain to stop on.
  assert.equal(run.plan?.status,'complete');
  const saved=JSON.parse(run.plan.result_json);
  assert.equal(saved.provider,'rules');assert.ok(saved.queries.length<=3);
  // The fixture company already has a named buyer: the rule plan does not ask for more people.
  assert.equal(saved.findMorePeople,false);assert.equal(run.seen.peopleSearches,0);
  for(const query of saved.queries)assert.ok(run.seen.searches.includes(query),'planned query was not searched: '+query);
  // The job says which plan it used and why the model's plan was not available.
  const note=run.diagnostics.find(d=>d.code==='query_plan');
  assert.ok(note,'no query_plan diagnostic');assert.match(note.reason,/rules/);assert.match(note.reason,/planning model/i);assert.match(note.reason,cause);
  // The provider's own wording never reaches the customer's job record.
  assert.doesNotMatch(run.job.diagnostic_json,/server had an error|Rate limit reached/);
 });
}

test('Full research still follows the planning model when it answers',async t=>{
 const f=await setup(t,ANSWER.secondQueryAndMorePeople),run=await fullResearch(f);
 assert.equal(run.plan?.status,'complete');
 const saved=JSON.parse(run.plan.result_json);
 assert.equal(saved.provider,'openai');assert.equal(saved.queries.length,1);assert.equal(saved.findMorePeople,true);
 assert.ok(run.seen.searches.includes(saved.queries[0]));assert.ok(run.seen.peopleSearches>0,'the model asked for more people');
 const note=run.diagnostics.find(d=>d.code==='query_plan');
 assert.match(note.reason,/openai · 1 targeted queries$/);
});

test('a planning call cut off with the processing slice is not turned into a plan',async t=>{
 // The runner retains an interrupted dispatch for review (shared-search-strategy.test.mjs). A cut-off call must
 // therefore stay an error here, or the fallback would hide the interruption.
 const f=await setup(t,ANSWER.noText),controller=new AbortController();
 f.env.COPILOT_FETCH_IMPL=async()=>{controller.abort();throw Object.assign(Error('This operation was aborted'),{name:'AbortError'});};
 await assert.rejects(planBuyerSearch(f.env,workspaceId,{candidate:f.candidate,profile:{},queries:['one','two'],pages:[],signal:controller.signal}));
});
