import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storageDb} from './workspace-storage-fixture.mjs';
import {moduleResult} from './workspace-skill-fixture.mjs';
import {sha256} from '../src/security.js';
import {encryptSecret,importAesKey} from '../src/oauth.js';
import app from '../src/app.js';

const require=createRequire(import.meta.url);
const {createWritingReferencesApi}=require('../../customer/writing-references-api.js');
const {createWritingAssistant}=require('../../customer/writing-assistant.js');
const {createWritingWorkspaceApi}=require('../../customer/writing-workspace.js');
const workspaceId='storage-w1',origin='https://leadintel-api.edgars-7e7.workers.dev';

// Real customer adapters, authenticated Worker routes, all SQL migrations and
// the registered scheduler. Only R2 transport and external AI responses are controlled.
test('uploaded book resumes in cron, grounds discussion and becomes an independent writing skill',async()=>{
 const DB=storageDb(),objects=new Map(),providerRequests=[],http=[],pending=[];
 const env={DB,APP_ORIGIN:'https://app.example.test',WRITING_REFERENCES_ALLOWED_WORKSPACES:workspaceId+',storage-w2',
  OAUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),
  WRITING_REFERENCES_BUCKET:{async put(key,value){objects.set(key,value);},async get(key){const value=objects.get(key);return value===undefined?null:{async text(){return typeof value==='string'?value:new TextDecoder().decode(value);},async arrayBuffer(){return typeof value==='string'?new TextEncoder().encode(value).buffer:value.slice().buffer;}};},async delete(key){objects.delete(key);}}
 };
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner',datetime('now','+1 day'))").run(await sha256('book-journey'));
 const encrypted=await encryptSecret('controlled-book-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,'gemini',?,'test','fixture-model',1)").run(workspaceId,encrypted);
 const originalFetch=globalThis.fetch;let rateLimited=false;
 globalThis.fetch=async(url,options)=>{
  assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com','No unplanned external services');
  const body=JSON.parse(options.body),prompt=body.contents.flatMap(c=>c.parts).map(p=>p.text||'').join('\n'),input=JSON.parse(prompt);
  providerRequests.push(input);let result;
  if(input.chunk){
   if(!rateLimited){rateLimited=true;return Response.json({error:{code:429,status:'RESOURCE_EXHAUSTED',message:'Controlled rate limit'}},{status:429});}
   assert.ok(input.chunk.sections.some(s=>s.text.includes('evidence')),'provider receives actual extracted text');
   result=JSON.parse(moduleResult({prompt}).text);
  }else if(input.method_catalogue)result={methods:input.method_catalogue.slice(0,1).map(m=>m.id)};
  else{
   assert.ok(input.context,'Actual assistant prompt');
   if(input.retrievedSources.length){assert.match(input.retrievedSources[0].text,/evidence/);result={reply:'Compare evidence before deciding.',draft:null,citations:[{passageId:input.retrievedSources[0].id}],warnings:[]};}
   else{assert.ok(input.workspaceSkills.skills.length);assert.match(input.workspaceSkills.skills[0].methods[0].content,/evidence/);result={reply:'Used the evidence checklist to clarify the question.',draft:{subject:'',message:'Compare the available evidence before choosing an option. What evidence is missing?'},citations:[],warnings:[],used_skill_ids:[input.workspaceSkills.skills[0].id,'invented']};}
  }
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:10}});
 };
 const fetchImpl=async(url,options={})=>{
  const target=new URL(url,origin),headers=new Headers(options.headers);
  if(options.credentials!=='omit')headers.set('Cookie','leadintel_session=book-journey');
  const response=await app.fetch(new Request(target,{...options,headers}),env,{waitUntil(p){pending.push(p);}});
  http.push({path:target.pathname,status:response.status});return response;
 };
 const json=async(path,body)=>{const response=await fetchImpl(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;};
 const cron=async now=>{const work=[];await app.scheduled({cron:'* * * * *',scheduledTime:now||Date.now()},env,{waitUntil(p){work.push(p);}});await Promise.all(work);};
 let snapshot,assistant;
 const api=createWritingReferencesApi({workspaceId,fetchImpl,onResult:value=>snapshot=value});
 try{
  await api.list();assert.equal(snapshot.cards.length,0);
  const text='Separate known evidence from assumptions. Compare options against the desired outcome. Ask what evidence is missing. '.repeat(100);
  await api.upload(1,new File([text],'Decision methods.txt',{type:'text/plain'}),0);
  assert.equal(providerRequests.length,0,'upload saves a durable job without a request-bound analysis');
  let book=snapshot.cards[0];assert.equal(book.status,'Processing');
  assert.equal(DB.raw.prepare('SELECT state FROM writing_reference_jobs WHERE source_id=?').get(book.id).state,'Pending');
  await cron();await api.list();assert.equal(snapshot.cards[0].status,'Processing');
  const saved=DB.raw.prepare("SELECT count(*) n FROM writing_reference_chunks WHERE source_id=? AND status='Complete'").get(book.id).n;assert.ok(saved>0,'successful siblings survive the rate limit');
  const job=DB.raw.prepare('SELECT * FROM writing_reference_jobs WHERE source_id=?').get(book.id);
  await cron(job.next_at+1);await api.list();book=snapshot.cards[0];assert.equal(book.status,'Ready',JSON.stringify(book));assert.equal(book.coverage.skillPrepared,true);
  assert.equal(providerRequests.filter(r=>r.chunk).length,DB.raw.prepare('SELECT count(*) n FROM writing_reference_chunks WHERE source_id=?').get(book.id).n+1,'only the failed section is repeated');
  assert.equal(await (await fetchImpl(api.originalUrl(book.id))).text(),text);
  assert.equal((await api.extracted(book.id)).sections[0].text,text);
  const selectedBook={id:book.id,revision:book.revision};let sourceRefs=[selectedBook],skillRefs=[];
  const capture=()=>({scope:workspaceId+':general',fingerprint:'general',usable:true,referenceRevision:snapshot.referenceRevision,sourceRefs,skillRefs,context:{writingContext:'general',channel:'general',currentDraft:{subject:'',message:''}}});
  assistant=createWritingAssistant({workbench:true,sessionStore:null,capture,request:body=>json('/api/writing-assistant/reply?workspace_id='+workspaceId,body),validatePreview:p=>api.assertGenerationCurrent(p.provenance)});
  assert.equal(await assistant.ask('How should I compare business options?',{intent:'advice',bookOnly:true}),true,assistant.state().error);
  assert.equal(assistant.state().messages.at(-1).citations[0].sourceId,book.id);assert.equal(assistant.state().working.message,'','book discussions do not rewrite the draft');
  const created=await api.createSkill(book.id,{expectedRevision:book.revision}),skillId=created.skills[0].id,callsBefore=providerRequests.length;
  await api.delete(book.id,{expectedRevision:book.revision});await cron();
  assert.equal(providerRequests.length,callsBefore,'cached methods survive source deletion without another AI analysis');
  const skill=(await api.listSkills()).skills[0];assert.equal(skill.status,'Ready');
  const reopened=createWritingReferencesApi({workspaceId,fetchImpl});assert.equal((await reopened.list()).cards.length,0);assert.equal((await reopened.listSkills()).skills[0].id,skillId);
  assert.equal((await fetchImpl(api.originalUrl(book.id))).status,404);assert.ok(![...objects.keys()].some(k=>k.startsWith('writing/')));
  const view=await reopened.viewSkill(skillId);assert.match(view.markdown,/Decision methods/);assert.ok(view.methods.length>0);
  const zip=await fetchImpl(api.skillDownloadUrl(skillId));assert.equal(zip.status,200);assert.equal(zip.headers.get('Content-Type'),'application/zip');assert.ok((await zip.arrayBuffer()).byteLength>1000);
  sourceRefs=[];skillRefs=[{id:skill.id,revision:skill.revision}];
  assert.equal(await assistant.improveDraft('Draft a question to help compare business options.'),true,assistant.state().error);
  assert.match(assistant.state().working.message,/available evidence/);assert.deepEqual(assistant.state().workingAssistant.skillRefs,skillRefs);
  assert.match(assistant.state().messages.at(-1).warnings.join(' '),/Skills used:/);assert.doesNotMatch(assistant.state().messages.at(-1).warnings.join(' '),/invented/);
  const writing=createWritingWorkspaceApi({workspaceId,fetchImpl}),draftId=crypto.randomUUID(),state=assistant.state();
  await writing.save(draftId,{expectedRevision:0,kind:'draft',title:'Decision question',...state.working,writingAssistant:state.workingAssistant});
  const reloaded=(await createWritingWorkspaceApi({workspaceId,fetchImpl}).list())[0];assert.equal(reloaded.message,state.working.message);assert.deepEqual(reloaded.writingAssistant.skillRefs,skillRefs);
  const foreign=await fetchImpl('/api/workspace-skills/'+skillId+'?workspace_id=storage-w2');assert.equal(foreign.status,404);
  const stale=await fetchImpl('/api/writing-assistant/reply?workspace_id='+workspaceId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instruction:'Explain this book',context:capture().context,sourceSelection:'session',sourceRefs:[selectedBook]})});assert.equal(stale.status,404);
  const receipts=DB.raw.prepare("SELECT entity_type,metadata_json FROM audit_events WHERE event_type='operations.scheduler'").all();
  for(const task of ['writing_references','workspace_skills'])assert.ok(receipts.some(r=>r.entity_type===task&&JSON.parse(r.metadata_json).outcome==='completed'),task+' ran through the registered scheduler');
  assert.ok(http.some(r=>r.path==='/writing-reference-upload'&&r.status===201));
 }finally{assistant?.destroy();await Promise.allSettled(pending);globalThis.fetch=originalFetch;DB.raw.close();}
});
