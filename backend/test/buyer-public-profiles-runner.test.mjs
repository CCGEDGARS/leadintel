import test from 'node:test';
import assert from 'node:assert/strict';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';

// B3, 26 Nov 2026: Expand research asks one public people request (the workspace's own Perplexity key) and reads the
// current people that the returned public profiles name. Invented company and people.
const page=(url,text='Robert Lund — Head of Procurement — Forge Industries')=>({url,markdown:text,metadata:{sourceURL:url,source:'direct-fallback'}});
async function run(env,options){const {runBuyerResearchJobs}=await import('../src/buyer-research-runner.js');return runBuyerResearchJobs(env,{maxJobs:1,windowMs:2000,...options});}
const emptySearch=()=>Object.assign([],{searchProviders:['grounded'],researchTrace:[{provider:'grounded',status:'succeeded',operation:'search',results:0}]});
function services(overrides={}){return {search:async()=>emptySearch(),read:async url=>page(url),dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',reason:'No independent test connection',results:[]}),review:async()=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:['robert'],findings:[]},conflicts:[],summary:'Reviewed supplied evidence'}),...overrides};}
const profileRow=(slug,name,entry)=>({url:`https://www.linkedin.com/in/${slug}`,title:`${name} | LinkedIn`,description:entry.slice(0,300),markdown:`**${name}**\n**Purchasing**\n**Purchasing**\nMalmö, Skåne, Sweden\n### Experience\n${entry}`,lastUpdated:'2026-11-02',evidenceKind:'search_excerpt',buyerSource:'perplexity',searchProvider:'perplexity'});
async function identitiesJob(t){
 const f=await buyerJobsFixture(t);
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='identities' WHERE id=?").run(job.id);
 return {f,job};
}

test('Expand asks one public people request and keeps the current people its profiles name, not former ones',async t=>{
 const {f,job}=await identitiesJob(t);const asked=[];
 const peopleSearch=async queries=>{asked.push(queries);return [
  profileRow('sara-holm-1','Sara Holm','- **Head of Procurement**\n**Forge Industries**\nMarch 2023 - Present'),
  profileRow('nils-berg-2','Nils Berg','- **Head of Procurement**\n**Forge Industries**\nJuly 2019 - October 2024 · 5 years 4 months')
 ];};
 await run(f.env,{jobId:job.id,services:services({peopleSearch})});
 assert.equal(asked.length,1,'one people request per job');
 assert.ok(asked[0].length>=1&&asked[0].length<=5,JSON.stringify(asked[0]));
 assert.ok(asked[0].every(query=>!/\bsite:|\sOR\s/.test(query)),'no search-engine operators: '+JSON.stringify(asked[0]));
 const saved=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);
 const sara=saved.people.find(person=>person.name==='Sara Holm');
 assert.ok(sara,'the current profile person is saved: '+JSON.stringify(saved.people.map(person=>[person.name,person.title])));
 assert.equal(sara.title,'Head of Procurement');assert.equal(sara.organization,'Forge Industries');
 assert.equal(sara.publicNameUrl,'https://www.linkedin.com/in/sara-holm-1');assert.equal(sara.identityEvidence?.kind,'public_profile');
 assert.ok(!saved.people.some(person=>person.name==='Nils Berg'),'a former employee stays out');
 assert.ok(saved.people.some(person=>person.id==='robert'),'the kept buyer stays');
 const task=f.DB.raw.prepare("SELECT status,result_json FROM buyer_research_tasks WHERE job_id=? AND request_value LIKE 'Public people%'").get(job.id);
 assert.equal(task?.status,'complete','the people answer is a reusable task receipt');
 assert.equal(JSON.parse(task.result_json).rows.length,2);
});

test('a person the job already holds keeps the evidence it has',async t=>{
 const {f,job}=await identitiesJob(t);
 const peopleSearch=async()=>[profileRow('robert-lund-3','Robert Lund','- **Procurement Lead**\n**Forge Industries**\nJanuary 2021 - Present')];
 await run(f.env,{jobId:job.id,services:services({peopleSearch})});
 const saved=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);
 const robert=saved.people.filter(person=>person.name==='Robert Lund');
 assert.equal(robert.length,1);assert.equal(robert[0].title,'Head of Procurement');assert.equal(robert[0].publicNameUrl,'https://forge.example/team');
});

test('a workspace without a Perplexity key sends no people request',async t=>{
 const {f,job}=await identitiesJob(t);const sent=[];
 t.mock.method(globalThis,'fetch',async input=>{sent.push(String(input?.url||input));return new Response('{}',{status:404});});
 await run(f.env,{jobId:job.id,services:services()});
 assert.ok(!sent.some(url=>url.includes('api.perplexity.ai')),'no Perplexity request without a key');
 const tasks=f.DB.raw.prepare('SELECT request_value FROM buyer_research_tasks WHERE job_id=?').all(job.id).map(row=>row.request_value);
 assert.ok(!tasks.some(value=>/^Public people/.test(value)),JSON.stringify(tasks));
 assert.ok(JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json).people.some(person=>person.id==='robert'));
});
