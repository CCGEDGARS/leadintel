import test from 'node:test';
import assert from 'node:assert/strict';
import {skillFixture,moduleResult} from './workspace-skill-fixture.mjs';
import {createWorkspaceSkill,getWorkspaceSkill,mutateWorkspaceSkill,cleanupWorkspaceSkill} from '../src/workspace-skill-store.js';
import {runWorkspaceSkillJobs} from '../src/workspace-skill-runner.js';
import {skillPackage} from '../src/workspace-skill-export.js';
import {readFileSync} from 'node:fs';
import {storageDb} from './workspace-storage-fixture.mjs';
import {withWorkspaceStorage} from '../src/workspace-storage-objects.js';
const scope={workspaceId:'w1',userId:'u1'};
async function pending(){const {env,source}=await skillFixture();return {env,skill:await createWorkspaceSkill(env,scope,{sourceId:source.id,expectedRevision:1})};}

// Reproduces the failure at the real request boundary: large sections cannot finish.
test('a long book reaches Ready with bounded requests and no readable source text omitted',async()=>{
 const {env,skill}=await pending();const seen=[];
 const snapshot=JSON.parse(env.objects.get(skill.input_key));
 const original=Array.from({length:180},(_,n)=>`Distinct method ${n}: verify evidence, identify assumptions, compare options and record the decision.\n`).join('');
 snapshot.extracted.sections[0].text=original;env.objects.set(skill.input_key,JSON.stringify(snapshot));
 await runWorkspaceSkillJobs(env,{maxChunks:30,generate:async input=>{
  const {chunk}=JSON.parse(input.prompt);const size=chunk.sections.reduce((n,s)=>n+s.text.length,0);
  if(size>4000)throw Error('OpenAI request timed out');
  seen.push(...chunk.sections);return moduleResult(input);
 }});
 const row=await getWorkspaceSkill(env,scope,skill.id);assert.equal(row.status,'Ready');
 for(let at=0;at<original.length;at+=100)assert.ok(seen.some(s=>s.location==='page:1'&&s.text.includes(original.slice(at,at+100))));
 assert.ok(seen.some(s=>s.location==='page:2'&&s.text==='Second framework: compare assumptions and decide.'));
 const pkg=await skillPackage(env,scope,skill.id);assert.equal(pkg.modules.length,seen.length);
 assert.equal(new Set(pkg.modules.map(m=>m.id)).size,pkg.modules.length,'export reference IDs are unique');
});

test('each small section is checkpointed and a retry never regenerates a saved part',async()=>{
 const {env,skill}=await pending();let calls=0;const seen=[];
 await runWorkspaceSkillJobs(env,{maxChunks:30,generate:async input=>{if(++calls===2)throw Error('OpenAI request timed out');seen.push(input.prompt);return moduleResult(input);}});
 let row=await getWorkspaceSkill(env,scope,skill.id);assert.equal(row.status,'Processing');assert.equal(row.saved_sections,1);
 await runWorkspaceSkillJobs(env,{now:row.next_at,maxChunks:30,generate:async input=>{assert.ok(!seen.includes(input.prompt),'saved first part must not be generated again');return moduleResult(input);}});
 row=await getWorkspaceSkill(env,scope,skill.id);assert.equal(row.status,'Ready');assert.ok(row.total>=4);
 await mutateWorkspaceSkill(env,scope,skill.id,{expectedRevision:row.revision,delete:true});
 assert.ok(![...env.objects.keys()].some(k=>k.startsWith('skills/')));
});

test('an existing full-size completed section is reused while remaining sections are split',async()=>{
 const {env,skill}=await pending();const key=`skills/w1/${skill.id}/legacy.json`;
 const legacy=JSON.parse(moduleResult({prompt:JSON.stringify({chunk:{locations:['page:1']}})}).text);legacy.id='method-1';legacy.title='Previously saved expertise';
 env.objects.set(key,JSON.stringify(legacy));env.DB.raw.prepare('INSERT INTO workspace_skill_chunks VALUES(?,?,?)').run(skill.id,0,key);
 await runWorkspaceSkillJobs(env,{maxChunks:30,generate:async input=>{const {chunk}=JSON.parse(input.prompt);assert.ok(chunk.sections.every(s=>!s.text.startsWith('Explain a useful')));return moduleResult(input);}});
 const pkg=await skillPackage(env,scope,skill.id);assert.equal(pkg.modules[0].title,'Previously saved expertise');
 assert.equal(new Set(pkg.modules.map(m=>m.id)).size,pkg.modules.length);
});

