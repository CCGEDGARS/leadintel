const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),C=require('../crm-engine.js'),W=require('../workspace-sync.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function runtime({crmOk=true,syncOk=true,confirmed=true,authenticated=true,role='owner',exists=true}={}){
 const candidate={domain:'example.com',company:'Example',buyerSearchMode:'user_selected_target',peopleStatus:'complete',people:[{id:'anna',name:'Anna',title:'Director',kept:true}]},other={domain:'other.com',company:'Other',buyerSearchMode:'user_selected_target',people:[]};
 const events=[],writes=[],toasts=[],storage=new Map();let meta={activeBuyerCompanyDomain:'example.com',scriptBuyer:{domain:'example.com',personId:'anna'},selectedEmailBuyer:{domain:'example.com'}};
 storage.set('main',JSON.stringify({website:'seller.com',targetCompanies:[candidate,other]}));storage.set('outreach',JSON.stringify({selectedDomain:'example.com',items:[candidate,other],buyerDrafts:{a:candidate},messageStudio:{mode:'friendly'}}));storage.set('delivery',JSON.stringify({opportunities:[candidate,other],activity:[candidate]}));
 const b={workspace:{id:'one',role},session:{authenticated,user:{id:'owner'}},listCrmCompanies:async()=>({ok:true,companies:exists?[{id:'crm-one',normalized_domain:'example.com'}]:[]}),deleteCrmCompany:async id=>{events.push('delete');writes.push(id);return {ok:crmOk,error:'CRM deletion failed'};},saveCrmCompany:async()=>{events.push('forbidden-save');return {ok:true};},saveNow:async()=>{events.push('sync');return {saved:syncOk};}};
 const ctx={discovery:{selectedProspects:[candidate,other],candidates:[candidate,other],pipeline:[candidate],potentialMatches:[candidate]},crmCompanies:[{id:'crm-one',normalized_domain:'example.com'}],crmPipeline:[],crmRefreshRevision:0,buyerCompanyRemovalPending:new Set(),buyerCompanySavePending:new Set(),enrichmentPending:new Set(),canonicalDomain:D.canonicalDomain,bridge:()=>b,crmAuthenticated:()=>b.session.authenticated,window:{LeadIntelCrm:C,LeadIntelWorkspaceSync:W,LeadIntelDialogs:{confirm:async()=>{events.push('confirm');return confirmed;}},dispatchEvent:event=>events.push(event.type)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},MAIN_STORAGE_KEY:'main',OUTREACH_STORAGE_KEY:'outreach',DELIVERY_STORAGE_KEY:'delivery',loadMeta:()=>({...meta}),saveMeta:value=>{meta=value;},saveDiscovery:()=>events.push('local'),renderAll:()=>events.push('render'),showToast:value=>toasts.push(value),personKey:(c,p)=>`${c.domain}:${p.id}`,saveBuyerResearch:async(domain,options)=>{events.push('save-research');options.onSaved(C.buyerCrmSignature(candidate));return true;}};
 vm.createContext(ctx);const start=source.indexOf('function buyerCompanySnapshot(');assert.ok(start>=0,'complete removal must coordinate the saved workspace and CRM');vm.runInContext(source.slice(start,source.indexOf('\nfunction buyerAutomaticMode(',start)),ctx);
 return {ctx,b,candidate,other,events,writes,toasts,storage,meta:()=>meta};
}

