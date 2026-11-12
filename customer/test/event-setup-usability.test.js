const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const M=require('../event-campaigns.js'),KEY='leadintel_customer_v2_state';
function ui(save=async()=>({saved:true})){
 const w=new JSDOM('<section id="step-2" class="active"><div class="stage-next-action"></div></section><div id="company-search-context"></div>',{url:'https://app.test',runScripts:'outside-only'}).window;
 w.LeadIntelEventCampaigns=M;w.LeadIntelServerBridge={workspace:{id:'w1'},session:{authenticated:true,user:{id:'u1'}},saveNow:save};
 w.localStorage.setItem(KEY,JSON.stringify({targetMarkets:['Denmark'],answers:{ideal_customer:'Industrial operators',buyer_roles:'Procurement managers'}}));
 w.eval(fs.readFileSync(require.resolve('../event-campaign-ui.js'),'utf8'));w.LeadIntelEventCampaignUI.mount();
 return {w,d:w.document,field:k=>w.document.querySelector('[data-event-field="'+k+'"]'),plan:k=>w.document.querySelector('[data-event-plan="'+k+'"]'),status:()=>w.document.querySelector('#event-campaign-status').textContent};
}
function complete(r){for(const [k,v] of Object.entries({name:'Future Industry Forum',startDate:'2099-10-10',endDate:'2099-10-12',country:'Denmark',location:'Herning'}))r.field(k).value=v;}
test('event website reading uses the signed-in workspace service and retains editable manual fallback',async()=>{
 const r=ui();let request;r.field('website').value='https://forum.test/';r.w.fetch=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({data:{markdown:'# Future Forum\nCountry: Denmark\nCity: Herning'}})};};
 await r.d.querySelector('#event-website-analyze').onclick();
 assert.equal(request.url,'/api/integrations/services/firecrawl/scrape?workspace_id=w1');assert.equal(request.options.credentials,'include');assert.equal(JSON.parse(request.options.body).url,'https://forum.test/');
 assert.equal(r.field('name').value,'Future Forum');assert.match(r.field('websiteEvidence').value,/Source: https:\/\/forum.test/);
 r.w.fetch=async()=>({ok:false,json:async()=>({error:'Provider unavailable'})});await r.d.querySelector('#event-website-analyze').onclick();assert.match(r.status(),/manually|manual/i);assert.equal(r.field('name').value,'Future Forum');
 r.w.close();
});
test('an unsigned event website request never falls back to the shared paid proxy',async()=>{
 const r=ui();r.w.LeadIntelServerBridge.session.authenticated=false;r.field('website').value='https://forum.test/';let calls=0;r.w.fetch=async()=>{calls++;return {ok:true,json:async()=>({markdown:'# Forum'})};};
 await r.d.querySelector('#event-website-analyze').onclick();assert.equal(calls,0);assert.match(r.status(),/sign in/i);r.w.close();
});
test('event form groups advanced inputs, exposes seller targeting and has one continuation action',()=>{
 const r=ui();assert.equal(r.field('country').value,'Denmark');assert.equal(r.field('audience').value,'Industrial operators');
 assert.equal(r.field('audience').closest('details'),r.d.querySelector('#event-campaign-panel'),'targeting is visible before choosing companies');assert.equal(r.field('roles').closest('details'),r.d.querySelector('#event-campaign-panel'));
 assert.equal(r.field('sourceUrls').closest('details').open,false);assert.equal(r.field('websiteEvidence').readOnly,true);
 assert.equal(r.plan('researchDepth').closest('details').open,false);assert.equal(r.d.querySelector('#event-campaign-activate'),null,'retire duplicate activation control');
 assert.match(r.d.querySelector('#event-plan-recipients').textContent,/Save.*choose companies/i);r.w.close();
});
test('continuation names and focuses the missing event field without saving or navigating',async()=>{
 let saves=0;const r=ui(async()=>{saves++;return {saved:true};});r.d.querySelector('#event-planning-open').click();
 await r.d.querySelector('#event-plan-recipients').onclick();assert.equal(saves,0);assert.equal(r.d.activeElement,r.field('name'));assert.equal(r.field('name').getAttribute('aria-invalid'),'true');
 r.field('name').value='Future Forum';await r.d.querySelector('#event-plan-recipients').onclick();assert.equal(r.d.activeElement,r.field('startDate'));assert.match(r.status(),/Start date/);assert.equal(saves,0);r.w.close();
});
test('save and choose is single-flight, persists the exact audience and hands off only after acknowledgement',async()=>{
 let release,saves=0,opened=[];const gate=new Promise(r=>release=r),r=ui(async()=>{saves++;await gate;return {saved:true};});complete(r);r.plan('targetCount').value='5';r.plan('contactsPerCompany').value='2';
 r.w.LeadIntelEmailCampaignUI={openEvent:async c=>{opened.push(c);return true;}};
 const button=r.d.querySelector('#event-plan-recipients'),first=button.onclick();let second;
 try{assert.equal(button.disabled,true);assert.equal(r.field('name').disabled,true);second=button.onclick();assert.equal(saves,1);assert.equal(opened.length,0);}finally{release();}
 await Promise.all([first,second]);
 assert.equal(opened.length,1);assert.equal(opened[0].targetCount,5);assert.equal(opened[0].contactsPerCompany,2);assert.equal(opened[0].country,'Denmark');
 assert.equal(M.active(JSON.parse(r.w.localStorage.getItem(KEY)).eventCampaigns).id,opened[0].id);assert.equal(button.disabled,false);r.w.close();
});
test('failed event save preserves the form and never opens the recipient picker',async()=>{
 const r=ui(async()=>({saved:false}));complete(r);let opened=0;r.w.LeadIntelEmailCampaignUI={openEvent:async()=>opened++};await r.d.querySelector('#event-plan-recipients').onclick();
 assert.equal(opened,0);assert.equal(r.field('name').value,'Future Industry Forum');assert.match(r.status(),/Retry Save/);assert.equal(r.d.querySelector('#event-plan-recipients').disabled,false);r.w.close();
});
test('a workspace switch while saving cannot open the old event in the new workspace',async()=>{
 let release,opened=0;const gate=new Promise(r=>release=r),r=ui(async()=>{await gate;return {saved:true};});complete(r);r.w.LeadIntelEmailCampaignUI={openEvent:async()=>opened++};
 const pending=r.d.querySelector('#event-plan-recipients').onclick();r.w.LeadIntelServerBridge.workspace={id:'w2'};r.w.localStorage.setItem(KEY,'{}');r.w.dispatchEvent(new r.w.CustomEvent('leadintel:workspace-changed'));release();await pending;
 assert.equal(opened,0);assert.equal(r.field('name').value,'');assert.equal(r.d.querySelector('#event-plan-recipients').disabled,false);r.w.close();
});
test('a canceled recipient handoff does not report that the picker opened',async()=>{
 const r=ui();complete(r);r.w.LeadIntelEmailCampaignUI={openEvent:async()=>false};await r.d.querySelector('#event-plan-recipients').onclick();assert.match(r.status(),/unchanged|cancel/i);assert.doesNotMatch(r.status(),/selector below/);r.w.close();
});

