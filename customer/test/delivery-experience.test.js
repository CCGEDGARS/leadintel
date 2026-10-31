const approveFixture=require('./helpers/approved-message.cjs').approveMessage,canonicalMain=require('./helpers/delivery-canonical-context.cjs')();
const approveMessage=(input,options={})=>approveFixture(input,{...options,approvalOptions:{...options.approvalOptions,canonicalState:canonicalMain}});
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
function fixture(){
 const dom=new JSDOM('<main class="content"><section id="step-6"><div class="outreach-drafts"></div></section></main>',{url:'https://example.test/customer/',runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{LeadIntelServerBridge:{ready:true,workspace:{id:'w1',role:'owner'},session:{authenticated:true,user:{id:'fixture-user'}},listCrmCompanies:async()=>({ok:false,error:'Controlled CRM offline'})},LeadIntelDelivery:require('../delivery-engine.js'),LeadIntelOutreach:require('../outreach-engine.js'),LeadIntelDiscovery:require('../discovery-engine.js'),LeadIntelContentLanguage:{workspaceContentLanguage:()=> 'en'},LeadIntelCustomerNavigation:{setStep:step=>{w.navigated=step;return true;}}});
 w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(canonicalMain));w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){w.scrolled=this.id;};
 w.eval('(function(){'+read('delivery-ui.js').replace(/^import .*;\s*$/gm,'')+'\n})();');
 return {w,q:id=>w.document.getElementById(id),close:()=>w.close()};
}
test('Delivery empty learning is compact and footer leads back to Messages without a send',()=>{const f=fixture();try{
 assert.equal(f.q('learning-segments').hidden,true);
 assert.match(f.q('learning-recommendations').textContent,/first.*send|send.*first/i);
 const action=f.q('delivery-workflow-status');assert.equal(action.disabled,false);action.click();assert.equal(f.w.navigated,6);
 assert.equal(f.w.LeadIntelDelivery.normalizeDeliveryState(JSON.parse(f.w.localStorage.getItem('leadintel_customer_v2_delivery'))||{}).activity.length,0);
}finally{f.close();}});
test('confirmed provider send refreshes persisted Delivery state and unlocks outcomes',()=>{const f=fixture();try{
 const pkg=approveMessage({domain:'buyer.test',company:'Buyer',drafts:{emailSubject:'Hello',emailBody:'Hello buyer'}},{email:'alice@buyer.test',name:'Alice Fixture'});
 f.w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({items:[pkg]}));
 const result=f.w.LeadIntelDelivery.confirmSend({},pkg,'alice@buyer.test','2026-10-24T06:00:00Z');f.w.localStorage.setItem('leadintel_customer_v2_delivery',JSON.stringify(result.state));
 f.w.dispatchEvent(new f.w.CustomEvent('leadintel:outreach-sent',{detail:{domain:'buyer.test',provider:'gmail'}}));
 assert.equal(f.q('record-reply').disabled,false);assert.notEqual(f.q('delivery-sent-at').textContent,'Not yet');
 assert.equal(f.q('learning-segments').hidden,false);f.q('delivery-workflow-status').click();assert.equal(f.w.scrolled,'delivery-outcomes');
}finally{f.close();}});
test('unsent Delivery gives useful enabled navigation plus an explanation for locked reply fields',()=>{const f=fixture();try{
 f.w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({items:[approveMessage({domain:'buyer.test',company:'Buyer',drafts:{emailSubject:'Hello',emailBody:'Hello'}},{email:'alice@buyer.test',name:'Alice Fixture'})]}));
 f.w.dispatchEvent(new f.w.CustomEvent('leadintel:module-opened',{detail:{step:7}}));
 assert.equal(f.q('delivery-workflow-status').disabled,false);assert.match(f.q('delivery-recording-note').textContent,/confirmed send/i);f.q('delivery-workflow-status').click();assert.equal(f.w.scrolled,'delivery-recipient');
 assert.equal(f.q('record-reply').disabled,true);
}finally{f.close();}});

