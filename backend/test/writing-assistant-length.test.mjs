import test from 'node:test';
import assert from 'node:assert/strict';
import {storageFixture} from './writing-reference-fixture.mjs';
import {prepareAssistantRequest} from '../src/writing-assistant.js';
const base={instruction:'x'.repeat(4000),intent:'preview',preferredLength:'short',history:[],sourceRefs:[],context:{writingContext:'general',channel:'general',currentDraft:{subject:'',message:''}}};
test('draft length reaches the model separately from the full 4000-character instruction',async()=>{
 const prepared=await prepareAssistantRequest(storageFixture(),{workspaceId:'w1'},base),prompt=JSON.parse(prepared.prompt);
 assert.equal(prepared.instruction,base.instruction);assert.equal(prompt.instruction.length,4000);
 assert.deepEqual(prompt.draftPreferences,{length:'short',minimumWords:80,maximumWords:120});assert.match(prepared.system,/draftPreferences/);
});
test('email ranges never affect advice, phone or LinkedIn and unsupported preferences fail closed',async()=>{
 for(const body of [{...base,intent:'advice'},...['phone','linkedin'].map(channel=>({...base,context:{...base.context,writingContext:'customer',channel,style:'original'}}))]){
  const prepared=await prepareAssistantRequest(storageFixture(),{workspaceId:'w1'},body);assert.equal(JSON.parse(prepared.prompt).draftPreferences,undefined);
 }
 for(const value of ['giant',null,{},50])await assert.rejects(prepareAssistantRequest(storageFixture(),{workspaceId:'w1'},{...base,preferredLength:value}),/length preference/i);
});
