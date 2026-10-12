const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const M=require('../event-campaigns.js');
const campaign={id:'forum',name:'Industry Forum',website:'https://forum.test',startDate:'2099-10-10',endDate:'2099-10-12',location:'Berlin',stand:'B12',visitValue:'Discuss your installation plans.',roles:'Engineering Director'};
const essentials={sender:'Alex Smith',company:'Example Tools'};
const evidence={status:'confirmed',campaignId:'forum',personId:'p1',sourceUrl:'https://forum.test/speakers',excerpt:'Robin Smith is speaking at Industry Forum 2099.',eventStartDate:'2099-10-10',checkedAt:'2026-10-12',reviewed:true};
test('confirmed person attendance requires edition, source, excerpt and matching identity; company evidence never confirms a person',()=>{
 assert.equal(typeof M.attendance,'function');
 assert.equal(M.attendance(campaign,{id:'p1',name:'Robin Smith'},evidence).status,'confirmed');
 for(const patch of [{sourceUrl:''},{excerpt:''},{eventStartDate:'2098-10-10'},{personId:'other'},{reviewed:false}])assert.equal(M.attendance(campaign,{id:'p1'}, {...evidence,...patch}).status,'unknown');
 assert.equal(M.attendance(campaign,{id:'p1'},{...evidence,status:'company'}).status,'company');
});
test('invitation purposes use appropriate attendance wording and reject fake post-event familiarity',()=>{
 const buyer={id:'p1',name:'Robin Smith'};
 const confirmed=M.draft(campaign,essentials,buyer,'professional','email',{purpose:'meeting',attendance:evidence});assert.match(confirmed.message,/Would you be open to meeting/);
 const unknown=M.draft(campaign,essentials,buyer,'professional','email',{purpose:'check'});assert.match(unknown.message,/Will you be attending/);
 assert.throws(()=>M.draft(campaign,essentials,buyer,'professional','email',{purpose:'followup'}),/meeting notes/i);
});
test('event research queries include the exact edition and separate company listings from people attendance',()=>{
 const q=M.queries(campaign,{idealCustomer:'manufacturers'});assert.ok(q.length>=2);assert.ok(q.every(row=>row.query.includes('2099')));assert.ok(q.some(row=>/speakers|attendees/.test(row.query)));
});
test('switching back restores the exact business draft and its original across serialization',()=>{
 assert.equal(typeof M.stageDraft,'function');const original={channel:'email',drafts:{emailSubject:'Manual subject',emailBody:'My exact manual message'},messageStudioDraft:{tailoredOriginal:{draft:{message:'Protected original'}},scriptSavedAt:'date'},localizationStatus:'complete'};
 const invitation=M.draft(campaign,essentials,{name:'Robin Smith'});const staged=M.stageDraft(original,{campaign,draft:invitation});assert.equal(original.messageStudioDraft.businessDraftSnapshot,undefined);
 staged.drafts={emailSubject:invitation.subject,emailBody:invitation.message};staged.messageStudioDraft.eventSnapshot=campaign;
 const restored=M.restoreBusinessDraft(JSON.parse(JSON.stringify(staged)));assert.equal(restored.drafts.emailBody,original.drafts.emailBody);assert.deepEqual(restored.messageStudioDraft.tailoredOriginal,original.messageStudioDraft.tailoredOriginal);assert.equal(restored.messageStudioDraft.eventSnapshot,undefined);
});
function ui(active=true){const w=new JSDOM('<section id="step-1"><div class="stage1-primary-action"></div></section><section id="step-5"><div id="company-search-context"></div></section><section id="message-studio"></section>',{url:'https://app.test',runScripts:'outside-only'}).window;w.LeadIntelEventCampaigns=M;w.LeadIntelServerBridge={workspace:{id:'one'},session:{authenticated:true},saveNow:async()=>({saved:true})};const saved=M.save({},campaign);w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({eventCampaigns:active?M.activate(saved,'forum'):saved}));w.eval(fs.readFileSync(require.resolve('../event-campaign-ui.js'),'utf8'));w.LeadIntelEventCampaignUI.mount();return w;}
function adapter(extra={}){return {usable:()=>true,context:()=>({essentials,buyer:{id:'p1',name:'Robin Smith'},channel:'email'}),stamp:()=> 'one:p1',apply:()=>{},business:()=>{},...extra};}
test('active event opens highlighted invitation automatically but never generates on render',()=>{const w=ui();let requests=0;w.LeadIntelEventCampaignUI.mountMessage(adapter({generate:async()=>{requests++;}}));const panel=w.document.getElementById('event-message-panel');assert.equal(panel.open,true);assert.equal(panel.classList.contains('event-active'),true);assert.equal(w.document.getElementById('event-message-preview').hidden,true);assert.equal(requests,0);assert.equal(w.document.getElementById('event-campaign-panel').closest('section').id,'step-1');w.close();});
test('unselected event controls remain collapsed and late activation is available without restarting',()=>{const w=ui(false);w.LeadIntelEventCampaignUI.mountMessage(adapter());assert.equal(w.document.getElementById('event-message-panel').open,false);assert.ok(w.document.getElementById('event-message-setup'));w.document.getElementById('event-message-setup').click();assert.equal(w.document.getElementById('event-campaign-panel').open,true);w.close();});
test('stale event AI proposal cannot replace a newer recipient or current normal draft',async()=>{const w=ui();let stamp='p1',resolve,applied=0;w.LeadIntelEventCampaignUI.mountMessage(adapter({stamp:()=>stamp,apply:()=>applied++,generate:()=>new Promise(r=>resolve=r)}));w.document.getElementById('event-writer-instruction').value='Make it concise';const task=w.document.getElementById('event-writer-generate').onclick();stamp='p2';resolve({draft:M.draft(campaign,essentials,{name:'Robin Smith'})});await task;assert.equal(w.document.getElementById('event-message-preview').hidden,true);assert.equal(applied,0);assert.match(w.document.getElementById('event-message-status').textContent,/changed/i);w.close();});
test('a second event captures the latest business draft rather than restoring an older backup',()=>{
 const first={drafts:{emailSubject:'First',emailBody:'First business'},messageStudioDraft:{}};
 const staged=M.stageDraft(first,{campaign,draft:M.draft(campaign,essentials,{name:'Robin'})});
 staged.drafts={emailSubject:'New',emailBody:'New manual business'};
 const next=M.stageDraft(staged,{campaign:{...campaign,id:'second'},draft:M.draft(campaign,essentials,{name:'Robin'})});
 assert.equal(M.restoreBusinessDraft(next).drafts.emailBody,'New manual business');
});
test('event save/reopen retains edited preview and never changes the normal message',async()=>{
 const w=ui();let stored;w.LeadIntelEventCampaignUI.mountMessage(adapter({savePreview:async p=>{stored=JSON.parse(JSON.stringify(p));},savedPreview:()=>stored}));
 w.document.getElementById('event-message-create').click();const body=w.document.getElementById('event-preview-body');body.value+='\nMy manual note.';await w.document.getElementById('event-message-save').onclick();w.document.getElementById('event-message-cancel').click();w.LeadIntelEventCampaignUI.refresh();w.document.getElementById('event-message-reopen').click();assert.match(body.value,/My manual note/);w.close();
});
test('mounted message runtime applies an event only on click and restores exact normal content',()=>{
 const {mounted}=require('./helpers/message-runtime.js');const runtime=mounted(),w=runtime.w;
 w.LeadIntelEventCampaigns=M;const main=JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state'));main.eventCampaigns=M.activate(M.save({},campaign),campaign.id);w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
 w.eval(fs.readFileSync(require.resolve('../event-campaign-ui.js'),'utf8'));w.eval('installEventMessages();');
 const before=runtime.item(),body=before.drafts.emailBody;
 assert.equal(runtime.q('event-message-panel').open,true);assert.equal(runtime.item().drafts.emailBody,body);
 runtime.q('event-message-create').click();assert.equal(runtime.item().drafts.emailBody,body);runtime.q('event-message-use').click();assert.equal(runtime.item().messageStudioDraft.eventSnapshot.id,campaign.id);assert.match(runtime.item().drafts.emailBody,/Industry Forum/);
 runtime.q('event-message-regular').click();assert.equal(runtime.item().drafts.emailBody,body);assert.equal(runtime.item().drafts.emailSubject,before.drafts.emailSubject);assert.deepEqual(runtime.item().messageStudioDraft.tailoredOriginal,before.messageStudioDraft.tailoredOriginal);w.close();
});
