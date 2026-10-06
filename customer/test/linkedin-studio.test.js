const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../message-studio.js'),O=require('../outreach-engine.js'),Sync=require('../workspace-sync.js');
const e={sender:'Alex',company:'PracticeCo',offer:'contract review',target:'legal teams',problem:'slow reviews',value:'simpler reviews',meetingValue:'review requirements',calendly:'https://calendly.com/alex/30min'};
test('a full LinkedIn library selects a valid slot for replacement review',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');let studio=M.normalize({},e);for(let i=1;i<=3;i++)studio=M.saveLinkedInTemplate(studio,'linkedin-template-'+i,{name:'DM '+i,body:'Pattern '+i});const controls={};const q=id=>controls[id]||(controls[id]={style:{}});const ctx={q,readStudio:()=>studio,currentItem:()=>({channel:'linkedin'}),personalChannel:'linkedin',personalSourceStyle:'',closePersonalReview(){},renderPersonalSaveButton(){},esc:String,personalLibrary:()=>require('../personal-template-library.js').LinkedIn,personalSlots:()=>studio.linkedinTemplates};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function openPersonalReview('),source.indexOf('\n',source.indexOf('function openPersonalReview('))),ctx);ctx.openPersonalReview('','New pattern');assert.equal(q('message-personal-slot').value,'linkedin-template-1');
});
test('three body-only LinkedIn slots remain separate from five email slots through save, replace, delete and reload',()=>{
 let s=M.saveMyTemplate(M.normalize({},e),'template-1',{name:'Email',subject:'Hello',body:'Email body'});
 for(let i=1;i<=3;i++)s=M.saveLinkedInTemplate(s,'linkedin-template-'+i,{name:'DM '+i,body:'Hi {{firstName}}, {{offer}} '+i});
 assert.throws(()=>M.saveLinkedInTemplate(s,'linkedin-template-4',{body:'Extra'}));
 assert.throws(()=>M.saveLinkedInTemplate(s,'linkedin-template-1',{body:'Overwrite'}));
 s=M.saveLinkedInTemplate(s,'linkedin-template-1',{name:'Renamed',body:'Updated {{offer}}'},true);
 s=M.deleteLinkedInTemplate(s,'linkedin-template-2');s=M.normalize(JSON.parse(JSON.stringify(M.storageState(s))));
 assert.equal(s.myTemplates['template-1'].body,'Email body');assert.equal(s.linkedinTemplates['linkedin-template-1'].name,'Renamed');assert.equal(s.linkedinTemplates['linkedin-template-2'].deleted,true);
 s=M.undoDeleteLinkedInTemplate(s,'linkedin-template-2');assert.equal(s.linkedinTemplates['linkedin-template-2'].deleted,false);
});
test('LinkedIn prompt and parser require no email subject and use only LinkedIn patterns',()=>{
 let s=M.saveLinkedInTemplate(M.normalize({mode:'professional'},e),'linkedin-template-1',{body:'Hi {{firstName}}, {{offer}}'});s.linkedinMode='linkedin-template-1';
 const p=M.prompt(s,{channel:'linkedin',buyerName:'Sam',buyerCompany:'BuyerCo'}),payload=JSON.parse(p.prompt);
 assert.equal(payload.mode,'linkedin-template-1');assert.equal(payload.template.body,'Hi {{firstName}}, {{offer}}');assert.deepEqual(payload.responseSchema,{message:'draft'});
 const parsed=M.parse(JSON.stringify({message:'Hi Sam, 30-minute Zoom? '+e.calendly}),e,{studio:s,context:{channel:'linkedin'}});
 assert.equal(parsed.subject,'');assert.equal(parsed.subjectOptions,undefined);
 assert.throws(()=>M.parse(JSON.stringify({message:'x'.repeat(1201)+' 30-minute Zoom '+e.calendly}),e,{studio:s,context:{channel:'linkedin'}}),/long/i);
 const original=JSON.parse(M.prompt(M.normalize({mode:'professional'},e),{channel:'linkedin'}).prompt);assert.equal(original.mode,'original');assert.equal(original.template,null);
});
test('buyer draft cache preserves separate buyers and email/LinkedIn versions on normalization and CRM snapshots',()=>{
 const a={domain:'buyer.example',selectedPersonId:'p1',channel:'linkedin',drafts:{linkedinMessage:'My edited DM'},dossier:{company:'Buyer',domain:'buyer.example',people:[{id:'p1',name:'Sam'}]}};
 let state=O.rememberBuyerDraft({items:[]},a);state=O.rememberBuyerDraft(state,{...a,selectedPersonId:'p2',drafts:{linkedinMessage:'Other buyer'}});state=O.rememberBuyerDraft(state,{...a,channel:'email',drafts:{emailBody:'Email version'}});
 state=O.normalizeOutreachState(JSON.parse(JSON.stringify(state)));
 assert.equal(O.savedBuyerDraft(state,a.domain,'p1','linkedin').drafts.linkedinMessage,'My edited DM');
 assert.equal(O.savedBuyerDraft(state,a.domain,'p2','linkedin').drafts.linkedinMessage,'Other buyer');assert.equal(O.savedBuyerDraft(state,a.domain,'p1','email').drafts.emailBody,'Email version');
 assert.equal(O.savedBuyerDraft(state,a.domain,'p3','linkedin'),null);
 const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot({...a,linkedinSentAt:'2026-10-06T12:00:00Z'}),a.domain);assert.equal(restored.linkedinSentAt,'2026-10-06T12:00:00Z');
});
test('competing edits to one LinkedIn slot conflict atomically while independent slots merge',()=>{
 const b={outreach:{messageStudio:{linkedinTemplates:{'linkedin-template-1':{name:'Old',body:'Old'}}}}},l=structuredClone(b),r=structuredClone(b);
 l.outreach.messageStudio.linkedinTemplates['linkedin-template-1'].name='Local';r.outreach.messageStudio.linkedinTemplates['linkedin-template-1'].body='Remote';
 const result=Sync.merge(b,l,r);assert.equal(result.safe,false);assert.deepEqual(result.payload.outreach.messageStudio.linkedinTemplates['linkedin-template-1'],{name:'Local',body:'Old'});
});

