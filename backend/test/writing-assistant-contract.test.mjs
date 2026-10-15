import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareAssistantRequest,validateAssistantReply} from '../src/writing-assistant.js';
import {storageFixture} from './writing-reference-fixture.mjs';
const require=createRequire(import.meta.url),Context=require('../../customer/writing-assistant-context.js'),Approved=require('../../customer/approved-reference-scripts.js'),Editor=require('../../customer/message-editor.js');
const currentDraft={subject:'Hello',message:'Hi Alice, Bob Seller invites you to a 20-minute call. https://seller.test/book LeadIntel'};
const input={workspace:'w1',item:{channel:'email',domain:'buyer.test',selectedPersonId:'alice'},person:{id:'alice',name:'Alice Buyer'},studio:{mode:'professional',essentials:{language:'en',sender:'Bob Seller',company:'Seller',proof:'https://seller.test/projects'}},facts:{firstName:'Alice'},currentDraft,refs:{workspaceId:'w1',referenceRevision:0,sourceRefs:[]},usable:true};
const prepare=context=>prepareAssistantRequest(storageFixture(),{workspaceId:'w1'},{instruction:'Rewrite this message',history:[],sourceRefs:[],context});
const reply=message=>JSON.stringify({reply:'Review this alternative.',draft:{subject:'Hello',message},citations:[],warnings:[]});
test('server and Apply share the restrictive approved-link contract across context sources',async()=>{
 const context={...Context.captureWritingContext(input).context,trigger:{url:'https://buyer.test/trigger'},buyerEvidence:{url:'https://buyer.test/evidence'},sellerEvidence:[{url:'https://seller.test/evidence'}],seller:{...input.studio.essentials,nested:{url:'https://seller.test/nested'},description:'See https://seller.test/description'}};
 const prepared=await prepare(context);assert.match(prepared.system,/top-level seller/);
 for(const url of ['https://seller.test/book','https://seller.test/projects']){const result=validateAssistantReply(reply(currentDraft.message+' '+url),prepared);assert.doesNotThrow(()=>Context.validateWritingDraft(result.draft,context));}
 for(const url of ['https://buyer.test/trigger','https://buyer.test/evidence','https://seller.test/evidence','https://seller.test/nested','https://seller.test/description','https://unknown.test']){const message=currentDraft.message+' '+url;assert.throws(()=>validateAssistantReply(reply(message),prepared),/unapproved link/i);assert.throws(()=>Context.validateWritingDraft({subject:'Hello',message},context),/unapproved link/i);}
 const priorLinkContext={...context,currentDraft:{...currentDraft,message:currentDraft.message+' https://buyer.test/evidence'}};
 const result=validateAssistantReply(reply(priorLinkContext.currentDraft.message),await prepare(priorLinkContext));assert.doesNotThrow(()=>Context.validateWritingDraft(result.draft,priorLinkContext));
});
test('all core English proposals pass the same canonical body ceiling before preview and Apply',async()=>{
 for(const style of Object.keys(Approved.records)){
  const context=Context.captureWritingContext({...input,studio:{...input.studio,mode:style}}).context,maximum=Approved.coreContract(style).maximumMessageWords;
  assert.equal(context.maximumWords,maximum);
  const message=currentDraft.message+' '+Array(maximum-currentDraft.message.split(/\s+/).length).fill('word').join(' '),prepared=await prepare(context);
  assert.match(prepared.system,/Never exceed context.maximumWords/);
  const result=validateAssistantReply(reply(message),prepared);assert.doesNotThrow(()=>Context.validateWritingDraft(result.draft,context));assert.doesNotThrow(()=>Editor.validateFrame(result.draft.message,style));
  assert.throws(()=>validateAssistantReply(reply(message+' extra'),prepared),/word limit/i);assert.throws(()=>Context.validateWritingDraft({subject:'Hello',message:message+' extra'},context),/word limit/i);
 }
});
test('English core ceiling does not constrain translations, events, LinkedIn, AI Original or personal patterns',async()=>{
 const exemptions=[{language:'de'},{item:{...input.item,messageStudioDraft:{eventSnapshot:{id:'event'}}}},{item:{...input.item,channel:'linkedin'}},{studio:{...input.studio,mode:'original'}},{studio:{...input.studio,mode:'my-template'}},{studio:{...input.studio,personalStyles:{professional:{active:true}}}},{studio:{...input.studio,templates:[{id:'professional',isPersonal:true}]}}];
 for(const variant of exemptions){const context=Context.captureWritingContext({...input,...variant}).context;assert.equal(context.maximumWords,null);const proposal=JSON.parse(reply(currentDraft.message+' '+Array(300).fill('word').join(' ')));if(context.channel==='linkedin')proposal.draft.subject='';const result=validateAssistantReply(JSON.stringify(proposal),await prepare(context));assert.doesNotThrow(()=>Context.validateWritingDraft(result.draft,context));const prompt=Editor.rewritePrompt({...input.studio,...variant.studio},{channel:context.channel,maximumWords:context.maximumWords},{source:currentDraft,attempt:1,avoid:[]});assert.equal(JSON.parse(prompt.prompt).maximumWords,null);}
});
test('optional maximumWords rejects malformed limits and permits prior clients without a limit',async()=>{
 const context=Context.captureWritingContext(input).context;for(const maximumWords of [0,-1,1.5,'185',12001,{},true])await assert.rejects(prepare({...context,maximumWords}),/Maximum message words/);
 const {maximumWords,...priorContext}=context,prepared=await prepare(priorContext);assert.doesNotThrow(()=>validateAssistantReply(reply(currentDraft.message+' '+Array(300).fill('word').join(' ')),prepared));
});
test('empty email subjects fail on the server before becoming an unusable preview',async()=>{
 const context=Context.captureWritingContext(input).context,prepared=await prepare(context);
 for(const subject of ['', '   ']){const proposal=JSON.parse(reply(currentDraft.message));proposal.draft.subject=subject;assert.throws(()=>validateAssistantReply(JSON.stringify(proposal),prepared),/require a subject/);assert.throws(()=>Context.validateWritingDraft(proposal.draft,context),/invalid subject/);}
});
test('a formatting word ceiling cannot establish a numerical business claim',async()=>{
 const context={...Context.captureWritingContext(input).context,currentDraft:{subject:'Hello',message:'Hi Alice, Bob Seller offers consulting.'}};
 const maximum=context.maximumWords,claim=`Hi Alice, Bob Seller has completed ${maximum} projects.`,prepared=await prepare(context);
 assert.throws(()=>validateAssistantReply(reply(claim),prepared),/unsupported number/i);
 const supported=await prepare({...context,seller:{...context.seller,experience:`Completed ${maximum} projects`}});
 assert.doesNotThrow(()=>validateAssistantReply(reply(claim),supported));
});
