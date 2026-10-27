import test from 'node:test';
import assert from 'node:assert/strict';
import {skillFixture,moduleResult} from './workspace-skill-fixture.mjs';
import {createWorkspaceSkill,getWorkspaceSkill,mutateWorkspaceSkill} from '../src/workspace-skill-store.js';
import {runWorkspaceSkillJobs} from '../src/workspace-skill-runner.js';
import {skillPackage} from '../src/workspace-skill-export.js';
import {readFileSync} from 'node:fs';
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