test('provider responses after sixty seconds remain within the conversion deadline',async t=>{
 const {env,skill}=await pending();
 const {importAesKey,encryptSecret}=await import('../src/oauth.js');
 const {workspaceSkillGenerator}=await import('../src/workspace-skill-provider.js');
 env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 env.DB.raw.exec('CREATE TABLE workspace_ai_integrations(workspace_id TEXT,provider TEXT,model TEXT,encrypted_api_key TEXT,active INTEGER)');
 const encrypted=await encryptSecret('unit-test-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 env.DB.raw.prepare('INSERT INTO workspace_ai_integrations VALUES(?,?,?,?,1)').run('w1','openai','gpt-6.1-sol',encrypted);
 const deadlines=new WeakMap();
 t.mock.method(AbortSignal,'timeout',ms=>{const controller=new AbortController();deadlines.set(controller.signal,{ms,controller});return controller.signal;});
 const generate=await workspaceSkillGenerator(env,'w1',{fetchImpl:async(url,request)=>{
  const deadline=deadlines.get(request.signal);
  if(deadline.ms<=70000){deadline.controller.abort();throw new DOMException('Deadline exceeded','TimeoutError');}
  const body=JSON.parse(request.body),result=moduleResult({prompt:body.input});
  return new Response(JSON.stringify({output_text:result.text,usage:{input_tokens:10,output_tokens:10}}),{status:200});
 }});
 await runWorkspaceSkillJobs(env,{maxChunks:30,generate});
 assert.equal((await getWorkspaceSkill(env,scope,skill.id)).status,'Ready');
});

test('a slow batch retains its lease beyond the old three minute deadline',async()=>{
 const {env}=await pending();const now=Date.now();let started,release;
 const start=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);
 const running=runWorkspaceSkillJobs(env,{now,clock:()=>now,maxChunks:4,generate:async input=>{started();await hold;return moduleResult(input);}});
 await start;
 const parallel=await runWorkspaceSkillJobs(env,{now:now+190000,clock:()=>now+190000,generate:()=>{throw Error('must not claim leased conversion');}});
 release();await running;assert.equal(parallel.length,0);
});

test('the upgrade resumes only timed-out failed jobs and keeps their source snapshot',async()=>{
 const {env,skill}=await pending();
 env.DB.raw.prepare("UPDATE workspace_skills SET status='Failed',error_code='AI_TIMEOUT',retry_attempts=3 WHERE id=?").run(skill.id);
 env.DB.raw.prepare("INSERT INTO workspace_skills(id,workspace_id,title,source_hash,status,error_code,input_key) VALUES('billing','w1','Billing','other','Failed','AI_BILLING','private-input')").run();
 env.DB.raw.exec('DROP TABLE workspace_skill_parts');
 env.DB.raw.exec(readFileSync(new URL('../migrations/0058_workspace_skill_parts.sql',import.meta.url),'utf8'));
 const row=await getWorkspaceSkill(env,scope,skill.id);assert.equal(row.status,'Processing');assert.equal(row.retry_attempts,0);
 assert.ok(await env.WRITING_REFERENCES_BUCKET.get(row.input_key));
 assert.equal((await getWorkspaceSkill(env,scope,'billing')).status,'Failed');
 await runWorkspaceSkillJobs(env,{maxChunks:30,generate:moduleResult});assert.equal((await getWorkspaceSkill(env,scope,skill.id)).status,'Ready');
});

test('a 440-page book advances with bounded database work in every batch',async()=>{
 const {env,skill}=await pending(),snapshot=JSON.parse(env.objects.get(skill.input_key));
 snapshot.extracted.sections=Array.from({length:440},(_,n)=>({location:`page:${n+1}`,text:(`Distinct page ${n+1}: compare evidence and assumptions. `).repeat(87)+` END OF PAGE ${n+1}`}));
 snapshot.coverage={total:446,readable:440,unreadable:6};env.objects.set(skill.input_key,JSON.stringify(snapshot));
 const prepare=env.DB.prepare.bind(env.DB);let queries=0,maxQueries=0;env.DB.prepare=sql=>{queries++;return prepare(sql);};
 const pages=new Set(),tails=new Set();let row,now=Date.now();
 for(let batch=0;batch<400;batch++){
  const before=queries;
  await runWorkspaceSkillJobs(env,{now,clock:()=>now,maxChunks:4,generate:async input=>{
   const {chunk}=JSON.parse(input.prompt);assert.ok(chunk.sections.reduce((n,s)=>n+s.text.length,0)<=4000);
   for(const s of chunk.sections){pages.add(s.location);if(s.text.includes('END OF PAGE'))tails.add(s.location);}
   return moduleResult(input);
  }});
  maxQueries=Math.max(maxQueries,queries-before);row=await getWorkspaceSkill(env,scope,skill.id);
  if(row.status==='Ready')break;assert.equal(row.status,'Processing');now+=60000;
 }
 assert.equal(row.status,'Ready');assert.equal(pages.size,440);assert.equal(tails.size,440);
 assert.ok(maxQueries<50,`a batch used ${maxQueries} D1 calls; saved parts must be loaded in one query`);
 const pkg=await skillPackage(env,scope,skill.id);assert.equal(pkg.modules.length,row.total);
});

