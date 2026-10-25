import test from 'node:test';
import assert from 'node:assert/strict';
import {storageFixture} from './writing-reference-fixture.mjs';
import {prepareAssistantRequest,validateAssistantReply} from '../src/writing-assistant.js';
const request={instruction:'Explain why this opening works.',intent:'auto',history:[],sourceSelection:'session',sourceRefs:[],context:{writingContext:'general',channel:'general',currentDraft:{subject:'',message:'Our original words.'}}};
test('unified requests permit advice or a complete draft without injecting a default length',async()=>{
 const p=await prepareAssistantRequest(storageFixture(),{workspaceId:'w1'},request);assert.equal(p.intent,'auto');assert.equal(JSON.parse(p.prompt).draftPreferences,undefined);assert.match(p.system,/questions.*advice|advice.*questions/i);
 const advice=validateAssistantReply(JSON.stringify({reply:'The opening is clear.',draft:null,citations:[],warnings:[]}),p);assert.equal(advice.draft,null);
 const edit=validateAssistantReply(JSON.stringify({reply:'A clearer alternative.',draft:{subject:'',message:'A clearer opening.'},citations:[],warnings:[]}),p);assert.equal(edit.draft.message,'A clearer opening.');
});
test('unified request preserves the full instruction and validates unsafe generated content',async()=>{
 const p=await prepareAssistantRequest(storageFixture(),{workspaceId:'w1'},{...request,instruction:'x'.repeat(4000)});assert.equal(p.instruction.length,4000);
 assert.throws(()=>validateAssistantReply(JSON.stringify({reply:'Draft',draft:{subject:'',message:'Guaranteed 900 percent growth.'},citations:[],warnings:[]}),p),/unsupported number/i);
});
