const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
const T=require('../message-translations.js');
function show(h,extra={}){h.w.LeadIntelMessageWorkspace.render(h.w.document,{ready:true,authenticated:true,hasDraft:true,savedDraft:true,senderIdentityReady:true,channel:'email',appliedStyle:'professional',selectedStyle:'professional',...extra});}
test('Messages has one footer next step; sending and legacy navigation stay outside the composer',()=>{
 const h=mounted({selected:'professional'});try{
 show(h,{approved:true,inFlow:true});
 assert.equal(h.q('mw-add-flow').closest('.mw-message-footer')?.getAttribute('aria-label'),'Next step');
 assert.equal(h.q('mw-add-flow').textContent,'Continue to Delivery →');
 assert.equal(h.q('mw-header-actions').contains(h.q('mw-add-flow')),false);
 assert.equal(h.q('mw-send-flow-actions').hidden,true);
 assert.equal(h.q('mw-send-now').hidden,true);
 assert.equal(h.q('mw-retry-message').hidden,true);
 assert.equal(h.q('mw-updating-notice').hidden,true);
 const legacy=h.w.document.createElement('div');legacy.className='delivery-entry';legacy.innerHTML='<button id="continue-to-delivery">Continue</button>';h.q('step-6').append(legacy);show(h,{approved:true});assert.equal(legacy.hidden,true);
 assert.equal(h.q('mw-header-actions').contains(h.q('mw-copy-email')),true);
 assert.equal(h.requests.some(r=>/send|enqueue/.test(r.url)),false);
 }finally{h.w.close();}
});
test('unsaved and blocked states never inherit a ready badge from earlier flow membership',()=>{
 const h=mounted();try{show(h,{inFlow:true,savedDraft:false,editorState:{editing:true}});assert.equal(h.q('mw-draft-badge').textContent,'Unsaved changes');assert.equal(h.q('mw-add-flow').disabled,false);assert.equal(h.q('mw-flow-readiness').hidden,false);show(h,{generationError:true});assert.equal(h.q('mw-retry-message').hidden,false);assert.equal(h.q('mw-updating-notice').hidden,false);}finally{h.w.close();}
});
test('language summary separates the displayed message from an untranslated selected target',()=>{
 const h=mounted();try{
 const before=JSON.stringify(h.item()),item=h.item();h.w.LeadIntelMessageTranslationUI.render(h.w.document,item,{usable:true,languageSettings:{languages:['en','lv'],defaultLanguage:'en',targetLanguage:'lv'}});
 assert.match(h.q('message-language-current').textContent,/Viewing: English/);
 assert.match(h.q('message-language-current').textContent,/Default: English/);
 assert.match(h.q('message-translation-target').textContent,/Translate to: Latvian/);
 const row=h.q('message-language-tabs').querySelector('[data-language="lv"]').closest('.mw-language-row');assert.equal(row.dataset.target,'true');assert.equal(row.dataset.active,'false');
 assert.equal(h.q('message-save-language').closest('details')?.id,'message-language-settings');
 assert.equal(h.q('mw-language-tools').open,false);assert.equal(JSON.stringify(h.item()),before);assert.equal(T.book(item).activeLanguage,'en');
 }finally{h.w.close();}
});
test('empty composer has no copy action; English original and sent message use truthful status text',()=>{
 const h=mounted();try{
 show(h,{hasDraft:false,savedDraft:false});assert.equal(h.q('mw-copy-email').hidden,true);
 h.w.LeadIntelMessageTranslationUI.render(h.w.document,h.item(),{usable:true,languageSettings:{languages:['en'],defaultLanguage:'en',targetLanguage:'en'}});assert.match(h.q('message-translation-status').textContent,/English original/);assert.doesNotMatch(h.q('message-translation-status').textContent,/Translation saved/);
 show(h,{approved:true,sentAlready:true,inFlow:true});assert.equal(h.q('mw-draft-badge').textContent,'Sent');assert.doesNotMatch(h.q('mw-flow-readiness-text').textContent,/Nothing is sent yet/);assert.equal(h.q('mw-auto-settings').hidden,true);
 }finally{h.w.close();}
});
test('an unresolved preview blocks both the footer and direct handoff handler',async()=>{
 const h=mounted();try{show(h,{editorState:{preview:{message:'Candidate'}}});assert.equal(h.q('mw-add-flow').disabled,true);}finally{h.w.close();}
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');let loads=0,focused=0;
 const ctx={globalThis:{},currentItem:()=>({channel:'email',domain:'buyer.example'}),messageEditor:{state:()=>({preview:{message:'Candidate'}})},messageFlowBusy:false,messageWorkspaceUsable:()=>true,LeadIntelMessageEditor:{savedDraft:()=>true},editorDraft:()=>({}),q:()=>({focus(){focused++;}}),crmBridge:()=>({workspace:{id:'w1'}}),loadDeliveryModules:async()=>{loads++;throw Error('Unexpected load');},toast(){},renderAll(){},renderMessageWorkspace(){}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function addCurrentMessageToFlow(){'),source.indexOf('function openFlowScheduler(')),ctx);await ctx.addCurrentMessageToFlow();assert.equal(loads,0);assert.equal(focused,1);
});
test('approved messages explain why language controls are locked and how to unlock them',()=>{
 const h=mounted();try{h.w.LeadIntelMessageTranslationUI.render(h.w.document,{...h.item(),approved:true},{usable:true,languageSettings:{languages:['en','lv'],defaultLanguage:'en',targetLanguage:'lv'}});assert.equal(h.q('message-translate').disabled,true);assert.match(h.q('message-translation-status').textContent,/approved.*Edit.*Save.*translat/i);}finally{h.w.close();}
});

test('meeting setup precedes Delivery and missing facts explain a disabled Continue',()=>{const h=mounted();try{const d=h.w.document,meeting=h.q('mw-meeting-options'),footer=d.querySelector('.mw-message-footer');assert.equal(meeting.nextElementSibling,h.q('mw-tools-drawer'));assert.equal(h.q('mw-tools-drawer').nextElementSibling,footer);assert.ok(h.q('mw-tools-drawer').contains(h.q('mw-follow-up-host')));show(h,{missingFacts:['project milestone']});assert.equal(h.q('mw-add-flow').disabled,true);assert.match(h.q('mw-flow-readiness-text').textContent,/project milestone/);assert.equal(h.q('mw-flow-resolve').hidden,false);}finally{h.w.close();}});

test('calendar, collapsed Tools and the single Continue action follow the email in order',()=>{
 const h=mounted();try{show(h);const meeting=h.q('mw-meeting-options'),tools=h.q('mw-tools-drawer'),footer=h.q('mw-add-flow').closest('.mw-message-footer');assert.match(meeting.querySelector('summary').textContent,/Meeting & calendar/);assert.equal(meeting.nextElementSibling,tools);assert.equal(tools.nextElementSibling,footer);assert.equal(tools.open,false);assert.equal(h.q('message-generate').classList.contains('primary-btn'),false);assert.equal(h.q('mw-language-tools').classList.contains('mw-field'),true);assert.equal(meeting.classList.contains('mw-field'),true);assert.equal(tools.classList.contains('mw-field'),true);}finally{h.w.close();}
});
test('a saved ready message can continue despite optional template changes without a second review button',()=>{
 const h=mounted();try{show(h,{pendingSelections:true,unpersonalizedDraft:true,selectedStyle:'friendly',appliedStyle:'professional'});assert.equal(h.q('mw-add-flow').disabled,false);assert.equal(h.q('mw-flow-resolve').hidden,true);assert.doesNotMatch(h.q('mw-flow-readiness-text').textContent,/Update message|Review message update/);show(h,{savedDraft:false,editorState:{editing:true}});assert.equal(h.q('mw-add-flow').disabled,false);assert.match(h.q('mw-flow-readiness-text').textContent,/saved|save/i);}finally{h.w.close();}
});
