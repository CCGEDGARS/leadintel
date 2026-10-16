import test from 'node:test';import assert from 'node:assert/strict';
import {storageFixture} from './writing-reference-fixture.mjs';
import * as store from '../src/writing-reference-store.js';
import {prepareAssistantRequest,validateAssistantReply,assertAssistantCurrent} from '../src/writing-assistant.js';
const scope={workspaceId:'w1'},context={channel:'email',style:'friendly',recipient:{name:'Alice'},seller:{sender:'Bob'},currentDraft:{subject:'Hello',message:'Hi Alice, Bob here. Could we discuss your requirements?'}};
test('book activation supplies a grounded method; off and deletion remove it and invalidate earlier proposals',async()=>{
 const env=storageFixture(),text='Start with the recipient’s situation, then ask one clear question.';
 let row=await store.putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'writing-guide.txt',document:{bytes:new TextEncoder().encode(text),mime:'text/plain',sha256:'x',extracted:{sections:[{location:'page:1',text}],coverage:{total:1,readable:1,unreadable:0}}}});
 env.DB.raw.prepare("UPDATE writing_reference_sources SET status='Ready',techniques_json=? WHERE id=?").run(JSON.stringify([{id:'method',name:'Concise opening',principle:'Use the reader-first method',uses:['concise'],cautions:['Do not invent buyer needs'],pattern:'Situation then question',locations:['page:1']}]),row.id);
 const request=refs=>prepareAssistantRequest(env,scope,{instruction:'Make the draft concise',context,sourceRefs:refs});
 const before=await request([]);assert.doesNotMatch(before.prompt,/reader-first method/);
 row=await store.patchWritingReference(env,scope,{id:row.id,expectedRevision:row.revision,active:true});
 const prepared=await request([{id:row.id,revision:row.revision}]);assert.match(prepared.prompt,/reader-first method/);assert.equal(prepared.sources.passages[0].location,'page:1');
 // A provider fixture checks the response contract; this does not claim a live model test.
 const result=validateAssistantReply(JSON.stringify({reply:'I used the reader-first method and reduced the ask to one question.',draft:{subject:'Your requirements',message:'Hi Alice, could we discuss your requirements? Bob'},citations:[{passageId:prepared.sources.passages[0].id}],warnings:[]}),prepared);
 assert.notEqual(result.draft.message,context.currentDraft.message);assert.equal(result.citations[0].filename,'writing-guide.txt');
 row=await store.patchWritingReference(env,scope,{id:row.id,expectedRevision:row.revision,active:false});await assert.rejects(assertAssistantCurrent(env,scope,prepared),/changed/);
 assert.doesNotMatch((await request([])).prompt,/reader-first method/);
 await store.deleteWritingReference(env,scope,{id:row.id,expectedRevision:row.revision});assert.deepEqual(await store.listWritingReferences(env,scope),[]);assert.equal(env.objects.size,0);
 await assert.rejects(request([{id:row.id,revision:row.revision}]),/not found/);assert.doesNotMatch((await request([])).prompt,/reader-first method/);
});