test('confirmed Remove deletes the CRM company and all working records without ever saving it to CRM',async()=>{
 const r=runtime();assert.equal(await r.ctx.removeSelectedBuyerCompany('https://www.example.com/team'),true);
 assert.deepEqual(r.writes,['crm-one']);assert.equal(r.events.includes('forbidden-save'),false);
 assert.ok(r.events.indexOf('confirm')<r.events.indexOf('sync'));assert.ok(r.events.indexOf('sync')<r.events.indexOf('delete'),'sync cleanup before irreversible CRM deletion');
 for(const key of ['selectedProspects','candidates','pipeline','potentialMatches'])assert.equal(r.ctx.discovery[key].some(x=>x.domain==='example.com'),false,key);
 assert.equal(JSON.parse(r.storage.get('outreach')).items.length,1);assert.equal(JSON.parse(r.storage.get('delivery')).activity.length,0);assert.equal(r.meta().scriptBuyer,undefined);assert.equal(r.meta().selectedEmailBuyer,undefined);
 assert.equal(r.ctx.crmCompanies.length,0);assert.match(r.toasts.at(-1),/permanently removed/i);
});
test('Cancel, non-owner, sign-out and active research never delete or modify the selection',async()=>{
 for(const options of [{confirmed:false},{role:'sales'},{authenticated:false},{busy:'peopleStatus'},{busy:'publicContactStatus'},{enrichment:true}]){
  const r=runtime(options);if(options.busy)r.candidate[options.busy]='loading';if(options.enrichment)r.ctx.enrichmentPending.add('example.com:anna');
  assert.equal(await r.ctx.removeSelectedBuyerCompany('example.com'),false);assert.equal(r.ctx.discovery.selectedProspects[0],r.candidate);assert.equal(r.writes.length,0);assert.equal(r.events.includes('sync'),false);assert.equal(r.ctx.buyerCompanyRemovalPending.size,0);
 }
});
test('workspace sync failure restores all local records and never calls permanent CRM deletion',async()=>{
 const r=runtime({syncOk:false});assert.equal(await r.ctx.removeSelectedBuyerCompany('example.com'),false);assert.equal(r.writes.length,0);assert.equal(r.ctx.discovery.selectedProspects[0].domain,'example.com');assert.equal(JSON.parse(r.storage.get('outreach')).items.length,2);assert.equal(r.meta().scriptBuyer.personId,'anna');
});
test('CRM deletion failure restores the selection and its prior working records',async()=>{
 const r=runtime({crmOk:false});assert.equal(await r.ctx.removeSelectedBuyerCompany('example.com'),false);assert.equal(r.ctx.discovery.selectedProspects[0].domain,'example.com');assert.equal(r.ctx.discovery.pipeline.length,1);assert.equal(JSON.parse(r.storage.get('outreach')).buyerDrafts.a.domain,'example.com');assert.equal(r.events.filter(e=>e==='sync').length,2);assert.match(r.toasts.at(-1),/CRM deletion failed/);
});
test('CRM lookup failure prevents uncertain partial removal and unsaved companies are never auto-created',async()=>{
 const failed=runtime();failed.b.listCrmCompanies=async()=>({ok:false,error:'offline'});assert.equal(await failed.ctx.removeSelectedBuyerCompany('example.com'),false);assert.equal(failed.ctx.discovery.selectedProspects.length,2);
 const unsaved=runtime({exists:false});assert.equal(await unsaved.ctx.removeSelectedBuyerCompany('example.com'),true);assert.equal(unsaved.writes.length,0);assert.equal(unsaved.events.includes('forbidden-save'),false);
});
test('workspace switch during confirmation and repeated clicks cannot delete the wrong company',async()=>{
 const r=runtime();let finish;r.ctx.window.LeadIntelDialogs.confirm=()=>new Promise(resolve=>finish=resolve);const pending=r.ctx.removeSelectedBuyerCompany('example.com');while(!finish)await new Promise(resolve=>setImmediate(resolve));assert.equal(await r.ctx.removeSelectedBuyerCompany('other.com'),false);r.b.workspace={id:'two',role:'owner'};finish(true);assert.equal(await pending,false);assert.equal(r.writes.length,0);assert.equal(r.ctx.discovery.selectedProspects.length,2);
});
test('rollback keeps unrelated changes made while the delete request is awaiting its response',async()=>{
 const r=runtime();let finish;r.b.deleteCrmCompany=()=>new Promise(resolve=>finish=resolve);const pending=r.ctx.removeSelectedBuyerCompany('example.com');while(!finish)await new Promise(resolve=>setImmediate(resolve));const main=JSON.parse(r.storage.get('main'));main.note='New user edit';r.storage.set('main',JSON.stringify(main));finish({ok:false,error:'failed'});assert.equal(await pending,false);assert.equal(JSON.parse(r.storage.get('main')).note,'New user edit');assert.equal(r.ctx.discovery.selectedProspects.length,2);
});
test('Save records a compact Saved status, detects changed research and does not remove the company',async()=>{
 const r=runtime();assert.equal(await r.ctx.saveSelectedBuyerCompany('example.com'),true);assert.equal(r.ctx.buyerCompanySaved(r.candidate),true);assert.equal(r.ctx.discovery.selectedProspects.length,2);r.candidate.people[0].publicEmail='anna@example.com';assert.equal(r.ctx.buyerCompanySaved(r.candidate),false);assert.equal(r.writes.length,0);
});
test('Save never marks changed research as saved and transport failure leaves Save retryable',async()=>{
 const changed=runtime();changed.ctx.saveBuyerResearch=async(domain,options)=>{options.onSaved(C.buyerCrmSignature(changed.candidate));changed.candidate.people.push({id:'new',name:'New Buyer'});return true;};
 await changed.ctx.saveSelectedBuyerCompany('example.com');assert.equal(changed.ctx.buyerCompanySaved(changed.candidate),false);
 const failed=runtime();failed.b.saveNow=async()=>{throw Error('offline');};assert.equal(await failed.ctx.saveSelectedBuyerCompany('example.com'),false);assert.equal(failed.ctx.buyerCompanySaved(failed.candidate),false);assert.equal(failed.ctx.discovery.selectedProspects.length,2);
});
function mount(r){
 const dom=new JSDOM('<section id="customer-pipeline"></section><p id="selection-count"></p>');const ctx=r.ctx;
 Object.assign(ctx,{LeadIntelDiscovery:D,document:dom.window.document,$:id=>dom.window.document.getElementById(id),esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),mainState:()=>({}),crmCompanyByDomain:()=>({id:'crm-one'}),candidateBuyerRoles:()=>['Director'],selectedBuyerEnrichment:new Set(),enrichmentResults:new Map()});
 for(const fn of ['buyerQualitySupervisorHtml','companyContactDossierHtml','buyerProviderStatusHtml','buyerResearchAccountabilityHtml'])ctx[fn]=()=>'';
 vm.runInContext(source.slice(source.indexOf('function renderSelectedProspects('),source.indexOf('function renderPipeline(')),ctx);
 ctx.renderAll=()=>{dom.window.document.getElementById('customer-pipeline').innerHTML=ctx.renderSelectedProspects(ctx.discovery.selectedProspects);dom.window.document.getElementById('selection-count').textContent=ctx.discovery.selectedProspects.length+' selected';};
 vm.runInContext(source.split('\n').find(line=>line.includes('$("customer-pipeline")?.addEventListener("click"')),ctx);ctx.renderAll();return dom;
}
const settle=async ctx=>{while(ctx.buyerCompanyRemovalPending.size||ctx.buyerCompanySavePending.size)await new Promise(resolve=>setImmediate(resolve));};
test('company cards show exactly Refresh, Save and Remove in that order and the actions are wired',async()=>{
 const r=runtime(),dom=mount(r),doc=dom.window.document;assert.deepEqual([...doc.querySelector('.selected-prospect-actions').children].map(b=>b.textContent),['Refresh','Save','Remove']);
 doc.querySelector('[data-save-buyer-research]').click();await settle(r.ctx);assert.equal(doc.querySelector('[data-save-buyer-research]').textContent,'Saved ✓');
 doc.querySelector('[data-remove-buyer-company]').click();await settle(r.ctx);assert.equal(doc.querySelectorAll('.selected-prospect-row').length,1);assert.equal(doc.getElementById('selection-count').textContent,'1 selected');dom.window.close();
});
test('canceling the rendered Remove confirmation leaves its card and all data intact',async()=>{
 const r=runtime({confirmed:false}),dom=mount(r);dom.window.document.querySelector('[data-remove-buyer-company]').click();await settle(r.ctx);assert.equal(dom.window.document.querySelectorAll('.selected-prospect-row').length,2);assert.equal(r.writes.length,0);dom.window.close();
});