test('CRM recovery finds the exact buyer/channel beyond unrelated recent activities',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
 const snapshot=(id,channel)=>O.buildCrmScriptSnapshot({domain:'buyer.example',selectedPersonId:id,channel,drafts:channel==='linkedin'?{linkedinMessage:'Saved '+id}:{emailBody:'Email'}});
 let calls=0;const ctx={LeadIntelOutreach:O,crmBridge:()=>({workspace:{id:'w1'},getCrmActivities:async()=>{calls++;return {ok:true,activities:[{metadata:{script_package:snapshot('p1','email')}},{metadata:{script_package:snapshot('p2','linkedin')}}],next_cursor:null};}})};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function savedLinkedInCrmDraft('),source.indexOf('async function openBuyerScripts(')),ctx);
 const result=await ctx.savedLinkedInCrmDraft({company:{id:'c1'},activities:[{metadata:{script_package:snapshot('p1','linkedin')}}],activity_next_cursor:'page2'},'buyer.example','p2','w1');assert.equal(result.selectedPersonId,'p2');assert.equal(result.drafts.linkedinMessage,'Saved p2');assert.equal(calls,1);
});

test('manual send recording requires explicit acknowledgment and preserves exact buyer snapshot',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');let item={domain:'buyer.example',selectedPersonId:'p1',channel:'linkedin',drafts:{linkedinMessage:'Edited message'},messageStudioDraft:{generatedAt:'2026-10-06T12:01:00Z'}};let payload,records=0;const controls={'linkedin-sent-confirm':{checked:false},'linkedin-record-sent':{},'linkedin-manual-status':{}};
 const ctx={LeadIntelOutreach:O,readDraftEdits:()=>item,selectedCandidate:()=>({domain:item.domain}),crmBridge:()=>({workspace:{id:'w1'}}),crmAuthenticated:()=>true,q:id=>controls[id],crmActivityId:(kind,domain,stamp)=>kind+'-'+stamp,syncCrmActivity:async(_,args)=>{records++;payload=args;return {ok:true};},outreach:{selectedDomain:item.domain},currentItem:()=>item,upsertItem:next=>{item=next;},updatePipelineStage(){},renderAll(){},toast(){}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function recordLinkedInSent('),source.indexOf('async function copyField(')),ctx);
 await ctx.recordLinkedInSent();assert.equal(records,0);controls['linkedin-sent-confirm'].checked=true;await ctx.recordLinkedInSent();assert.equal(records,1);assert.equal(payload.activity.type,'contact.linkedin_message_sent');assert.equal(payload.activity.channel,'linkedin');assert.equal(payload.activity.metadata.manual,true);assert.equal(payload.activity.metadata.script_package.item.drafts.linkedinMessage,'Edited message');assert.equal(payload.stage,'Contacted');assert.ok(item.linkedinSentAt);await ctx.recordLinkedInSent();assert.equal(records,1);
});

test('a delayed manual CRM acknowledgment cannot overwrite a newer edit',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');let item={domain:'buyer.example',selectedPersonId:'p1',channel:'linkedin',drafts:{linkedinMessage:'Sent version'}};
 const controls={'linkedin-sent-confirm':{checked:true},'linkedin-record-sent':{},'linkedin-manual-status':{}};const ctx={LeadIntelOutreach:O,readDraftEdits:()=>item,selectedCandidate:()=>({domain:item.domain}),crmBridge:()=>({workspace:{id:'w1'}}),crmAuthenticated:()=>true,q:id=>controls[id],crmActivityId:()=> 'manual-event',syncCrmActivity:async()=>{item={...item,drafts:{linkedinMessage:'New unsent edit'}};return {ok:true};},outreach:{selectedDomain:item.domain},currentItem:()=>item,upsertItem:next=>{item=next;},updatePipelineStage(){},renderAll(){},toast(){}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function recordLinkedInSent('),source.indexOf('async function copyField(')),ctx);await ctx.recordLinkedInSent();assert.equal(item.drafts.linkedinMessage,'New unsent edit');assert.equal(item.linkedinSentAt,'');
});

test('typing the first LinkedIn draft enables save, improve and manual acknowledgment controls',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');const controls=new Map();let callback;const item={domain:'buyer.example',selectedPersonId:'p1',channel:'linkedin',dossier:{},drafts:{linkedinMessage:'First manual draft'}};const studio=M.normalize({},e);
 const q=id=>{if(!controls.has(id))controls.set(id,{value:'',style:{},disabled:true,closest:()=>({style:{}}),addEventListener:(_,f)=>{if(id==='outreach-linkedin')callback=f;}});return controls.get(id);};
 const ctx={q,LeadIntelMessageStudio:M,LeadIntelOutreach:O,studioState:()=>studio,currentItem:()=>item,selectedCandidate:()=>({domain:item.domain,company:'Buyer'}),selectedContact:()=>({name:'Sam'}),handoffContact:{domain:item.domain,personId:'p1',channel:'linkedin',contact:{}},mainState:()=>({}),esc:v=>String(v),scriptGenerationRequest:0,readDraftEdits:()=>item,upsertItem(){},window:{LeadIntelDiscovery:require('../discovery-engine.js')},document:{querySelectorAll:()=>[]},personalChannel:'linkedin'};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function personalSlots('),source.indexOf('function renderPersonalSaveButton(')),ctx);vm.runInContext(source.slice(source.indexOf('function renderMessageStudio('),source.indexOf('function prepareStudioBuyer(')),ctx);const start=source.indexOf("for(const id of ['outreach-email-subject','outreach-email-body','outreach-linkedin'])q(id).addEventListener");vm.runInContext(source.slice(start,source.indexOf('\n}',start)),ctx);callback();assert.equal(q('message-save-as-template').disabled,false);assert.equal(q('message-improve').disabled,false);assert.equal(q('linkedin-sent-confirm').disabled,false);assert.equal(q('linkedin-record-sent').disabled,true);
});
