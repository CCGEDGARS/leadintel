const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),CRM=require('../crm-engine.js'),page=require('./fixtures/viscaria-public-buyer-pages.json').pages[0];
function fixture(){const candidate={company:'Viscaria',domain:'viscaria.com',buyerSearchMode:'user_selected_target'},person=D.discoverCompanyContacts([{...page,sourceRead:true}],candidate).find(p=>p.name==='Robert Åkerlind');return {candidate,person};}
test('a later same-address identity result cannot erase read official-email evidence',()=>{
 const {candidate,person}=fixture(),incoming={...person,title:'Head of Procurement / Inköpschef',publicEmailEvidence:null,publicEmailSourceCheck:null},merged=D.mergeBuyerPool([person],[incoming],{decisionMakers:'Procurement Director'})[0];
 assert.equal(D.acceptedOfficialBuyerEmail(candidate,merged),person.publicEmail);const saved=D.normalizeDiscoveryState({selectedProspects:[{...candidate,people:[merged]}]}).selectedProspects[0];assert.equal(D.acceptedOfficialBuyerEmail(saved,saved.people[0]),person.publicEmail);const snapshot=CRM.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch;assert.equal(D.acceptedOfficialBuyerEmail(saved,snapshot.buyers[0]),person.publicEmail);
});
test('changed-address and rejected-source results cannot inherit an earlier confirmation',()=>{
 const {candidate,person}=fixture();for(const change of [{publicEmail:'different@viscaria.com',publicEmailEvidence:null},{publicEmailSourceCheck:{status:'failed',email:person.publicEmail,url:person.publicEmailUrl,checkedAt:new Date().toISOString()}}]){const merged=D.mergeBuyerPool([person],[{...person,...change}],{decisionMakers:'Procurement Director'})[0];assert.equal(D.acceptedOfficialBuyerEmail(candidate,merged),'');}
});
test('an unread changed URL retains the confirmed primary binding through normalization and CRM handoff',()=>{
 const {candidate,person}=fixture(),unread='https://viscaria.com/changed',merged=D.mergeBuyerPool([person],[{...person,publicEmailUrl:unread,publicEmailEvidence:null}],{decisionMakers:'Procurement Director'})[0];
 const saved=D.normalizeDiscoveryState({selectedProspects:[{...candidate,people:[merged]}]}).selectedProspects[0],snapshot=CRM.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch;
 for(const value of [merged,saved.people[0],snapshot.buyers[0]]){
  assert.equal(value.publicEmailUrl,person.publicEmailUrl);assert.equal(value.publicEmailEvidence.url,person.publicEmailUrl);assert.equal(value.publicEmailEvidence.sourceRead,true);
  assert.notEqual(value.publicEmailSourceCheck?.url,unread);assert.equal(D.acceptedOfficialBuyerEmail(candidate,value),person.publicEmail);
 }
});
test('page progress separates new requests from already available source bodies',async()=>{
 const candidate={company:'Example',domain:'example.com'},rows=Array.from({length:30},(_,i)=>({url:`https://example.com/known/${i}`,sourceRead:true,markdown:'Example official company contact source.'})),events=[];let reads=0;
 await D.runOfficialContactResearch(candidate,{rows,search:async()=>Array.from({length:28},(_,i)=>({url:`https://example.com/contact/${i}`})),readPage:async url=>{reads++;return {url,markdown:'Example official contact page.'};},onProgress:detail=>events.push(detail)});
 assert.ok(reads<=D.OFFICIAL_CONTACT_RESEARCH_POLICY.maxPages);assert.ok(events.length);assert.ok(events.every(e=>e.pageRequests<=e.pageRequestLimit&&e.sourceBodies>=e.pageRequests));assert.ok(events.every(e=>/new page requests/.test(e.label)));
});
test('already-read sources are reported before the first pending person query finishes',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{id:'p',name:'Alex Lind',publicName:'Alex Lind',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team'}]},controller=new AbortController(),row={url:'https://example.com/team',sourceRead:true,extractedAt:new Date().toISOString(),markdown:'Alex Lind is Procurement Director at Example.'};let observed=false;
 const report=await D.runMandatoryBuyerResearch(candidate,{rows:[row],signal:controller.signal,search:async()=>{assert.equal(candidate.publicResearch.accountability.officialPages,1);observed=true;controller.abort();return [];}});assert.equal(observed,true);assert.equal(report.officialPages,1);assert.equal(report.status,'partial');
});
