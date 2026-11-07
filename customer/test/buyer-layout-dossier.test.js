const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),Dossier=require('../company-dossier.js'),UI=require('../company-dossier-ui.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function render({empty=false,loading=false,rolesChanged=false,confirmedIds=['0','1','2','3'],companies=1,meta={}}={}){
 const people=Array.from({length:6},(_,i)=>({id:String(i),name:`Anna Buyer${i}`,title:i===0?'CEO':i===1?'COO':i===2?'Procurement Director':'Operations Director',organization:'Example',publicNameUrl:'https://example.com/team',emailResearch:{status:'complete',searches:3,failed:0,checkedAt:new Date().toISOString()}}));
 const facts=Array.from({length:5},(_,i)=>({text:`Company finding ${i}`,quote:`Company finding ${i}`,sourceUrl:'https://example.com/news'}));
 const dossier=Dossier.reconcile(['openai','gemini'].map(provider=>({provider,webSearch:true,status:'complete',facts,people:[],channels:[],sources:['https://example.com/news'],extractedSources:['https://example.com/news'],gaps:[]})),{company:'Example',domain:'example.com'});
 const candidate={domain:'example.com',company:'Example',buyerSearchMode:'user_selected_qualified',people:empty?[]:people,peopleStatus:loading?'loading':'complete',buyerRolesChanged:rolesChanged,buyerRoles:['Executive leadership','Procurement Director','Operations Director'],buyerDiscovery:{companyDossier:dossier,checkedAt:new Date().toISOString(),found:6}};
 const ctx={buyerCardLayouts:new WeakMap(),buyerRecheckLayouts:new WeakSet(),bridge:()=>null,verifiedBuyerEmail:(_candidate,person)=>confirmedIds.includes(person.id)?person.id+'@example.com':'',window:{LeadIntelCompanyDossierUi:UI},LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),mainState:()=>({}),loadMeta:()=>meta,saveMeta:value=>{meta=value;},enrichmentResults:new Map(),selectedBuyerEnrichment:new Set(),buyerCompanyRemovalPending:new Set(),buyerCompanySavePending:new Set(),buyerCompanySaved:()=>false,crmAuthenticated:()=>true,candidateBuyerRoles:()=>candidate.buyerRoles,personKey:(c,p)=>p.id,selectedBuyerKey:(c,p)=>p.id,linkedInSearchUrl:()=>'',buyerQualificationHtml:()=>'<p>Current role supported</p>',buyerContactRows:()=>'<div>Company email: not confirmed</div>',enrichmentResultHtml:()=>'',prospectContactControls:()=>'<button>Find email</button>',buyerResearchProgressHtml:()=>'<p role="status">Researching decision-makers…</p>',buyerQualitySupervisorHtml:()=>'<section class="buyer-quality-supervisor">Buyer quality · Needs attention</section>',companyContactDossierHtml:()=>'<details class="company-contact-dossier"><summary>All company contacts</summary></details>',buyerProviderStatusHtml:()=>'<p>Research incomplete</p>',buyerResearchAccountabilityHtml:()=>'<details><summary>Research accountability</summary></details>'};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function buyerActionIdentity('),source.indexOf('function captureBuyerAction(')),ctx);vm.runInContext(source.slice(source.indexOf('function renderSelectedProspects('),source.indexOf('function renderPipeline(')),ctx);
 const rows=Array.from({length:companies},(_,i)=>i?{...structuredClone(candidate),domain:`company${i}.example`,company:`Company ${i}`} :candidate);
 ctx.buyerSelectionRows=()=>[...rows].sort((a,b)=>Number(b.domain===meta.activeBuyerCompanyDomain)-Number(a.domain===meta.activeBuyerCompanyDomain));
 const dom=new JSDOM('<div id="customer-pipeline"></div>'),doc=dom.window.document;ctx.document=doc;ctx.$=id=>doc.getElementById(id);
 ctx.renderPipeline=()=>{doc.getElementById('customer-pipeline').innerHTML=ctx.renderSelectedProspects(ctx.buyerSelectionRows());};
 vm.runInContext(source.slice(source.indexOf('function focusBuyerCompany('),source.indexOf('function rememberSelectedProspect(')),ctx);
 vm.runInContext(source.slice(source.indexOf('function buyerControlTargetCurrent('),source.indexOf('async function withBuyerControlFocus(')),ctx);
 vm.runInContext(source.split('\n').find(line=>line.includes('$("customer-pipeline")?.addEventListener("click"')),ctx);
 ctx.renderPipeline();return {dom,doc,candidate,ctx,rows,meta:()=>meta};
}
test('company actions are in the header beneath qualification, followed by dossier and four contacts',()=>{
 const {dom,doc}=render(),card=doc.querySelector('.selected-prospect-row'),header=card.querySelector('header');
 assert.ok(header.contains(doc.querySelector('.selected-prospect-actions')),'actions belong in company header');
 assert.equal(doc.querySelector('.selected-prospect-signal').nextElementSibling.className,'selected-prospect-actions');
 assert.equal(header.nextElementSibling.classList.contains('company-dossier'),true);
 assert.equal(header.nextElementSibling.nextElementSibling.classList.contains('company-contact-dossier'),true);
 assert.equal(header.nextElementSibling.nextElementSibling.nextElementSibling.classList.contains('selected-prospect-buyers'),true);
 assert.equal(doc.querySelector('.selected-prospect-buyers > .buyer-shortlist-group > ol').children.length,4);
 assert.equal(doc.querySelector('.selected-prospect-buyers').querySelector('.buyer-quality-supervisor'),null);dom.window.close();
});
test('held contacts stay collapsed and the four-contact shortfall keeps research recovery actionable',()=>{
 const {dom,doc}=render({rolesChanged:true}),buyers=doc.querySelector('.selected-prospect-buyers');
 assert.equal(buyers.querySelectorAll(':scope > .buyer-shortlist-group > .selected-prospect-people > li').length,0);
 assert.match(buyers.querySelector('.buyer-shortlist-gap').textContent,/0\/4 priority buyers with confirmed contact data/);assert.equal(buyers.querySelector('.buyer-other-contacts').open,false);assert.equal(buyers.querySelectorAll('.buyer-potential-list > li').length,6);
 const resume=doc.querySelector('.selected-prospect-company [data-find-prospect-buyers]');assert.equal(resume.disabled,false);assert.equal(resume.dataset.findProspectBuyers,'example.com');
 dom.window.close();
});
test('other contacts and research controls start collapsed below priority contacts without losing evidence',()=>{
 const {dom,doc}=render(),other=doc.querySelector('details.buyer-other-contacts'),research=doc.querySelector('details.buyer-research-details');
 assert.ok(other,'remaining candidates have a single disclosure');assert.equal(other.open,false);assert.match(other.querySelector('summary').textContent,/Show other contacts \(2\)/);
 assert.equal(other.querySelectorAll('.buyer-potential-list > li').length,2);assert.ok(research);assert.equal(research.open,false);
 assert.ok(research.querySelector('[data-prospect-buyer-roles]'));assert.ok(research.querySelector('.buyer-quality-supervisor'));assert.equal(research.querySelector('.company-contact-dossier'),null);assert.equal(doc.querySelector('.company-contact-dossier').parentElement,doc.querySelector('.selected-prospect-row'));
 assert.equal(doc.querySelectorAll('[data-find-prospect-buyers]').length,1);assert.equal(doc.querySelectorAll('[data-save-buyer-research]').length,1);assert.equal(doc.querySelectorAll('[data-remove-buyer-company]').length,1);
 dom.window.close();
});
test('only confirmed relevant contacts occupy the main list, with a truthful shortfall below four',()=>{
 for(const ids of [[],['2'],['2','3'],['0','1','2','3','4','5']]){
  const {dom,doc}=render({confirmedIds:ids}),buyers=doc.querySelector('.selected-prospect-buyers'),main=buyers.querySelectorAll(':scope > .buyer-shortlist-group > .selected-prospect-people > li');
  assert.equal(main.length,Math.min(4,ids.length));
  const other=buyers.querySelector('.buyer-other-contacts');assert.equal(other.open,false);assert.equal(other.querySelectorAll('.buyer-potential-list > li').length,6-main.length);
  for(const card of main)assert.ok(ids.some(id=>card.textContent.includes('Anna Buyer'+id)));
  if(ids.length<4)assert.match(buyers.querySelector('.buyer-shortlist-gap').textContent,new RegExp(ids.length+'/4 priority buyers with confirmed contact data'));else assert.equal(buyers.querySelector('.buyer-shortlist-gap'),null);
  dom.window.close();
 }
});
test('dossier preview has at most three findings and full evidence and provider details expand',()=>{
 const {dom,doc}=render(),dossier=doc.querySelector('.company-dossier'),full=dossier.querySelector(':scope > details');
 assert.equal(dossier.querySelector('.company-message-brief details > ul').children.length,3);assert.equal(full.open,false);
 assert.match(full.textContent,/Company finding 4/);assert.match(full.textContent,/OpenAI/);assert.match(full.textContent,/Gemini/);dom.window.close();
});
test('empty and active searches retain primary Refresh action and visible next step',()=>{
 for(const options of [{empty:true},{empty:true,loading:true}]){const {dom,doc}=render(options);assert.ok(doc.querySelector('.selected-prospect-company [data-find-prospect-buyers]'));assert.match(doc.querySelector('.selected-prospect-row').textContent,options.loading?/Researching decision-makers/:/Research not started/);dom.window.close();}
});

test('Show confirmed contact opens the enclosing other-contacts disclosure',()=>{
 const {dom,doc}=render(),row=doc.querySelector('.selected-prospect-row'),other=doc.querySelector('.buyer-other-contacts');
 row.insertAdjacentHTML('beforeend','<button data-show-confirmed-buyers>Show confirmed contact</button>');
 const target=other.querySelector('.buyer-potential-list > li > details');target.insertAdjacentHTML('beforeend','<button data-prospect-enrich-email aria-pressed="true">Confirmed</button>');
 const ctx={buyerCardLayouts:new WeakMap(),buyerRecheckLayouts:new WeakSet(),$:()=>row,document:doc};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function buyerControlTargetCurrent('),source.indexOf('async function withBuyerControlFocus(')),ctx);vm.runInContext(source.split('\n').find(line=>line.includes('$("customer-pipeline")?.addEventListener("click"')),ctx);
 row.querySelector('[data-show-confirmed-buyers]').click();assert.equal(target.open,true);assert.equal(other.open,true);dom.window.close();
});
test('active decision-maker research appears once above the dossier',()=>{
 const {doc}=render({loading:true,empty:true}),header=doc.querySelector('.selected-prospect-company');assert.match(header.nextElementSibling.textContent,/Researching decision-makers/);assert.ok(header.nextElementSibling.nextElementSibling.classList.contains('company-dossier'));assert.equal([...doc.querySelectorAll('[role="status"]')].filter(el=>el.textContent==='Researching decision-makers…').length,1);
});

test('selected Recheck preserves other card positions and recommendation badges when the selected score changes',()=>{
 const r=render(),cards=[...r.doc.querySelectorAll('.selected-prospect-person')],before=cards.filter(n=>!n.textContent.includes('Anna Buyer0')).map(n=>n.outerHTML);
 r.ctx.buyerRecheckLayouts.add(r.candidate);r.candidate.people[0].buyerRelevanceScore=1;r.candidate.people[0].title='Operations Director';
 const next=new JSDOM(r.ctx.renderSelectedProspects([r.candidate]));assert.deepEqual([...next.window.document.querySelectorAll('.selected-prospect-person')].filter(n=>!n.textContent.includes('Anna Buyer0')).map(n=>n.outerHTML),before);next.window.close();r.dom.window.close();
});


test('company pages render ten companies and only the chosen full dossier without changing retained research',()=>{
 const r=render({companies:23}),before=JSON.stringify(r.rows);
 assert.equal(r.doc.querySelectorAll('[data-buyer-company]').length,10);
 assert.equal(r.doc.querySelectorAll('[data-buyer-company-expanded]').length,1);
 assert.equal(r.doc.querySelectorAll('.company-dossier').length,1);
 assert.equal(r.doc.querySelectorAll('.buyer-company-collapsed').length,9);
 assert.equal(r.doc.querySelector('.buyer-company-collapsed .selected-prospect-people'),null);
 r.doc.querySelector('[data-buyer-company-page="1"]').click();
 assert.equal(r.doc.querySelectorAll('[data-buyer-company]').length,10);
 assert.equal(r.doc.querySelectorAll('.company-dossier').length,0);
 assert.match(r.doc.querySelector('[data-buyer-company-pagination]').textContent,/11–20 of 23/);
 r.doc.querySelector('[data-buyer-company-page="2"]').click();
 assert.equal(r.doc.querySelectorAll('[data-buyer-company]').length,3);
 assert.equal(r.doc.querySelector('[data-buyer-company-page="3"]').disabled,true);
 assert.equal(JSON.stringify(r.rows),before);r.dom.window.close();
});
test('opening a past company expands it alone, survives restored view state and makes no research requests',()=>{
 const r=render({companies:23}),before=JSON.stringify(r.rows);
 for(const name of ['findPotentialDecisionMakers','findPublicProspectContacts','saveDiscovery'])r.ctx[name]=()=>assert.fail('Opening a saved company must not run '+name);
 r.doc.querySelector('[data-buyer-company-page="1"]').click();
 r.doc.querySelector('[data-open-buyer-company="company12.example"]').click();
 assert.equal(r.doc.querySelector('[data-buyer-company-expanded]').dataset.buyerCompany,'company12.example');
 assert.equal(r.doc.querySelectorAll('.company-dossier').length,1);
 assert.equal(r.doc.querySelectorAll('[data-buyer-company]').length,10);
 assert.ok(r.doc.querySelector('[data-open-buyer-company="example.com"]'));
 assert.equal(r.meta().buyerCompanyPage,0);assert.equal(r.doc.activeElement.tagName,'H4');
 assert.equal(JSON.stringify(r.rows),before);
 const restored=render({companies:23,meta:JSON.parse(JSON.stringify(r.meta()))});
 assert.equal(restored.doc.querySelector('[data-buyer-company-expanded]').dataset.buyerCompany,'company12.example');
 assert.equal(r.ctx.openBuyerCompany('unselected.example'),false);
 assert.equal(r.ctx.changeBuyerCompanyPage(-1),false);assert.equal(r.ctx.changeBuyerCompanyPage(2.5),false);assert.equal(r.ctx.changeBuyerCompanyPage(3),false);
 restored.dom.window.close();r.dom.window.close();
});
test('company pagination clamps after removals and hides controls for ten or fewer',()=>{
 for(const companies of [1,10,11]){const r=render({companies,meta:{buyerCompanyPage:99}});assert.equal(r.doc.querySelectorAll('[data-buyer-company]').length,companies===11?1:companies);assert.equal(Boolean(r.doc.querySelector('[data-buyer-company-pagination]')),companies>10);r.dom.window.close();}
});
test('collapsed company summaries retain active research and error visibility',()=>{
 const r=render({companies:3});r.rows[1].peopleStatus='loading';r.rows[2].peopleStatus='error';r.ctx.renderPipeline();
 assert.match(r.doc.querySelector('[data-open-buyer-company="company1.example"]').textContent,/Research in progress/);
 assert.match(r.doc.querySelector('[data-open-buyer-company="company2.example"]').textContent,/Research needs attention/);r.dom.window.close();
});
