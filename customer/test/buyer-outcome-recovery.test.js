const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),Dossier=require('../company-dossier.js'),fixture=require('./fixtures/viscaria-public-buyer-pages.json');
test('job titles cannot become buyer names or enter a saved buyer pool',()=>{
 for(const name of ['Chief Executive Officer','Chief Operating Officer','Head of Procurement','Managing Director','Senior Vice President','Board Member'])assert.equal(D.hasFullBuyerName(name),false,name);
 for(const name of ['Robert Åkerlind','Jörgen Olsson','Charlotte Odenberger','Anna Tyni','Alex Head'])assert.equal(D.hasFullBuyerName(name),true,name);
 const pool=D.mergeBuyerPool([],[{id:'bad',name:'Chief Executive Officer',title:'Chief Executive Officer since 2023',organization:'Example',publicNameUrl:'https://example.com/team',identityStatus:'confirmed'}],{decisionMakers:'CEO'});assert.equal(pool.length,0);
});
test('official management pages yield real names rather than adjacent title headings',()=>{
 const rows=fixture.pages.map(p=>({...p,sourceRead:true})),profile={companyDomain:'viscaria.com',decisionMakers:'CEO; COO; Head of Procurement'};
 const people=D.tracePublicBuyers(rows,'Viscaria',profile).people;
 assert.ok(people.some(p=>p.name==='Jörgen Olsson'));assert.ok(people.some(p=>p.name==='Charlotte Odenberger'));assert.ok(people.every(p=>!/^Chief /i.test(p.name)));
 const contacts=D.discoverCompanyContacts(rows,{company:'Viscaria',domain:'viscaria.com'}),robert=contacts.find(p=>p.name==='Robert Åkerlind');assert.equal(robert.publicEmail,'robert.akerlind@viscaria.com');assert.match(robert.publicPhone,/76/);assert.equal(D.acceptedOfficialBuyerEmail({company:'Viscaria',domain:'viscaria.com'},robert),robert.publicEmail);
});
test('navigation fragments cannot become verified commercial facts',()=>{
 const url='https://example.com/news',quote='Read more about the project’s development, key milestones and the road ahead.';
 const result=Dossier.validatePass({provider:'openai',webSearch:true,facts:[{text:quote,quote,sourceUrl:url}],people:[],channels:[]},[{url,text:quote}],{company:'Example',domain:'example.com'});assert.equal(result.facts.length,0);
});
test('accommodation contacts remain sourced contacts but require purchasing-scope review',()=>{
 const candidate={company:'Example',domain:'example.com'},person={name:'Sandra Hjelm',title:'Site Manager',publicName:'Sandra Hjelm',publicNameUrl:'https://example.com/village'};
 const row={url:person.publicNameUrl,sourceRead:true,markdown:'### Sandra Hjelm\n\nSite Manager\n\n[sandra@vendor.com](mailto:sandra@vendor.com)\n\nFor room bookings or use of the service building, please contact reservations@vendor.com.\n\n### Alex Lind\n\nProcurement Director'};
 const scoped=D.matchBuyerScopeEvidence(person,[row],candidate);assert.equal(scoped.opportunityScope?.status,'review_required');
 assert.equal(D.matchBuyerScopeEvidence({...person,name:'Alex Lind',publicName:'Alex Lind',title:'Procurement Director'},[row],candidate).opportunityScope,undefined);
 assert.equal(D.matchBuyerScopeEvidence(person,[{...row,sourceRead:false}],candidate).opportunityScope,undefined);
 assert.equal(D.matchBuyerScopeEvidence(person,[{...row,url:'https://other.com/village'}],candidate).opportunityScope,undefined);
 const actual=require('./fixtures/accommodation-service-contact.json'),contacts=D.discoverCompanyContacts([{...actual,sourceRead:true}],{company:'Viscaria',domain:'viscaria.com'}),sandra=contacts.find(p=>p.name==='Sandra Hjelm');
 assert.ok(sandra);assert.equal(sandra.opportunityScope?.status,'review_required');assert.ok(sandra.publicPhone);
});
test('each buyer stage receives its own cancellable time budget',()=>{
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),start=source.indexOf('function armBuyerResearchDeadline('),end=source.indexOf('\n',start);let clock=0,next=0;const timers=new Map(),ctx={setTimeout:(fn,ms)=>{timers.set(++next,{fn,at:clock+ms});return next;},clearTimeout:id=>timers.delete(id)};const advance=ms=>{clock+=ms;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}};
 assert.ok(start>=0);vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);const controller=new AbortController();let timer=ctx.armBuyerResearchDeadline(controller,null,30);advance(15);timer=ctx.armBuyerResearchDeadline(controller,timer,60);advance(30);assert.equal(controller.signal.aborted,false);advance(30);assert.equal(controller.signal.aborted,true);assert.equal(controller.signal.reason.code,'BUYER_STAGE_TIMEOUT');
 assert.match(source,/timeout=armBuyerResearchDeadline\(controller,timeout,identityStageBudget\)/);assert.match(source,/timeout=armBuyerResearchDeadline\(controller,timeout,LeadIntelDiscovery.OFFICIAL_CONTACT_RESEARCH_POLICY.maxDurationMs/);
});
test('a publicly indexed exact-person profile matches without claiming a private profile read',()=>{
 const row={url:'https://se.linkedin.com/in/robert-%C3%A5kerlind-99805b46',title:'Robert Åkerlind – Head of Procurement - Viscaria - LinkedIn',description:'Robert Åkerlind · Head of Procurement - Viscaria',evidenceKind:'search_snippet'},person={id:'r',name:'Robert Åkerlind',publicName:'Robert Åkerlind',title:'Head of Procurement',organization:'Viscaria',publicNameUrl:fixture.pages[0].url};
 const result=D.matchPublicLinkedInProfiles([person],[row],'Viscaria')[0];assert.match(result.publicLinkedinUrl,/linkedin.com\/in\/robert-/);assert.equal(result.name,'Robert Åkerlind');
});
test('source-confirmed email status and exact evidence survive normalization and CRM mapping',()=>{
 const CRM=require('../crm-engine.js'),candidate={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{id:'alex',name:'Alex Lind',publicName:'Alex Lind',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team',publicEmail:'alex.lind@example.com',publicEmailUrl:'https://example.com/team',publicEmailEvidence:{version:2,url:'https://example.com/team',quote:'Alex Lind is Procurement Director at Example. alex.lind@example.com',sourceKind:'official',sourceRead:true,checkedAt:new Date().toISOString()},publicEmailSourceCheck:{status:'confirmed',email:'alex.lind@example.com',url:'https://example.com/team',checkedAt:new Date().toISOString()},contactVerification:{status:'public_confirmed',checkedAt:new Date().toISOString(),issues:[]}}]};
 const saved=D.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0],person=saved.people[0];assert.equal(person.contactVerification.status,'public_confirmed');assert.equal(person.publicEmailSourceCheck.email,person.publicEmail);assert.ok(JSON.stringify(CRM.mapDiscoveryCandidateToCrm(saved)).includes('public_confirmed'));
});
test('early public-email confirmation checks known listings without starting missing-address searches',async()=>{
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),start=source.indexOf('async function confirmResearchedPublicEmails('),end=source.indexOf('async function runPublicProspectContacts(',start),candidate={domain:'example.com',people:[{id:'known',name:'Alex Lind',title:'Procurement Director',publicEmail:'alex@example.com',publicEmailUrl:'https://example.com/team'},{id:'missing',name:'Jane Ward',title:'CEO',publicNameUrl:'https://example.com/team'}]};let confirmed=0,reads=0;
 const state={},connection={workspace:{id:'w'},session:{user:{id:'u'}}},ctx={discovery:state,bridge:()=>connection,crmAuthenticated:()=>true,LeadIntelDiscovery:{qualifyBuyer:()=>({eligible:true})},publicBuyerSource:(c,p)=>p.publicEmail?{email:p.publicEmail}:null,enrichmentResults:new Map(),personKey:(c,p)=>p.id,window:{LeadIntelContactPolicy:{accepted:()=>false}},canonicalDomain:D.canonicalDomain,scrapeOfficialContactPage:async()=>{reads++;return null;},confirmPublicBuyerSource:async(c,p)=>{confirmed++;p.publicEmailSourceCheck={status:'confirmed',email:p.publicEmail,url:p.publicEmailUrl};return true;}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);await ctx.confirmResearchedPublicEmails(candidate,new AbortController().signal,'w',()=>true,candidate,{readMissing:false});assert.equal(confirmed,1);assert.equal(reads,0);assert.equal(candidate.people[0].contactVerification.status,'public_confirmed');assert.equal(candidate.people[1].publicEmailSourceCheck,undefined);
});
