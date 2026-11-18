const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
const MAIN='leadintel_customer_v2_state';
function fixture(){return mounted({selected:'professional',runtimeSetup:`window.renderMessagePanel=renderMessageWorkspace;window.readMessageMain=mainState;window.readMessageMeta=()=>readJson(DISCOVERY_META_KEY);window.readMessageEditor=()=>messageEditor.state();window.messageSnapshot=withMessageReadSnapshot;window.messageScenario=ensureCampaignStudio;window.saveMessageScenario=persistCampaignStudio;window.saveMessageStep=persistMainStep;`});}
test('reading a default campaign scenario does not write the main workspace',()=>{
 const h=fixture();try{const main=h.w.readMessageMain();delete main.campaignStudio;h.w.localStorage.setItem(MAIN,JSON.stringify(main));const before=h.w.localStorage.getItem(MAIN);assert.ok(h.w.messageScenario().coreScenario);assert.equal(h.w.localStorage.getItem(MAIN),before,'opening Messages must not save a generated scenario or flush other presentation defaults');}finally{h.w.close();}
});
test('explicit campaign and route writes preserve fields mutated only in a shared presentation snapshot',()=>{
 for(const action of ['campaign','route']){const h=fixture();try{const before=JSON.parse(h.w.localStorage.getItem(MAIN)),scenario={schemaVersion:1,coreScenario:{summary:'Explicitly saved scenario'},presets:[],selectedPresetId:''};h.w.document.querySelector('[data-step-marker="6"]')?.remove();h.w.messageSnapshot(()=>{const presentation=h.w.readMessageMain();presentation.profile.companyName='Presentation-only value';presentation.market={strategyApproved:false};presentation.answers={buyer_roles:'Unpersisted role'};if(action==='campaign')h.w.saveMessageScenario(scenario,{sync:false});else h.w.saveMessageStep(6);});const saved=JSON.parse(h.w.localStorage.getItem(MAIN));assert.deepEqual(saved,{...before,...(action==='campaign'?{campaignStudio:scenario}:{step:6})},'only the explicitly owned field is persisted');}finally{h.w.close();}}
});
test('one message-panel refresh parses the unchanged workspace once and preserves saved text',()=>{
 const h=fixture(),raw=h.w.localStorage.getItem(MAIN),before=h.item().drafts,parse=h.w.JSON.parse;let reads=0;
 try{h.w.JSON.parse=function(value,...args){if(value===raw)reads++;return parse.call(this,value,...args);};h.w.renderMessagePanel();assert.ok(reads<=2,`one refresh parsed the same full workspace ${reads} times`);assert.deepEqual(h.item().drafts,before);assert.equal(h.w.localStorage.getItem(MAIN),raw);}finally{h.w.JSON.parse=parse;h.w.close();}
});
test('message presentation reads observe a storage change made during the same refresh',()=>{
 const h=fixture(),api=h.w.LeadIntelMessageWorkspace;let observed;
 try{h.w.LeadIntelMessageWorkspace={...api,render:function(...args){const main=h.w.readMessageMain();main.brandIdentity={...main.brandIdentity,senderName:'Updated Sender'};h.w.localStorage.setItem(MAIN,JSON.stringify(main));observed=h.w.readMessageMain().brandIdentity.senderName;return api.render.apply(this,args);}};h.w.renderMessagePanel();assert.equal(observed,'Updated Sender');assert.equal(h.w.readMessageMain().brandIdentity.senderName,'Updated Sender');}finally{h.w.LeadIntelMessageWorkspace=api;h.w.close();}
});
test('reads outside a message refresh remain detached and a failed refresh cannot retain a snapshot',()=>{
 const h=fixture(),api=h.w.LeadIntelMessageWorkspace;
 try{const first=h.w.readMessageMain();first.brandIdentity={senderName:'Unsaved mutation'};assert.notEqual(h.w.readMessageMain().brandIdentity?.senderName,'Unsaved mutation');h.w.LeadIntelMessageWorkspace={...api,render:()=>{throw Error('Controlled rendering failure');}};assert.throws(()=>h.w.renderMessagePanel(),/Controlled rendering failure/);const after=h.w.readMessageMain();after.brandIdentity={senderName:'Another unsaved mutation'};assert.notEqual(h.w.readMessageMain().brandIdentity?.senderName,'Another unsaved mutation');}finally{h.w.LeadIntelMessageWorkspace=api;h.w.close();}
});
test('a panel refresh bounds repeated full editor-scope calculations',()=>{
 const h=fixture(),api=h.w.LeadIntelMessageEditor;let calculations=0;
 try{h.w.LeadIntelMessageEditor={...api,scope:(...args)=>{calculations++;return api.scope(...args);}};h.w.renderMessagePanel();assert.ok(calculations<=10,`one refresh recalculated the full editor scope ${calculations} times`);}finally{h.w.LeadIntelMessageEditor=api;h.w.close();}
});
test('a source change during presentation invalidates the editor scope before the next state check',()=>{
 const h=fixture(),api=h.w.LeadIntelMessageWorkspace,editor=h.w.LeadIntelMessageEditor,observed=[];
 try{h.w.LeadIntelMessageEditor={...editor,scope:(...args)=>{observed.push(args[3]?.sellerAnswers?.changedSource);return editor.scope(...args);}};h.w.LeadIntelMessageWorkspace={...api,render:function(...args){const main=h.w.readMessageMain();main.answers={...main.answers,changedSource:'New verified source'};h.w.localStorage.setItem(MAIN,JSON.stringify(main));h.w.readMessageEditor();return api.render.apply(this,args);}};h.w.renderMessagePanel();assert.ok(observed.includes('New verified source'),'the next controller check uses the changed source');}finally{h.w.LeadIntelMessageEditor=editor;h.w.LeadIntelMessageWorkspace=api;h.w.close();}
});
test('background refresh retains the writing-style button and keyboard focus',()=>{
 const h=fixture();try{const before=h.w.document.querySelector('[data-writing-style="curiosity"]');before.focus();h.w.renderMessagePanel();assert.equal(h.w.document.querySelector('[data-writing-style="curiosity"]'),before,'refresh must not replace the button under a pointer or keyboard focus');assert.equal(h.w.document.activeElement,before);}finally{h.w.close();}
});