test('campaign navigation from Profile restores company state before Messages and Delivery modules initialize',async()=>{
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),code=source.split('\n').find(line=>line.startsWith('window.LeadIntelCampaignModuleLoader='));
 for(const step of [6,7]){const order=[];let mounted=false;const loader=new Function('window','ensureDiscoveryMounted','loadOutreachModules','document',code+'return window.LeadIntelCampaignModuleLoader;')({},options=>{assert.equal(options.refreshCrm,false);mounted=true;order.push('restore');},async()=>{assert.equal(mounted,true,'company state must exist before Messages reads its pipeline');order.push('load');},{getElementById:()=>({})});await loader(step);assert.deepEqual(order,['restore','load']);}
});

test('event analysis has nearby live feedback and a loading label, then keeps manual fields available',async()=>{
 const r=ui();r.field('website').value='https://forum.test/';let release;r.w.fetch=()=>new Promise(resolve=>release=resolve);const button=r.d.querySelector('#event-website-analyze');assert.ok(button.classList.contains('primary-btn'));
 const pending=button.onclick();assert.match(button.textContent,/Reading/);assert.equal(button.getAttribute('aria-busy'),'true');assert.match(r.d.querySelector('#event-website-status').textContent,/Reading/);
 release({ok:true,json:async()=>({markdown:'# Forum'})});await pending;assert.match(button.textContent,/Analyze/);assert.match(r.d.querySelector('#event-website-status').textContent,/Review/);assert.equal(r.field('name').disabled,false);assert.equal(r.d.querySelectorAll('.event-journey li').length,4);r.w.close();
});
test('research activation restores the requested saved event before the campaign handoff and never crosses workspaces',async()=>{
 const r=ui();let main=JSON.parse(r.w.localStorage.getItem(KEY));main.eventCampaigns=M.save(M.save({}, {id:'a',name:'Event A',startDate:'2099-01-01',endDate:'2099-01-02',roles:'Engineering Director'}),{id:'b',name:'Event B',startDate:'2099-02-01',endDate:'2099-02-02',roles:'CFO'});main.eventCampaigns=M.activate(main.eventCampaigns,'b');r.w.localStorage.setItem(KEY,JSON.stringify(main));
 await r.w.LeadIntelEventCampaignUI.activateForCampaign('a');assert.equal(M.active(JSON.parse(r.w.localStorage.getItem(KEY)).eventCampaigns).id,'a');assert.equal(M.active(JSON.parse(r.w.localStorage.getItem(KEY)).eventCampaigns).roles,'Engineering Director');await assert.rejects(r.w.LeadIntelEventCampaignUI.activateForCampaign('missing'),/saved event|unavailable/i);r.w.close();
});
