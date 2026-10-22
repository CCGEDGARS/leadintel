const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {mounted}=require('./helpers/message-runtime.js');
const O=require('../outreach-engine.js'),E=require('../message-editor.js');
const source=fs.readFileSync(require.resolve('../delivery-ui.js'),'utf8');
function setup({deliveryReady=true}={}){
 const h=mounted({selected:'professional'}),w=h.w;
 w.scrollTo=()=>{};w.LeadIntelDelivery=require('../delivery-engine.js');
 h.mountDelivery=()=>{w.document.querySelector('script[data-delivery-engine]')?.dispatchEvent(new w.Event('load'));w.eval('(function(){'+source.replace(/^import .*;\s*$/gm,'')+'\n})();');w.document.querySelector('script[data-delivery-ui]')?.dispatchEvent(new w.Event('load'));};
 if(deliveryReady)h.mountDelivery();
 w.eval('syncCrmActivity=async()=>({ok:true});');
 const input={...h.item(),localizationStatus:'native',localizationApprovalBlocked:false,campaignScenario:{language:'en'},localizationProvenance:{provider:'native-template',model:'approved-template',language:'en',selectionSource:'message-settings'}};
 const approved=O.approveOutreachItem(input,input.drafts,'2026-10-22T09:00:00Z');
 assert.equal(approved.approved,true,approved.error);w.upsertItem(approved);w.renderAll();
 return h;
}
test('saved message handoff selects the exact buyer in Delivery and survives CRM restore without sending',async()=>{
 const h=setup();try{
 await h.w.addCurrentMessageToFlow();
 assert.equal(h.q('step-7').classList.contains('active'),true);
 assert.equal(h.q('delivery-company-select').value,'buyer.example');assert.equal(h.q('delivery-recipient').value,'alex@buyer.example');
 assert.equal(JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_state')).step,7);
 const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(h.item()),'buyer.example');
 assert.deepEqual(E.workingDraft(restored),E.workingDraft(h.item()));assert.equal(restored.messageStudioDraft.flowMembership.recipient,'alex@buyer.example');
 assert.equal(h.requests.some(r=>/send|enqueue/.test(r.url)),false);
 }finally{h.w.close();}
});
test('Delivery ignores a late handoff from another workspace or buyer',async()=>{
 const h=setup();try{
 for(const detail of [{workspaceId:'other',domain:'buyer.example',personId:'p1'},{workspaceId:'w1',domain:'buyer.example',personId:'other'}])h.w.dispatchEvent(new h.w.CustomEvent('leadintel:message-flow-ready',{detail}));
 assert.equal(h.q('step-7').classList.contains('active'),false);
 }finally{h.w.close();}
});
for(const legacyEmail of ['', 'old@buyer.example'])test('verified CRM email reaches Delivery instead of stale dossier email: '+(legacyEmail||'missing'),async()=>{
 const h=setup();try{
 const item=h.item();item.dossier.people[0].email=legacyEmail;h.w.upsertItem(item);h.w.renderAll();
 await h.w.addCurrentMessageToFlow();assert.equal(h.q('delivery-recipient').value,'alex@buyer.example');
 }finally{h.w.close();}
});
test('the real email approval handler accepts a complete saved email without requiring LinkedIn content',async()=>{
 const h=setup();try{
 let item=O.invalidateOutreachApproval(h.item());
 const draft={subject:'Discuss Northport',message:'Hi Alex,\n\nI am Robin Lane from North Works. We provide steel and installation for industrial teams. Would you be open to a 20-minute Zoom conversation to discuss your project requirements and relevant project lessons?\n\nChoose a suitable time: https://calendly.com/north/intro\n\nBest regards,\nRobin Lane'};
 item=E.apply(item,draft,{origin:'manual',style:'original',essentials:h.w.studioState().essentials});item.messageStudioDraft.triggerSourceUrl=item.dossier.selectedTrigger.url;delete item.messageStudioDraft.pendingTemplateUpdate;item.messageStudioDraft.scriptSavedAt='2026-10-22';item.messageStudioDraft.savedDraft=draft;
 h.w.persistStudio({...h.w.studioState(),mode:'original'});h.w.upsertItem(item);h.w.renderAll();
 const result=await h.w.approveOutreach({announce:false});
 assert.equal(result?.ok,true,h.q('toast').textContent);assert.equal(h.item().drafts.linkedinMessage,'');assert.equal(h.item().approvedSource.emailBody,draft.message);
 h.w.renderMessageWorkspace();assert.equal(h.q('mw-add-flow').disabled,false,h.q('mw-add-flow').title+' '+h.q('mw-flow-readiness-text').textContent);h.q('mw-add-flow').click();
 for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.q('step-7').classList.contains('active'),true,'the actual rendered button must invoke the handoff');
 }finally{h.w.close();}
});

test('a cold Delivery module finishes loading before the saved message handoff',async()=>{
 const h=setup({deliveryReady:false});try{
 const pending=h.w.addCurrentMessageToFlow();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.item().messageStudioDraft.flowMembership,undefined);
 h.mountDelivery();await pending;assert.equal(h.q('step-7').classList.contains('active'),true);assert.equal(h.q('delivery-recipient').value,'alex@buyer.example');
 }finally{h.w.close();}
});
