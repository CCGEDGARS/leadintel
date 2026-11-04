const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),Dossier=require('../company-dossier.js'),UI=require('../company-dossier-ui.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function render({empty=false,loading=false,rolesChanged=false,confirmedIds=['0','1','2','3']}={}){
 const people=Array.from({length:6},(_,i)=>({id:String(i),name:`Anna Buyer${i}`,title:i===0?'CEO':i===1?'COO':i===2?'Procurement Director':'Operations Director',organization:'Example',publicNameUrl:'https://example.com/team',emailResearch:{status:'complete',searches:3,failed:0,checkedAt:new Date().toISOString()}}));
 const facts=Array.from({length:5},(_,i)=>({text:`Company finding ${i}`,quote:`Company finding ${i}`,sourceUrl:'https://example.com/news'}));
 const dossier=Dossier.reconcile(['openai','gemini'].map(provider=>({provider,webSearch:true,status:'complete',facts,people:[],channels:[],sources:['https://example.com/news'],extractedSources:['https://example.com/news'],gaps:[]})),{company:'Example',domain:'example.com'});
 const candidate={domain:'example.com',company:'Example',buyerSearchMode:'user_selected_qualified',people:empty?[]:people,peopleStatus:loading?'loading':'complete',buyerRolesChanged:rolesChanged,buyerRoles:['Executive leadership','Procurement Director','Operations Director'],buyerDiscovery:{companyDossier:dossier,checkedAt:new Date().toISOString(),found:6}};
 const ctx={buyerCardLayouts:new WeakMap(),buyerRecheckLayouts:new WeakSet(),bridge:()=>null,verifiedBuyerEmail:(_candidate,person)=>confirmedIds.includes(person.id)?person.id+'@example.com':'',window:{LeadIntelCompanyDossierUi:UI},LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,esc:v=>String(v??''),mainState:()=>({}),loadMeta:()=>({}),enrichmentResults:new Map(),selectedBuyerEnrichment:new Set(),buyerCompanyRemovalPending:new Set(),buyerCompanySavePending:new Set(),buyerCompanySaved:()=>false,crmAuthenticated:()=>true,candidateBuyerRoles:()=>candidate.buyerRoles,personKey:(c,p)=>p.id,selectedBuyerKey:(c,p)=>p.id,linkedInSearchUrl:()=>'',buyerQualificationHtml:()=>'<p>Current role supported</p>',buyerContactRows:()=>'<div>Company email: not confirmed</div>',enrichmentResultHtml:()=>'',prospectContactControls:()=>'<button>Find email</button>',buyerResearchProgressHtml:()=>'<p role="status">Researching decision-makers…</p>',buyerQualitySupervisorHtml:()=>'<section class="buyer-quality-supervisor">Buyer quality · Needs attention</section>',companyContactDossierHtml:()=>'<details class="company-contact-dossier"><summary>All company contacts</summary></details>',buyerProviderStatusHtml:()=>'<p>Research incomplete</p>',buyerResearchAccountabilityHtml:()=>'<details><summary>Research accountability</summary></details>'};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function buyerActionIdentity('),source.indexOf('function captureBuyerAction(')),ctx);vm.runInContext(source.slice(source.indexOf('function renderSelectedProspects('),source.indexOf('function renderPipeline(')),ctx);
 const dom=new JSDOM(ctx.renderSelectedProspects([candidate]));return {dom,doc:dom.window.document,candidate,ctx};
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
 assert.match(buyers.querySelector('.buyer-shortlist-gap').textContent,/0\/4 confirmed contacts ready/);assert.equal(buyers.querySelector('.buyer-other-contacts').open,false);assert.equal(buyers.querySelectorAll('.buyer-potential-list > li').length,6);
 const resume=buyers.querySelector('.buyer-public-summary button');assert.equal(resume.disabled,false);assert.equal(resume.dataset.findProspectBuyers,'example.com');
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
  if(ids.length<4)assert.match(buyers.querySelector('.buyer-shortlist-gap').textContent,new RegExp(ids.length+'/4 confirmed contacts ready'));else assert.equal(buyers.querySelector('.buyer-shortlist-gap'),null);
  dom.window.close();
 }
});
test('dossier preview has at most three findings and full evidence and provider details expand',()=>{
 const {dom,doc}=render(),dossier=doc.querySelector('.company-dossier'),full=dossier.querySelector(':scope > details');
 assert.equal(dossier.querySelector('.company-message-brief > ul').children.length,3);assert.equal(full.open,false);
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
