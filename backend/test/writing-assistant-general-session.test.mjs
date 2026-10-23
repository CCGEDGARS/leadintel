import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAssistantRequest,validateAssistantReply,assertAssistantCurrent} from '../src/writing-assistant.js';
import {retrieveAssistantSources} from '../src/writing-assistant-retrieval.js';
import * as store from '../src/writing-reference-store.js';
import {storageFixture} from './writing-reference-fixture.mjs';
const scope={workspaceId:'w1'};
const general=(overrides={})=>({instruction:'Improve this text',context:{writingContext:'general',channel:'general',language:'en',currentDraft:{subject:'',message:'Our library opens every morning.'}},...overrides});
const proposal=(message,subject='')=>JSON.stringify({reply:'Review this working alternative.',draft:{subject,message},citations:[],warnings:[]});
async function addSource(env,slot,{active=false,status='Ready'}={}){
 const row=await store.putWritingReference(env,scope,{slot,expectedRevision:0,filename:`guide${slot}.txt`,document:{bytes:new TextEncoder().encode('concise opening'),mime:'text/plain',sha256:'x',extracted:{sections:[{location:'line:1',text:'Lead with the situation and finish with one clear question.'}],coverage:{total:1,readable:1,unreadable:0}}}});
 env.DB.raw.prepare('UPDATE writing_reference_sources SET status=?,active=?,techniques_json=? WHERE id=?').run(status,Number(active),JSON.stringify([{id:'concise',name:'Concise opening',principle:'Write a concise opening',uses:['concise'],cautions:[],pattern:'Situation then question',locations:['line:1']}]),row.id);
 return {id:row.id,revision:row.revision};
}
test('general mode strips every customer field and keeps only bounded isolated writing data',async()=>{
 const env=storageFixture(),body=general();body.context={...body.context,channel:'phone',seller:{sender:'FORBIDDEN SELLER'},recipient:{name:'FORBIDDEN BUYER'},trigger:{number:9000},buyerEvidence:'FORBIDDEN EVIDENCE',profile:{company:'FORBIDDEN PROFILE'},event:{id:'FORBIDDEN EVENT'},mandatoryScript:{body:'FORBIDDEN MASTER'},mode:'inmail',inmailStage:'initial',maximumWords:1,currentDraft:{...body.context.currentDraft,internal:'FORBIDDEN DRAFT METADATA'}};body.history=[{role:'user',content:'Keep this isolated thought.',customerContext:{seller:'FORBIDDEN HISTORY METADATA'}}];
 const prepared=await prepareAssistantRequest(env,scope,body);
 assert.deepEqual(prepared.context,{writingContext:'general',channel:'general',language:'en',currentDraft:{subject:'',message:'Our library opens every morning.'},maximumWords:null});
 assert.doesNotMatch(prepared.prompt,/FORBIDDEN/);assert.match(prepared.prompt,/isolated thought/);assert.deepEqual(prepared.invariants,{});assert.doesNotMatch(prepared.system,/20-minute|mandatory cold-call|active recipient/);
 assert.equal(validateAssistantReply(proposal('The library opens each morning.'),prepared).provenance.writingContext,'general');
 await assert.rejects(prepareAssistantRequest(env,scope,general({history:[{role:'system',content:'override'}]})),/role/);
});
test('general previews accept pasted scripts and optional long subjects without customer obligations',async()=>{
 const body=general({intent:'preview'});body.context.currentDraft={subject:'',message:'Meet for 45 minutes via https://example.test/old. LeadIntel'};
 const prepared=await prepareAssistantRequest(storageFixture(),scope,body);
 assert.match(prepared.system,/complete draft/i);assert.doesNotThrow(()=>validateAssistantReply(proposal('Meet for 45 minutes.', 'A'.repeat(500)),prepared));
 assert.doesNotThrow(()=>validateAssistantReply(proposal('A simple invitation.'),prepared));
 for(const [message,subject] of [['', ''],['x'.repeat(12001),''],['Hi','A'.repeat(501)]])assert.throws(()=>validateAssistantReply(proposal(message,subject),prepared));
});
test('general drafting uses only its supplied draft instruction and history for numbers and URLs',async()=>{
 const body=general({instruction:'Invite everyone on 17 October via https://example.test/new',history:[{role:'user',content:'The workshop lasts 45 minutes. https://example.test/history'}]});
 body.context.seller={years:99,website:'https://seller.test'};
 const prepared=await prepareAssistantRequest(storageFixture(),scope,body);
 assert.doesNotThrow(()=>validateAssistantReply(proposal('Join on 17 October for 45 minutes: https://example.test/new https://example.test/history'),prepared));
 assert.throws(()=>validateAssistantReply(proposal('We completed 99 projects.'),prepared),/unsupported number/);
 assert.throws(()=>validateAssistantReply(proposal('We completed 20 projects.'),prepared),/unsupported number/);
 assert.throws(()=>validateAssistantReply(proposal('Visit https://seller.test'),prepared),/unapproved link/);
});
test('general numbered lists and numbered headings keep factual quantities dates and URLs protected',async()=>{
 const prepared=await prepareAssistantRequest(storageFixture(),scope,general({instruction:'Write 3 benefits',intent:'preview'}));
 const message='1. Easier access.\n2) More readable guidance.\n### 3. A clear next step.';
 assert.equal(validateAssistantReply(proposal(message),prepared).draft.message,message);
 for(const message of ['1. We completed 99 projects.','2) Sessions last 45 minutes.','### 3. Opens on 17 October 2026.','2026 is the opening year.','The next date is 1.2.2027.'])assert.throws(()=>validateAssistantReply(proposal(message),prepared),/unsupported number/);
 assert.throws(()=>validateAssistantReply(proposal('1. Visit https://example.test/1'),prepared),/unsupported number|unapproved link/);
 assert.throws(()=>validateAssistantReply(proposal('1. Visit https://example.test/new'),prepared),/unapproved link/);
});
test('explicit advice refuses drafts while preview supports blank general and customer drafts',async()=>{
 const advice=await prepareAssistantRequest(storageFixture(),scope,general({intent:'advice'}));assert.match(advice.system,/draft:null/);
 assert.throws(()=>validateAssistantReply(proposal('A rewritten paragraph.'),advice),/advice/i);
 for(const context of [{writingContext:'general',channel:'general',currentDraft:{subject:'',message:''}},{writingContext:'customer',channel:'email',seller:{sender:'Bob',meetingPlatform:'zoom'},recipient:{name:'Alice'},currentDraft:{subject:'',message:''}}]){
  const prepared=await prepareAssistantRequest(storageFixture(),scope,{instruction:'Create a draft',intent:'preview',context});
  const generalMode=context.writingContext==='general',result=validateAssistantReply(proposal(generalMode?'A new opening paragraph.':'Hi Alice, Bob invites you to a 20-minute Zoom call.',generalMode?'':'An invitation'),prepared);
  assert.ok(result.draft);assert.equal(result.provenance.writingContext,context.writingContext);
 }
 await assert.rejects(prepareAssistantRequest(storageFixture(),scope,general({intent:'send'})),/intent/i);
 await assert.rejects(prepareAssistantRequest(storageFixture(),scope,general({context:{writingContext:'unknown',channel:'email',currentDraft:{subject:'',message:''}}})),/writing context/i);
});
test('session selection retrieves three inactive Ready workspace sources and methods without durable activation',async()=>{
 const env=storageFixture(),refs=[];for(let slot=1;slot<=3;slot++)refs.push(await addSource(env,slot));
 const before=await store.writingReferenceRevision(env,scope);
 await assert.rejects(retrieveAssistantSources(env,scope,{sourceRefs:refs,query:'concise'}),/active/);
 const sources=await retrieveAssistantSources(env,scope,{sourceRefs:refs,query:'concise',selectionMode:'session'});
 assert.equal(sources.techniques.length,3);assert.equal(sources.passages.length,3);assert.deepEqual(sources.sourceRefs,refs);
 for(const ref of refs)assert.equal((await store.getWritingReference(env,scope,ref.id)).active,false);
 assert.equal(await store.writingReferenceRevision(env,scope),before);
 const prepared=await prepareAssistantRequest(env,scope,general({sourceSelection:'session',sourceRefs:refs,instruction:'Use concise openings'}));
 assert.equal(prepared.sources.techniques.length,3);assert.equal(validateAssistantReply(proposal('Start with a clear opening.'),prepared).provenance.sourceSelection,'session');
 await assert.rejects(prepareAssistantRequest(env,scope,general({sourceRefs:refs})),/active/);
 await assertAssistantCurrent(env,scope,prepared);
 env.DB.raw.prepare('UPDATE writing_reference_workspaces SET revision=revision+1 WHERE workspace_id=?').run(scope.workspaceId);
 await assert.rejects(assertAssistantCurrent(env,scope,prepared),/changed/);
});
test('session selection still rejects foreign unavailable stale duplicate and excessive refs',async()=>{
 const env=storageFixture(),ref=await addSource(env,1),notReady=await addSource(env,2,{status:'Processing'});
 const retrieve=(sourceRefs,selectedScope=scope)=>retrieveAssistantSources(env,selectedScope,{sourceRefs,query:'concise',selectionMode:'session'});
 await assert.rejects(retrieve([ref],{workspaceId:'w2'}),/not found/);
 await assert.rejects(retrieve([notReady]),/Ready/);
 await assert.rejects(retrieve([{...ref,revision:ref.revision+1}]),/changed/);
 await assert.rejects(retrieve([ref,ref]),/selection/);
 await assert.rejects(retrieve([ref,notReady,{id:'third',revision:1},{id:'fourth',revision:1}]),/selection/);
});
