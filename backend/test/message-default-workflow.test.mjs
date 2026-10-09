import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Engine from '../src/approved-workflow-engine.js';
import {workflowMain} from '../src/approved-workflow-store.js';
import '../../customer/state-budget.js';
const studio={version:10,essentials:{sender:'Marta Kalna',company:'North Advisory',offer:'business consulting',calendly:'https://calendly.com/north/20',meetingPlatform:'zoom'},myTemplates:{'template-1':{id:'template-1',name:'Short invitation',subject:'For {{buyerCompany}}',body:'Hi {{firstName}},\n\nI’m {{sender}} from {{company}}. We provide {{offer}}.\n\nWould you be open to a 20-minute Zoom conversation? {{calendly}}'}},defaultTemplates:{email:{id:'template-1',name:'Short invitation',subject:'For {{buyerCompany}}',body:'Hi {{firstName}},\n\nI’m {{sender}} from {{company}}. We provide {{offer}}.\n\nWould you be open to a 20-minute Zoom conversation? {{calendly}}',savedAt:'2026-10-09'}}};
test('workflow reads the synced default from the decoded workspace, not only the main section',async()=>{
 const payload=globalThis.LeadIntelStateBudget.prepareForSync({main:{profile:{companyName:'North Advisory'}},outreach:{messageStudio:studio}}).payload;
 const env={DB:{prepare:()=>({bind:()=>({first:async()=>({payload_json:JSON.stringify(payload)})})})}};
 const main=await workflowMain(env,'workspace');assert.deepEqual(main.messageStudio,studio);
 const ctx=Engine.approvedContext(main);assert.equal(ctx.outreachDefault.name,'Short invitation');
});
test('each automatic message uses the pinned default and its own current contact, without another recipient or seller',()=>{
 assert.equal(typeof Engine.renderDefaultWorkflowMessage,'function');const context=Engine.approvedContext({messageStudio:studio,profile:{companyName:'North Advisory'},website:'https://north.example'});
 for(const [company,name] of [['Buyer A','Alex One'],['Buyer B','Taylor Two']]){
  const message=Engine.renderDefaultWorkflowMessage(context,{company,domain:company==='Buyer A'?'a.example':'b.example',contact:{name,title:'CEO'},evidence:[]});
  assert.equal(message.subject,'For '+company);assert.match(message.body,new RegExp('Hi '+name.split(' ')[0]));assert.match(message.body,/Marta Kalna/);assert.doesNotMatch(message.body,/Joakim|LKAB|ERCON/);assert.ok(!message.body.includes('{{'));
 }
});
test('changing default invalidates workflow consent and unknown variables never pass to delivery',async()=>{
 const first=Engine.approvedContext({messageStudio:studio}),changed=structuredClone(studio);changed.defaultTemplates.email.body='Changed';
 assert.notEqual(await Engine.fingerprint(first),await Engine.fingerprint(Engine.approvedContext({messageStudio:changed})));
 const unsafe=structuredClone(studio);unsafe.defaultTemplates.email.body='Hello {{secret}}';assert.throws(()=>Engine.renderDefaultWorkflowMessage(Engine.approvedContext({messageStudio:unsafe}),{company:'Buyer',contact:{name:'Alex One'},evidence:[]}),/field|variable|placeholder/i);
});

test('missing values and event fields stop automatic personalization for review',()=>{
 for(const field of ['buyerRole','senderLinkedInUrl','development','subjectProject']){const changed=structuredClone(studio);changed.defaultTemplates.email.body='Hello {{firstName}}, {{'+field+'}}';const ctx=Engine.approvedContext({messageStudio:changed});assert.throws(()=>Engine.renderDefaultWorkflowMessage(ctx,{company:'Buyer',contact:{name:'Alex One'},evidence:[]}),/requires|Missing|Complete/);}
});
