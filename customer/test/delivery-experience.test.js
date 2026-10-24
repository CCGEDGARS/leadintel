const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
function fixture(){
 const dom=new JSDOM('<main class="content"><section id="step-6"><div class="outreach-drafts"></div></section></main>',{url:'https://example.test/customer/',runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{LeadIntelDelivery:require('../delivery-engine.js'),LeadIntelOutreach:require('../outreach-engine.js'),LeadIntelDiscovery:require('../discovery-engine.js'),LeadIntelContentLanguage:{workspaceContentLanguage:()=> 'en'},LeadIntelCustomerNavigation:{setStep:step=>{w.navigated=step;return true;}}});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){w.scrolled=this.id;};
 w.eval('(function(){'+read('delivery-ui.js').replace(/^import .*;\s*$/gm,'')+'\n})();');
 return {w,q:id=>w.document.getElementById(id),close:()=>w.close()};
}
test('Delivery empty learning is compact and footer leads back to Messages without a send',()=>{const f=fixture();try{
 assert.equal(f.q('learning-segments').hidden,true);
 assert.match(f.q('learning-recommendations').textContent,/first.*send|send.*first/i);
 const action=f.q('delivery-workflow-status');assert.equal(action.disabled,false);action.click();assert.equal(f.w.navigated,6);
 assert.equal(JSON.parse(f.w.localStorage.getItem('leadintel_customer_v2_delivery')).activity.length,0);
}finally{f.close();}});
test('confirmed provider send refreshes persisted Delivery state and unlocks outcomes',()=>{const f=fixture();try{
 const pkg={domain:'buyer.test',company:'Buyer',approved:true,approvedAt:'2026-10-24T05:00:00Z',drafts:{emailSubject:'Hello',emailBody:'Hello buyer'},dossier:{people:[]}};
 f.w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({items:[pkg]}));
 const result=f.w.LeadIntelDelivery.confirmSend({},pkg,'alice@buyer.test','2026-10-24T06:00:00Z');f.w.localStorage.setItem('leadintel_customer_v2_delivery',JSON.stringify(result.state));
 f.w.dispatchEvent(new f.w.CustomEvent('leadintel:outreach-sent',{detail:{domain:'buyer.test',provider:'gmail'}}));
 assert.equal(f.q('record-reply').disabled,false);assert.notEqual(f.q('delivery-sent-at').textContent,'Not yet');
 assert.equal(f.q('learning-segments').hidden,false);f.q('delivery-workflow-status').click();assert.equal(f.w.scrolled,'delivery-outcomes');
}finally{f.close();}});
test('unsent Delivery gives useful enabled navigation plus an explanation for locked reply fields',()=>{const f=fixture();try{
 f.w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({items:[{domain:'buyer.test',company:'Buyer',approved:true,drafts:{emailSubject:'Hello',emailBody:'Hello'},dossier:{people:[]}}]}));
 f.w.dispatchEvent(new f.w.CustomEvent('leadintel:module-opened',{detail:{step:7}}));
 assert.equal(f.q('delivery-workflow-status').disabled,false);assert.match(f.q('delivery-recording-note').textContent,/confirmed send/i);f.q('delivery-workflow-status').click();assert.equal(f.w.scrolled,'delivery-recipient');
 assert.equal(f.q('record-reply').disabled,true);
}finally{f.close();}});
