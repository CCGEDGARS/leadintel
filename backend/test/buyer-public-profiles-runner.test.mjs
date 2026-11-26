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

test('Expand sends each public people query on its own and keeps the current people that profiles name, not former ones',async t=>{
 const {f,job}=await identitiesJob(t);const asked=[];
 const peopleSearch=async query=>{asked.push(query);return /LinkedIn/.test(query)?[
  profileRow('sara-holm-1','Sara Holm','- **Head of Procurement**\n**Forge Industries**\nMarch 2023 - Present'),
  profileRow('nils-berg-2','Nils Berg','- **Head of Procurement**\n**Forge Industries**\nJuly 2019 - October 2024 · 5 years 4 months'),
  {url:'https://www.linkedin.com/company/forge-industries',title:'Forge Industries | LinkedIn',description:'Company page',markdown:'Company page',evidenceKind:'search_excerpt',searchProvider:'perplexity'}
 ]:/chairman/.test(query)?[{url:'https://theorg.com/org/forge-industries/org-chart/eva-lind',title:'Eva Lind - Chair at Forge Industries | The Org',description:'Board',markdown:'Board',evidenceKind:'search_excerpt',searchProvider:'perplexity'}]:[];};
 await run(f.env,{jobId:job.id,services:services({peopleSearch})});
 assert.equal(asked.length,6,'one request per people query: '+JSON.stringify(asked));
 assert.ok(asked.every(query=>typeof query==='string'&&!/\bsite:|\sOR\s/.test(query)),'plain queries without operators: '+JSON.stringify(asked));
 const saved=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);
 const sara=saved.people.find(person=>person.name==='Sara Holm');
 assert.ok(sara,'the current profile person is saved: '+JSON.stringify(saved.people.map(person=>[person.name,person.title])));
 assert.equal(sara.title,'Head of Procurement');assert.equal(sara.organization,'Forge Industries');
 assert.equal(sara.publicNameUrl,'https://www.linkedin.com/in/sara-holm-1');assert.equal(sara.identityEvidence?.kind,'public_profile');
 const eva=saved.people.find(person=>person.name==='Eva Lind');
 assert.ok(eva,'the chair from a directory person page is saved: '+JSON.stringify(saved.people.map(person=>[person.name,person.title])));
 assert.equal(eva.identityEvidence?.kind,'public_directory');
 assert.ok(!saved.people.some(person=>person.name==='Nils Berg'),'a former employee stays out');
 assert.ok(saved.people.some(person=>person.id==='robert'),'the kept buyer stays');
 const tasks=f.DB.raw.prepare("SELECT status,request_value,result_json FROM buyer_research_tasks WHERE job_id=? AND request_value LIKE 'Public people%'").all(job.id);
 assert.equal(tasks.length,6,'each query is its own reusable task receipt');assert.ok(tasks.every(task=>task.status==='complete'));
 const linkedIn=tasks.find(task=>/LinkedIn/.test(task.request_value));
 assert.deepEqual(JSON.parse(linkedIn.result_json).rows.map(row=>row.url),['https://www.linkedin.com/in/sara-holm-1','https://www.linkedin.com/in/nils-berg-2'],'only personal profile and directory person rows are kept');
});

test('a profile person stays in the buyer pool when the ten shown places are already taken',async t=>{
 // Live, 26 Nov 2026 (a control company): ten staff from the contact page filled the shown places, and a current board
 // chair read from a public profile was ranked below them and dropped from both the shown list and the pool.
 const f=await buyerJobsFixture(t);
 const staff=Array.from({length:10},(_,i)=>({id:'staff-'+i,name:['Alma','Bent','Carl','Dorte','Erik','Freja','Gorm','Hanne','Ivar','Jonna'][i]+' '+['Holm','Lund','Berg','Dahl','Krog','Wind','Sand','Bach','Moe','Rask'][i],publicName:'',title:'Head of Procurement',organization:'Forge Industries',publicNameUrl:'https://forge.example/team',kept:true}));
 staff.forEach(person=>{person.publicName=person.name;});
 f.body.candidate={...f.body.candidate,people:staff};
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='identities' WHERE id=?").run(job.id);
 const peopleSearch=async query=>/LinkedIn/.test(query)?[profileRow('eva-lind-9','Eva Lind','- **Chairman of the Board**\n**Forge Industries**\nMarch 2022 - Present')]:[];
 await run(f.env,{jobId:job.id,services:services({peopleSearch})});
 const saved=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);
 assert.ok((saved.buyerDiscovery?.pool||[]).some(person=>person.name==='Eva Lind'),'the chair is kept in the pool: '+JSON.stringify((saved.buyerDiscovery?.pool||[]).map(person=>person.name)));
 assert.ok(saved.people.length<=10);
});

test('the register\'s city is saved and narrows the people searches; asking again for it never loses a found answer',async t=>{
 const registerAnswer={status:'found',registry:'DK-CVR',country:'DK',id:'12345678',name:'FORGE INDUSTRIES',active:true,management:[],source:{name:'CVR',url:'https://apicvr.dk/api/v1/12345678'},city:'Hvide Sande'};
 const {f,job}=await identitiesJob(t);const asked=[];
 await run(f.env,{jobId:job.id,services:services({registry:async()=>registerAnswer,peopleSearch:async query=>{asked.push(query);return [];}})});
 const saved=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);
 assert.equal(saved.buyerDiscovery.registerManagement.city,'Hvide Sande');
 assert.ok(asked.some(query=>query.includes('Hvide Sande')),JSON.stringify(asked));
 // A job saved before the city existed: the register is asked once more; an outage keeps the found answer.
 const second=await identitiesJob(t);
 second.f.DB.raw.prepare("UPDATE buyer_research_jobs SET result_json=json_set(result_json,'$.buyerDiscovery',json(?)) WHERE id=?").run(JSON.stringify({registerManagement:{status:'found',id:'12345678',people:1,attempts:1,checkedAt:'2026-11-25T21:52:20.245Z'}}),second.job.id);
 await run(second.f.env,{jobId:second.job.id,services:services({registry:async()=>({status:'unavailable'}),peopleSearch:async()=>[]})});
 const kept=JSON.parse((await readBuyerJob(second.f.env,workspaceId,{id:second.job.id})).result_json).buyerDiscovery.registerManagement;
 assert.deepEqual({status:kept.status,people:kept.people,attempts:kept.attempts},{status:'found',people:1,attempts:2});
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