test('Delivery handoff and reload select the exact approved buyer at a shared domain',()=>{const f=fixture();try{
 const pkg=id=>approveMessage({domain:'buyer.test',company:'Buyer',channel:'email',selectedPersonId:id,approvedAt:'2026-10-24T05:00:00Z',drafts:{emailSubject:'Hello '+id,emailBody:'Message for '+id},dossier:{people:[{id,email:id+'@buyer.test'}]},messageStudioDraft:{flowMembership:{status:'ready',workspaceId:'w1',domain:'buyer.test',personId:id,approvedAt:'2026-10-24T05:00:00Z',subject:'Hello '+id,message:'Message for '+id,recipient:id+'@buyer.test'}}});
 const a=pkg('alice'),b=pkg('bob');f.w.LeadIntelServerBridge={workspace:{id:'w1'}};
 const O=f.w.LeadIntelOutreach;f.w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({items:[a],buyerDrafts:{[O.buyerDraftKey(b.domain,b.selectedPersonId,b.channel)]:b}}));
 f.w.dispatchEvent(new f.w.CustomEvent('leadintel:message-flow-ready',{detail:{workspaceId:'w1',domain:'buyer.test',personId:'bob',approvedAt:b.approvedAt}}));
 assert.equal(f.q('delivery-recipient').value,'bob@buyer.test');assert.equal(f.q('delivery-company-select').options.length,2);
 const state=JSON.parse(f.w.localStorage.getItem('leadintel_customer_v2_delivery'));assert.ok(state.selectedPackageKey);
 f.w.dispatchEvent(new f.w.CustomEvent('leadintel:module-opened',{detail:{step:7}}));assert.equal(f.q('delivery-recipient').value,'bob@buyer.test');
 const other=[...f.q('delivery-company-select').options].find(o=>o.textContent.includes('alice'));assert.ok(other);f.q('delivery-company-select').value=other.value;f.q('delivery-company-select').dispatchEvent(new f.w.Event('change'));
 assert.equal(f.q('delivery-recipient').value,'alice@buyer.test');
}finally{f.close();}});

test('confirming a saved buyer send marks that buyer contacted without changing the active buyer',async()=>{const f=fixture();try{
 const pkg=id=>approveMessage({domain:'buyer.test',company:'Buyer',channel:'email',selectedPersonId:id,approvedAt:'2026-10-24T05:00:00Z',drafts:{emailSubject:'Hello '+id,emailBody:'Message for '+id},dossier:{people:[{id,email:id+'@buyer.test'}]}});
 const a=pkg('alice'),b=pkg('bob'),O=f.w.LeadIntelOutreach,key=O.buyerDraftKey(b.domain,b.selectedPersonId,b.channel);
 f.w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({items:[a],buyerDrafts:{[key]:b}}));
 f.w.localStorage.setItem('leadintel_customer_v2_delivery',JSON.stringify({selectedDomain:b.domain,selectedPackageKey:f.w.LeadIntelDelivery.packageKey(b)}));f.w.dispatchEvent(new f.w.CustomEvent('leadintel:outreach-sent'));
 await f.w.LeadIntelDeliveryUI.confirmSent();
 const state=JSON.parse(f.w.localStorage.getItem('leadintel_customer_v2_outreach'));assert.ok(state.buyerDrafts[key].contactedAt);assert.equal(state.items[0].contactedAt,'');
}finally{f.close();}});

test('a new approval leaves the earlier sent email available for recording real outcomes',async()=>{const f=fixture();try{
 const old=approveMessage({domain:'buyer.test',company:'Buyer',channel:'email',selectedPersonId:'alice',approvedAt:'2026-10-23T05:00:00Z',drafts:{emailSubject:'First message',emailBody:'First'},dossier:{people:[{id:'alice',name:'Alice Fixture',email:'alice@buyer.test'}]}});
 const sent=f.w.LeadIntelDelivery.confirmSend({},old,'alice@buyer.test','2026-10-23T06:00:00Z');
 const fresh=approveMessage({...old,approvedAt:'2026-10-24T05:00:00Z',drafts:{emailSubject:'Revised message',emailBody:'Revised'}});
 f.w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({items:[fresh]}));f.w.localStorage.setItem('leadintel_customer_v2_delivery',JSON.stringify(sent.state));f.w.dispatchEvent(new f.w.CustomEvent('leadintel:outreach-sent'));
 const history=f.q('delivery-history-select');assert.ok(history);history.value=sent.record.id;history.dispatchEvent(new f.w.Event('change'));
 assert.equal(f.q('record-reply').disabled,false);f.w.document.querySelector('[data-outcome-stage="Meeting"]').click();await new Promise(r=>setImmediate(r));
 const saved=JSON.parse(f.w.localStorage.getItem('leadintel_customer_v2_delivery'));assert.equal(saved.opportunities[0].outcomeStage,'Meeting');assert.equal(saved.opportunities[0].approvedAt,old.approvedAt);assert.equal(saved.opportunities.length,1);
}finally{f.close();}});
