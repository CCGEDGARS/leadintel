const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
test('legacy accepted count remains unknown while measured zero stays zero on reload',()=>{
 for(const accepted of [undefined,0,2]){
 const result=D.normalizeDiscoveryState({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerDiscovery:{researchVersion:'v1',providerStatus:{firecrawl:{status:'complete',results:8,...(accepted===undefined?{}:{accepted})}}}}]}).selectedProspects[0];
 assert.equal(result.buyerDiscovery.providerStatus.firecrawl.accepted,accepted??null);assert.equal(result.buyerDiscovery.researchVersion,'v1');
 }
});
test('per buyer completed and incomplete email research survives selected, pool and candidate reload',()=>{
 const person={name:'Anna Andersson',emailResearch:{status:'partial',searches:5,failed:1,checkedAt:'2026-10-04T09:00:00Z'}};
 const row={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[person],buyerDiscovery:{pool:[person]}};
 const state=D.normalizeDiscoveryState({selectedProspects:[row],candidates:[row]});
 assert.equal(state.selectedProspects[0].people[0].emailResearch.status,'partial');assert.equal(state.selectedProspects[0].buyerDiscovery.pool[0].emailResearch.searches,5);assert.equal(state.selectedProspects[0].people[0].emailResearch.failed,1);
});
test('email research distinguishes attempted partial, completed and skipped identities',async()=>{
 for(const fail of [false,true]){
 const person={name:'Anna Andersson'},candidate={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[person]};
 const context={LeadIntelDiscovery:D,Date,URL,canonicalDomain:D.canonicalDomain,crmAuthenticated:()=>false,searchBuyerPublicPages:async()=>{if(fail)throw new Error('provider unavailable');return [];}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function emailPatternCandidates('),source.indexOf('function hunterStatusLabel('))+source.slice(source.indexOf('function patternListings('),source.indexOf('async function groundedBuyerFollowUp(')),context);
 await context.searchBuyerEmailPatterns(candidate,[],new AbortController().signal);
 assert.equal(person.emailResearch.status,fail?'unavailable':'complete');assert.equal(person.emailResearch.searches,5);assert.equal(person.emailResearch.failed,fail?5:0);
 candidate.people=[{name:'Anna'}];await context.searchBuyerEmailPatterns(candidate,[],new AbortController().signal);assert.equal(candidate.people[0].emailResearch.status,'not_searched');
 }
});
test('public traces retain actual provider provenance',()=>{
 const trace=D.tracePublicBuyers([{buyerSource:'grounded',url:'https://linkedin.com/in/anna',title:'Anna Andersson | Procurement Director | Example'}],'Example',{decisionMakers:'Procurement Director'});
 assert.equal(trace.diagnostics[0].source,'grounded');assert.equal(trace.diagnostics[0].accepted,true);
});

test('localized current employer snippets and title suffixes resolve without accepting former or wrong employers',()=>{
 const rows=[
 {url:'https://se.linkedin.com/in/ulrik',title:'Ulrik Gren – Projektledare LKAB - LinkedIn',description:'Ulrik Gren. Projektledare LKAB.'},
 {url:'https://se.linkedin.com/in/helena',title:'Helena Oja – Projektledare - LinkedIn',description:'Projektledare · Erfarenhet: LKAB · Utbildning: School'},
 {url:'https://se.linkedin.com/in/other',title:'Anna Other – Projektledare - LinkedIn',description:'Projektledare · Erfarenhet: Boliden · LKAB customer'},
 {url:'https://se.linkedin.com/in/former',title:'Anna Former – Tidigare projektledare LKAB - LinkedIn'}
 ];
 const trace=D.tracePublicBuyers(rows,'LKAB',{decisionMakers:'Project Manager'});
 assert.deepEqual(trace.people.map(p=>p.name).sort(),['Helena Oja','Ulrik Gren']);assert.equal(trace.diagnostics[2].accepted,false);assert.equal(trace.diagnostics[3].accepted,false);
});

test('role coverage reports missing buying functions instead of treating project-only results as complete coverage',()=>{
 const ctx={LeadIntelDiscovery:D};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function buyerRoleCoverage('),source.indexOf('function buyerProviderStatusHtml(')),ctx);
 const coverage=ctx.buyerRoleCoverage({buyerDiscovery:{opportunityRoles:['Procurement Director','Project Manager','Engineering Director'],pool:[{name:'Anna Andersson',title:'Projektledare',publicNameUrl:'https://example.com/team/anna'}]}});
 assert.deepEqual(Array.from(coverage.missing),['Procurement / sourcing','Engineering']);assert.deepEqual(Array.from(coverage.covered),['Projects']);
});