test('large skill deletion makes durable progress within a bounded per-invocation budget',async()=>{
 const {env,skill}=await pending();
 for(let n=0;n<880;n++){const key=`skills/w1/${skill.id}/method-${n}.json`;env.objects.set(key,'{}');env.DB.raw.prepare('INSERT INTO workspace_skill_parts VALUES(?,?,?,?)').run(skill.id,n,0,key);env.DB.raw.prepare('INSERT INTO workspace_skill_objects VALUES(?,?)').run(skill.id,key);}
 env.DB.raw.prepare("UPDATE workspace_skills SET status='Deleting' WHERE id=?").run(skill.id);
 const originalDelete=env.WRITING_REFERENCES_BUCKET.delete.bind(env.WRITING_REFERENCES_BUCKET);let deletes=0;
 env.WRITING_REFERENCES_BUCKET.delete=async key=>{if(++deletes>40)throw Error('invocation budget exhausted');return originalDelete(key);};
 for(let batch=0;batch<40;batch++){
  deletes=0;await cleanupWorkspaceSkill(env,skill.id);
  if(env.DB.raw.prepare('SELECT status FROM workspace_skills WHERE id=?').get(skill.id).status==='Deleted')break;
 }
 assert.equal(env.DB.raw.prepare('SELECT status FROM workspace_skills WHERE id=?').get(skill.id).status,'Deleted');
 assert.ok(![...env.objects.keys()].some(k=>k.startsWith('skills/')));
 assert.equal(env.DB.raw.prepare('SELECT count(*) AS n FROM workspace_skill_parts WHERE skill_id=?').get(skill.id).n,0);
});

test('880-method deletion completes through the real quota meter under a D1 invocation cap',async()=>{
 const DB=storageDb(),objects=new Map(),id='large-skill';
 DB.raw.prepare("INSERT INTO workspace_skills(id,workspace_id,title,source_hash,status) VALUES(?,'storage-w1','Large book','large-book-hash','Deleting')").run(id);
 for(let n=0;n<880;n++){
  const key=`skills/storage-w1/${id}/method-${n}-lease.json`;objects.set(key,'{}');
  DB.raw.prepare('INSERT INTO workspace_skill_parts VALUES(?,?,?,?)').run(id,n,0,key);
  DB.raw.prepare('INSERT INTO workspace_skill_objects VALUES(?,?)').run(id,key);
  DB.raw.prepare("INSERT INTO workspace_storage_objects(object_key,workspace_id,byte_size,state) VALUES(?,'storage-w1',2,'ready')").run(key);
 }
 const env=withWorkspaceStorage({DB,WORKSPACE_STORAGE_ENABLED:'true',WRITING_REFERENCES_BUCKET:{
  async head(key){return objects.has(key)?{size:2}:null;},async get(){return null;},async delete(key){objects.delete(key);}
 }});
 const prepare=DB.prepare.bind(DB);let queries=0;DB.prepare=sql=>{if(++queries>600)throw Error('D1 invocation cap exceeded');return prepare(sql);};
 for(let batch=0;batch<30;batch++){
  queries=0;await cleanupWorkspaceSkill(env,id);
  if(DB.raw.prepare('SELECT status FROM workspace_skills WHERE id=?').get(id).status==='Deleted')break;
 }
 assert.equal(DB.raw.prepare('SELECT status FROM workspace_skills WHERE id=?').get(id).status,'Deleted');
 assert.equal(objects.size,0);assert.equal(DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().files_bytes,0);
 assert.equal(DB.raw.prepare('SELECT count(*) n FROM workspace_skill_objects WHERE skill_id=?').get(id).n,0);
});
