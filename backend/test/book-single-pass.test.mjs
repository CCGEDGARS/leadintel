import test from 'node:test';import assert from 'node:assert/strict';
import {storageFixture} from './writing-reference-fixture.mjs';import {moduleResult} from './workspace-skill-fixture.mjs';
import {putWritingReference,getWritingReference,deleteWritingReference} from '../src/writing-reference-store.js';
import {runWritingReferenceJobs} from '../src/writing-reference-runner.js';
import {createWorkspaceSkill,getWorkspaceSkill} from '../src/workspace-skill-store.js';
import {runWorkspaceSkillJobs} from '../src/workspace-skill-runner.js';import {skillPackage} from '../src/workspace-skill-export.js';
import {readFileSync} from 'node:fs';
const scope={workspaceId:'w1',userId:'u1'};
async function source(){const env=storageFixture();for(const name of ['0055_workspace_skills.sql','0057_workspace_skill_diagnostics.sql','0058_workspace_skill_parts.sql','0060_skill_processing_progress.sql'])env.DB.raw.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));const text='Distinct substantive methods and evidence. '.repeat(500);const row=await putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'A Book.pdf',document:{bytes:new TextEncoder().encode(text),mime:'text/plain',sha256:'single-pass',extracted:{sections:[{location:'page:1',text}],coverage:{total:1,readable:1,unreadable:0,methodPlan:'20261027-single-pass-v1'}}}});return {env,row};}
test('one deep upload pass supplies summary and complete independent skill without a second AI pass',async()=>{
 const {env,row}=await source();let calls=0,peak=0,active=0;
 await runWritingReferenceJobs(env,{maxChunks:24,generate:async input=>{peak=Math.max(peak,++active);calls++;await new Promise(r=>setImmediate(r));active--;return moduleResult(input);}});
 const book=await getWritingReference(env,scope,row.id);assert.equal(book.status,'Ready');assert.ok(book.summary);assert.equal(peak,3);
 const catalogue=JSON.parse(env.objects.get(book.catalogue_key));assert.equal(catalogue.preparedSkill.modules.length,calls);assert.ok(calls>3);
 const skill=await createWorkspaceSkill(env,scope,{sourceId:row.id,expectedRevision:book.revision});
 await deleteWritingReference(env,scope,{id:row.id,expectedRevision:book.revision});
 await runWorkspaceSkillJobs(env,{generate:()=>{throw Error('A prepared book must not invoke AI again');}});
 const ready=await getWorkspaceSkill(env,scope,skill.id);assert.equal(ready.status,'Ready');assert.equal(ready.saved_sections,calls);assert.equal(ready.completed,calls);
 const pkg=await skillPackage(env,scope,skill.id);assert.equal(pkg.modules.length,calls);assert.equal(new Set(pkg.modules.map(m=>m.id)).size,calls);
});
test('parallel skill workers keep successful checkpoints when a sibling hits a rate limit',async()=>{
 const {skillFixture}=await import('./workspace-skill-fixture.mjs');const {env,source:book}=await skillFixture();const skill=await createWorkspaceSkill(env,scope,{sourceId:book.id,expectedRevision:1});let active=0,peak=0,n=0;
 await runWorkspaceSkillJobs(env,{maxChunks:24,generate:async input=>{const num=n++;peak=Math.max(peak,++active);await new Promise(r=>setImmediate(r));active--;if(num===1)throw Error('OpenAI request failed (429)');return moduleResult(input);}});
 const row=await getWorkspaceSkill(env,scope,skill.id);assert.equal(peak,3);assert.equal(n,3);assert.equal(row.saved_sections,2);assert.equal(row.status,'Processing');assert.equal(row.error_code,'AI_RATE_LIMIT');assert.ok(row.next_at>Date.now());
});
test('prepared methods require exact full coverage, unique IDs and source locations',async()=>{
 const {skillWorkItems,preparedSkillModules,skillModuleId,BOOK_METHODS_VERSION}=await import('../src/workspace-skill-plan.js');
 const input={extracted:{sections:[{location:'page:1',text:'a'.repeat(9000)}]}};
 const modules=skillWorkItems(input.extracted).map(w=>({...JSON.parse(moduleResult({prompt:JSON.stringify({chunk:w.chunk})}).text),id:skillModuleId(w.index,w.part)}));
 input.catalogue={preparedSkill:{version:BOOK_METHODS_VERSION,modules}};assert.equal(preparedSkillModules(input).length,3);
 modules[1].id=modules[0].id;assert.throws(()=>preparedSkillModules(input),/Invalid/);modules[1].id='method-1-part-2';modules[1].locations=['page:999'];assert.throws(()=>preparedSkillModules(input),/Invalid/);
 input.catalogue.preparedSkill.modules=modules.slice(0,1);assert.throws(()=>preparedSkillModules(input),/Invalid/);
});
test('a book and a skill in the same workspace share the request limit, including cancellation',async()=>{
 const {env,row}=await source();let started,release;const start=new Promise(r=>started=r),hold=new Promise(r=>release=r);
 const reading=runWritingReferenceJobs(env,{generate:async input=>{started();await hold;return moduleResult(input);}});await start;
 const key='skills/w1/pending/input.json';env.objects.set(key,JSON.stringify({title:'Independent',extracted:{sections:[{location:'page:1',text:'A useful decision method.'}]},catalogue:{techniques:[]}}));
 env.DB.raw.prepare("INSERT INTO workspace_skills(id,workspace_id,title,source_hash,status,input_key) VALUES('pending','w1','Independent','other','Processing',?)").run(key);
 let calls=0;await runWorkspaceSkillJobs(env,{generate:async input=>{calls++;return moduleResult(input);}});assert.equal(calls,0);
 await deleteWritingReference(env,scope,{id:row.id,expectedRevision:row.revision});release();await reading;
 assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM writing_reference_chunks').get().n,0);
 assert.ok(![...env.objects.keys()].some(k=>k.startsWith('writing/')));
 const now=Date.now()+2000;await runWorkspaceSkillJobs(env,{now,clock:()=>now,generate:moduleResult});assert.equal((await getWorkspaceSkill(env,scope,'pending')).status,'Ready');
});
test('prepared upload retries a rate limit without restarting saved methods',async()=>{
 const {env,row}=await source();let calls=0;
 await runWritingReferenceJobs(env,{generate:async input=>{if(++calls===2)throw Error('OpenAI request failed (429)');return moduleResult(input);}});
 let book=await getWritingReference(env,scope,row.id);assert.equal(book.status,'Processing');assert.match(book.error_code,/retrying automatically/i);
 const saved=env.DB.raw.prepare("SELECT count(*) n FROM writing_reference_chunks WHERE status='Complete'").get().n;assert.equal(saved,2);
 const job=env.DB.raw.prepare('SELECT * FROM writing_reference_jobs').get();calls=0;
 await runWritingReferenceJobs(env,{now:job.next_at,clock:()=>job.next_at,generate:async input=>{calls++;return moduleResult(input);}});
 book=await getWritingReference(env,scope,row.id);assert.equal(book.status,'Ready');assert.equal(book.error_code,'');
 const catalogue=JSON.parse(env.objects.get(book.catalogue_key));assert.equal(calls,catalogue.preparedSkill.modules.length-saved);
});
test('successful siblings cannot reset the three-attempt limit for one failing skill section',async()=>{
 const {skillFixture}=await import('./workspace-skill-fixture.mjs');const {env,source:book}=await skillFixture();const skill=await createWorkspaceSkill(env,scope,{sourceId:book.id,expectedRevision:1});let badPrompt,calls=0,now=Date.now();
 for(let attempt=0;attempt<3;attempt++){
  await runWorkspaceSkillJobs(env,{now,clock:()=>now,generate:async input=>{badPrompt??=input.prompt;if(input.prompt===badPrompt){calls++;throw Error('OpenAI request failed (429)');}return moduleResult(input);}});
  now=(await getWorkspaceSkill(env,scope,skill.id)).next_at+1;
 }
 const row=await getWorkspaceSkill(env,scope,skill.id);assert.equal(calls,3);assert.equal(row.status,'Failed');assert.ok(row.saved_sections>0);
});
test('maximum-size multilingual routing stays below D1 row limits without dropping methods',async()=>{
 const {skillRouting}=await import('../src/workspace-skill-plan.js');const methods=Array.from({length:1000},(_,n)=>({id:'method-'+n,title:'方'.repeat(200),purpose:'方'.repeat(1200),triggers:Array(20).fill('方'.repeat(120))}));
 const routing=skillRouting(methods);assert.equal(routing.length,1000);assert.equal(routing.at(-1).id,'method-999');assert.ok(new TextEncoder().encode(JSON.stringify(routing)).byteLength<1600000);
});
