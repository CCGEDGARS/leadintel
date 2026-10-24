const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
async function fixture(overrides={}){
 const dom=new JSDOM('<section id="step-7" class="step-view" data-step="7"><section class="connector-card"></section><input id="delivery-recipient"></section>',{url:'https://example.test/customer/'}),navigations=[];
 const bridge={session:{authenticated:true},workspace:{id:'w1'},getOutreachAutomationPolicy:async()=>({ok:true,role:'owner',policy:{automaticDelivery:'manual_only',mode:'manual'}}),getOutreachAutomationStatus:async()=>({ok:true,role:'owner'}),listSuppressedContacts:async()=>({ok:true,contacts:[]}),...overrides};
 const context={LeadIntelServerBridge:bridge,LeadIntelCustomerNavigation:{setStep:s=>navigations.push(s)}};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../outreach-automation-ui.js'),'utf8'),context);context.document=dom.window.document;
 await context.LeadIntelOutreachAutomationUI.refresh();return {dom,bridge,context,navigations,q:s=>dom.window.document.querySelector(s)};
}
test('manual mode has working settings navigation and readable light controls',async()=>{const f=await fixture();try{
 const style=f.dom.window.document.createElement('style');style.textContent=fs.readFileSync(require.resolve('../outreach-automation.css'),'utf8');f.dom.window.document.head.append(style);
 assert.equal(f.dom.window.getComputedStyle(f.q('#outreach-automation-panel')).backgroundColor,'rgb(255, 255, 255)');
 assert.equal(f.dom.window.getComputedStyle(f.q('#oa-suppress-email')).backgroundColor,'rgb(255, 255, 255)');
 const action=f.q('[data-oa-settings]');assert.ok(action);action.click();assert.deepEqual(f.navigations,[1]);assert.equal(f.q('.connector-card').nextElementSibling.id,'outreach-automation-panel');
}finally{f.dom.window.close();}});
test('disconnected provider send buttons remain hidden despite shared flex button styles',()=>{const dom=new JSDOM('<section id="step-7"><button class="primary-btn" hidden>Send with Microsoft</button></section>');try{const style=dom.window.document.createElement('style');style.textContent='.primary-btn{display:flex}\n'+fs.readFileSync(require.resolve('../styles.css'),'utf8');dom.window.document.head.append(style);assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('button')).display,'none');}finally{dom.window.close();}});
test('policy error is unknown with retry instead of falsely displaying manual delivery',async()=>{const f=await fixture({getOutreachAutomationPolicy:async()=>({ok:false,error:'Connection unavailable'})});try{
 assert.match(f.q('#outreach-automation-panel').textContent,/Connection unavailable/);assert.doesNotMatch(f.q('#outreach-automation-panel').textContent,/Manual delivery/);assert.ok(f.q('[data-oa-retry]'));
 f.bridge.getOutreachAutomationPolicy=async()=>({ok:true,role:'owner',policy:{automaticDelivery:'manual_only'}});f.q('[data-oa-retry]').click();await new Promise(r=>setImmediate(r));assert.match(f.q('#outreach-automation-panel').textContent,/Manual delivery/);
}finally{f.dom.window.close();}});
test('policy refresh failure exposes retry even after a previously successful load',async()=>{const f=await fixture();try{f.bridge.getOutreachAutomationPolicy=async()=>({ok:false,error:'Saved status could not be verified'});await f.context.LeadIntelOutreachAutomationUI.refresh();assert.match(f.q('#outreach-automation-panel').textContent,/Saved status could not be verified/);assert.ok(f.q('[data-oa-retry]'));assert.doesNotMatch(f.q('#outreach-automation-panel').textContent,/Manual delivery/);}finally{f.dom.window.close();}});
test('suppression fetch failure never appears as zero blocked contacts and retries safely',async()=>{let mutations=0;const f=await fixture({listSuppressedContacts:async()=>({ok:false,error:'Blocked list unavailable'}),suppressOutreachContact:async()=>{mutations++;return {ok:true};}});try{
 assert.match(f.q('#outreach-contact-suppression').textContent,/Blocked list unavailable/);assert.doesNotMatch(f.q('#outreach-contact-suppression').textContent,/0 blocked contacts/);assert.equal(mutations,0);
 f.bridge.listSuppressedContacts=async()=>({ok:true,contacts:[{email:'blocked@buyer.test',reason:'manual'}]});f.q('[data-oa-suppression-retry]').click();await new Promise(r=>setImmediate(r));assert.match(f.q('#outreach-contact-suppression').textContent,/1 blocked contact/);
}finally{f.dom.window.close();}});
