const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
const esc=value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function runtime(){
 const person={id:'anna',name:'Anna Smith',title:'Head of Procurement',organization:'Example',publicNameUrl:'https://linkedin.com/in/anna-smith',publicLinkedinUrl:'https://linkedin.com/in/anna-smith',roleReview:{status:'supported',reason:'Official leadership page confirms current role'},contactResearch:{checks:{direct_email:{status:'complete'},gmail:{status:'complete',queryLog:[1,2,3].map(i=>({status:'complete',query:`Gmail business query ${i}`}))}},channels:{company:{status:'complete'},phone:{status:'partial',reason:'Phone request timed out'}}}};
 const candidate={domain:'example.com',company:'Example',buyerSearchMode:'user_selected_qualified',people:[person],peopleStatus:'complete',publicContactStatus:'complete',buyerRoles:['Head of Procurement'],publicResearch:{checkedAt:'2026-10-21T10:00:00Z',officialPages:2,patternSearches:4}};
 const ctx={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,esc,emailPatternCandidates:D.rankedEmailGuesses,mainState:()=>({}),enrichmentResults:new Map(),personKey:(_c,p)=>p.id,verifiedBuyerEmail:()=>'',candidateBuyerRoles:c=>c.buyerRoles,crmAuthenticated:()=>true,window:{},selectedBuyerEnrichment:new Set(),buyerCompanyRemovalPending:new Set(),buyerCompanySavePending:new Set(),buyerCompanySaved:()=>false,selectedBuyerKey:(_c,p)=>p.id,linkedInSearchUrl:()=>'',enrichmentResultHtml:()=>'',prospectContactControls:()=>'',buyerResearchProgressHtml:()=>'',buyerQualitySupervisorHtml:()=>'',companyContactDossierHtml:()=>'',buyerProviderStatusHtml:()=>'',buyerResearchAccountabilityHtml:()=>''};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function buyerActionIdentity('),source.indexOf('function captureBuyerAction(')),ctx);
 for(const [start,end] of [['function buyerContactRows(','function emailPatternCandidates('],['function buyerQualificationHtml(','function hydratePublishedCompanyEmails('],['function publicResearchOutcome(','function buyerResearchIncomplete('],['function renderSelectedProspects(','function renderPipeline(']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),ctx);
 return {ctx,person,candidate};
}
function documentFor(html){return new JSDOM(html).window.document;}
function visibleText(element){const copy=element.cloneNode(true);copy.querySelectorAll('details:not([open])').forEach(details=>{const summary=details.querySelector('summary');details.replaceChildren(summary);});return copy.textContent;}
test('contact fields expose concise found, not-found and incomplete states with source reasons available on demand',()=>{
 const {ctx,person,candidate}=runtime(),doc=documentFor(ctx.buyerContactRows(person,candidate));
 const linkedin=doc.querySelector('[data-contact-channel="linkedin"]');assert.ok(linkedin,'LinkedIn is a labelled channel');assert.equal(linkedin.dataset.contactStatus,'found');
 assert.equal(linkedin.querySelector('a').href,'https://linkedin.com/in/anna-smith');assert.match(linkedin.querySelector('a').textContent,/View profile/);
 for(const channel of ['company','gmail']){const field=doc.querySelector(`[data-contact-channel="${channel}"]`);assert.equal(field.dataset.contactStatus,'not_found');assert.match(visibleText(field),/Not found/);assert.doesNotMatch(visibleText(field),/No .* found in completed searches/);}
 const phone=doc.querySelector('[data-contact-channel="phone"]');assert.equal(phone.dataset.contactStatus,'incomplete');assert.match(visibleText(phone),/Checks incomplete/);assert.doesNotMatch(visibleText(phone),/Phone request timed out/);assert.match(phone.querySelector('details').textContent,/Phone request timed out/);
 assert.equal(doc.querySelectorAll('.buyer-contact-fields > div').length,4);
});
test('unsearched and running channels cannot be mistaken for a completed not-found result',()=>{
 const {ctx,person,candidate}=runtime();person.contactResearch={checks:{gmail:{status:'running'}},channels:{company:{status:'not_searched'},phone:{status:'running'}}};person.publicLinkedinUrl='';
 const doc=documentFor(ctx.buyerContactRows(person,candidate));
 assert.equal(doc.querySelector('[data-contact-channel="company"]').dataset.contactStatus,'not_searched');assert.match(visibleText(doc.querySelector('[data-contact-channel="company"]')),/Not checked/);
 for(const key of ['gmail','phone']){const field=doc.querySelector(`[data-contact-channel="${key}"]`);assert.equal(field.dataset.contactStatus,'running');assert.match(visibleText(field),/Searching/);}
 assert.equal(doc.querySelector('[data-contact-channel="linkedin"]').querySelector('a'),null);assert.equal(doc.querySelector('[data-contact-channel="linkedin"]').dataset.contactStatus,'not_searched');
});
test('qualification keeps priority and research status compact while role and authority evidence start collapsed',()=>{
 const {ctx,person,candidate}=runtime(),doc=documentFor(ctx.buyerQualificationHtml(candidate,person));
 assert.equal(doc.body.querySelectorAll(':scope > .buyer-authority,:scope > .buyer-research-status,:scope > .buyer-role-evidence').length,0);
 const details=doc.querySelector('.buyer-qualification');assert.equal(details.open,false);assert.match(details.querySelector('summary').textContent,/Priority/);assert.match(details.querySelector('summary').textContent,/Research/);
 assert.match(details.textContent,/purchasing authority unconfirmed/);assert.match(details.textContent,/Official leadership page confirms current role/);
});
test('company research summary shows incomplete checks and a usable existing resume action above the shortlist',()=>{
 const {ctx,candidate}=runtime(),doc=documentFor(ctx.renderSelectedProspects([candidate]));
 const summary=doc.querySelector('.buyer-public-summary');assert.ok(summary,'one visible company-level research summary');assert.equal(doc.querySelectorAll('.buyer-public-summary').length,1);
 assert.match(summary.textContent,/Public research/);assert.match(summary.textContent,/incomplete|needs checking/i);assert.equal(summary.querySelector('[data-find-public-contacts]').textContent,'Resume incomplete checks');
 assert.ok(summary.compareDocumentPosition(doc.querySelector('.buyer-shortlist-group'))&4);
 assert.doesNotMatch(doc.querySelector('.selected-prospect-buyers').innerHTML,/Contact research incomplete\. Review individual contact status before proceeding/);
});
test('saved research summary preserves actual progress and the recorded cancellation gap',()=>{
 const {ctx,candidate}=runtime();candidate.publicResearch.accountability={...D.createBuyerResearchAccountability(),status:'partial',checkedPeople:5,totalPeople:10,officialPages:17,reusedChecks:23,stopReason:'canceled',gaps:['Research canceled','5 retained identities have unfinished checks']};
 const summary=documentFor(ctx.renderSelectedProspects([candidate])).querySelector('.buyer-public-summary');
 assert.match(summary.textContent,/5\/10 buyers checked/);assert.match(summary.textContent,/17 official pages read/);assert.match(summary.textContent,/Research canceled/);assert.equal(summary.querySelector('button').textContent,'Resume incomplete checks');
});
test('a selected-buyer batch is labelled so one checked person cannot look like full company coverage',()=>{
 const {ctx,candidate}=runtime();candidate.people.push({...candidate.people[0],id:'bob',name:'Bob Buyer'});candidate.publicResearch.researchScope='selected_buyers';candidate.publicResearch.accountability={...D.createBuyerResearchAccountability(),status:'partial',checkedPeople:1,totalPeople:1};
 const summary=documentFor(ctx.renderSelectedProspects([candidate])).querySelector('.buyer-public-summary');assert.match(summary.textContent,/Latest batch: 1\/1 buyers checked/);
});
test('Resume uses the same current research-coverage decision as its label, retaining completed email checks',()=>{
 for(const coveragePassed of [false,true]){
  const candidate={domain:'example.com',people:[{id:'anna',emailResearch:{status:'complete'}}]};let handler,request;
  const context={$:()=>({addEventListener:(_name,fn)=>{handler=fn;}}),LeadIntelDiscovery:{...D,buyerResearchCoveragePassed:()=>coveragePassed},canonicalDomain:D.canonicalDomain,selectedProspects:()=>[candidate],findPublicProspectContacts:(domain,options)=>{request={domain,options};}};
  vm.runInNewContext(source.slice(source.indexOf('function buyerControlTargetCurrent('),source.indexOf('async function withBuyerControlFocus(')),context);
  vm.runInNewContext(source.split('\n').find(line=>line.includes('$("customer-pipeline")?.addEventListener("click"')),context);
  const button={disabled:false,dataset:{findPublicContacts:'example.com'},hasAttribute:()=>false};handler({target:{closest:()=>button}});assert.equal(request.domain,candidate.domain);assert.equal(request.options.force,coveragePassed);
 }
});

test('research summary uses person and page coverage without turning capped search totals into execution claims',()=>{
 const {ctx,candidate}=runtime();candidate.publicResearch.patternSearches=0;
 let summary=documentFor(ctx.renderSelectedProspects([candidate])).querySelector('.buyer-public-summary');assert.doesNotMatch(summary.textContent,/0 (?:email|public) searches/);
 candidate.publicResearch.patternSearches=37;summary=documentFor(ctx.renderSelectedProspects([candidate])).querySelector('.buyer-public-summary');assert.doesNotMatch(summary.textContent,/(?:email|public) searches/);assert.match(summary.textContent,/official pages read/);
});

test('standalone contact resume starts at contact evidence without claiming to re-identify all people',()=>{
 const {ctx}=runtime();vm.runInContext(source.slice(source.indexOf('function buyerResearchProgressHtml('),source.indexOf('async function findExecutiveBuyer(')),ctx);
 const doc=documentFor(ctx.buyerResearchProgressHtml({peopleStatus:'complete',publicContactStatus:'loading'}));assert.match(doc.querySelector('.buyer-research-progress-head').textContent,/Checking public contact evidence/);assert.equal(doc.querySelector('li.active').textContent.trim(),'5Contact evidence');assert.match(doc.querySelector('.buyer-research-progress-head b').textContent,/Stage 5 of 5/);
 const discovery=documentFor(ctx.buyerResearchProgressHtml({peopleStatus:'loading',publicContactStatus:'loading'}));assert.equal(discovery.querySelector('li.active').textContent.trim(),'1Verify company');
});

test('paid phone error overrides an older completed public search without claiming not found',()=>{
 const {ctx,person,candidate}=runtime();person.contactResearch.channels.phone={status:'complete'};
 person.contactData={version:1,domain:candidate.domain,personId:person.id,identityName:person.name,status:'partial',phone:{status:'error',reason:'Treg usage limit reached.'}};
 const doc=documentFor(ctx.buyerContactRows(person,candidate)),field=doc.querySelector('[data-contact-channel="phone"]');assert.equal(field.dataset.contactStatus,'incomplete');assert.match(field.textContent,/Treg usage limit/);assert.doesNotMatch(visibleText(field),/Not found/);
});
test('retained same-identity paid phone is visible even when CRM contact lacks phone_number',()=>{
 const {ctx,person,candidate}=runtime();person.contactData={version:1,domain:candidate.domain,personId:person.id,identityName:person.name,phone:{status:'provider_listed',number:'+37120000001',source:'Treg'}};
 let doc=documentFor(ctx.buyerContactRows(person,candidate)),field=doc.querySelector('[data-contact-channel="phone"]');assert.match(field.textContent,/\+37120000001/);assert.equal(field.dataset.contactStatus,'found');assert.doesNotMatch(field.textContent,/Provider verified/);
 person.contactData.identityName='Someone Else';doc=documentFor(ctx.buyerContactRows(person,candidate));assert.doesNotMatch(doc.querySelector('[data-contact-channel="phone"]').textContent,/\+37120000001/);
});
test('legacy paid-contact hold cannot look like a completed phone search',()=>{
 const {ctx,person,candidate}=runtime();person.contactResearch.channels.phone={status:'complete'};person.contactVerification={status:'error',checkedAt:'2026-10-28T10:00:00Z',issues:['Treg · error: Additional-services lookup limit reached or approval was revoked']};
 const field=documentFor(ctx.buyerContactRows(person,candidate)).querySelector('[data-contact-channel="phone"]');assert.equal(field.dataset.contactStatus,'incomplete');assert.match(field.textContent,/blocked|needs review/i);assert.doesNotMatch(visibleText(field),/Not found/);
});
