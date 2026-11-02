const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),CRM=require('../crm-engine.js');

const team='https://example.com/team',blocked='https://example.com/contact/alex-blocked',current='https://example.com/contact/alex-current';
function company(names=['Alex Smith']){return {company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:names.map((name,index)=>({id:'person-'+index,name,publicName:name,title:'Procurement Director',organization:'Example',publicNameUrl:team}))};}
function results(rows){return Object.assign(rows.map(row=>({...row,searchProvider:'grounded'})),{researchTrace:[{provider:'grounded',status:'succeeded',operation:'search',results:rows.length}]});}
function source(url,markdown='Alex Smith — Procurement Director — Example\n\nJamie Brown — Procurement Director — Example'){return {url,markdown,metadata:{sourceURL:url,source:'direct-fallback'}};}
function publicQuery(query,name='Alex Smith'){return query===`"${name}" "Example" (email OR phone OR kontakt OR "@gmail.com")`;}
function unreadable(){return Object.assign(Error('Relevant source unavailable'),{researchTrace:[{provider:'direct',status:'failed',operation:'extract',reason:'Relevant source unavailable'}]});}

test('official named pages after unsupported video results complete all nine base queries and the bounded deep wave',async()=>{
 const candidate=company(['Alex Smith','Jamie Brown']),rows=[],queries=[],reads=[];
 const report=await D.runMandatoryBuyerResearch(candidate,{rows,search:async query=>{queries.push(query);return results([{url:'https://www.youtube.com/watch?v=buyer',title:'Example interview'},{url:team,title:'Alex Smith and Jamie Brown — Example procurement contacts'}]);},readPage:async url=>{reads.push(url);if(url.includes('youtube'))throw Error('Video is unreadable');return source(url);}});
 assert.equal(report.status,'complete');assert.equal(report.checkedPeople,2);assert.equal(queries.length,22);assert.deepEqual(reads,[team]);
 assert.ok(rows.some(row=>row.url.includes('youtube')),'discovered media provenance is retained');
 for(const person of candidate.people){const checks=person.contactResearch.checks;assert.equal(checks.gmail.queryLog.length,3);assert.equal(checks.direct_email.queryLog.length,2);assert.equal(checks.deep.queryLog.length,2);assert.equal(checks.public.queryLog[0].searchStatus,'complete');assert.equal(checks.public.queryLog[0].resultCount,2);assert.deepEqual(checks.public.queryLog[0].providers,['grounded']);assert.ok(checks.public.queryLog[0].sourceReads.some(row=>row.url.includes('youtube')&&row.status==='not_needed'));}
 assert.equal(report.tools.find(row=>row.provider==='grounded').succeeded,22);assert.equal(report.tools.find(row=>row.provider==='direct').succeeded,1);
});

test('a failed selected relevant page does not hide the next source or forge a completed query',async()=>{
 const candidate=company(),reads=[];
 const report=await D.runMandatoryBuyerResearch(candidate,{search:async query=>results(publicQuery(query)?[{url:blocked,title:'Alex Smith — Example contact'},{url:current,title:'Alex Smith — Example contact'}]:[]),readPage:async url=>{reads.push(url);if(url===blocked)throw unreadable();return source(url,url===current?'Alex Smith — Procurement Director — Example\nalex.smith@example.com':undefined);}});
 assert.deepEqual(reads,[team,blocked,current]);assert.equal(candidate.people[0].publicEmail,'alex.smith@example.com');
 const check=candidate.people[0].contactResearch.checks.public,receipt=check.queryLog[0];assert.equal(check.status,'partial');assert.equal(receipt.status,'partial');assert.equal(receipt.searchStatus,'complete');assert.equal(receipt.resultCount,2);assert.deepEqual(receipt.sourceReads.map(row=>[row.url,row.status]),[[blocked,'partial'],[current,'complete']]);
 assert.equal(report.status,'partial');assert.equal(report.checkedPeople,0);assert.equal(report.tools.find(row=>row.provider==='direct').failed,1,'one actual failed extraction is counted once');assert.equal(report.tools.find(row=>row.provider==='direct').succeeded,2);
});

test('official named contact sources take the two read places before lower relevance discovery hits',async()=>{
 const candidate=company(),reads=[],secondary='https://example.com/contacts/alex';
 const report=await D.runMandatoryBuyerResearch(candidate,{search:async()=>results([{url:'https://directory.example/overview',title:'General industry directory'},{url:'https://news.example/overview',title:'Industry overview'},{url:team,title:'Alex Smith — Example team'},{url:secondary,title:'Alex Smith — Example contact'}]),readPage:async url=>{reads.push(url);if(!url.startsWith('https://example.com/'))throw Error('Unrelated page');return source(url);}});
 assert.equal(report.status,'complete');assert.deepEqual(reads,[team,secondary]);assert.ok(candidate.people[0].contactResearch.checks.public.queryLog[0].sourceReads.filter(row=>row.status==='complete').every(row=>row.url.startsWith('https://example.com/')));
});

test('a relevant failure stays with its query while later channels and another identity finish',async()=>{
 const candidate=company(['Alex Smith','Jamie Brown']),queries=[];
 const report=await D.runMandatoryBuyerResearch(candidate,{search:async query=>{queries.push(query);return results(publicQuery(query)?[{url:blocked,title:'Alex Smith — Example contact'}]:[]);},readPage:async url=>{if(url===blocked)throw unreadable();return source(url);}});
 assert.equal(queries.length,22);assert.equal(report.checkedPeople,1);assert.equal(report.status,'partial');assert.equal(report.stopReason,'checks_incomplete');
 assert.equal(candidate.people[0].contactResearch.checks.public.status,'partial');assert.equal(candidate.people[0].contactResearch.checks.gmail.status,'complete');assert.equal(candidate.people[0].contactResearch.checks.deep.status,'complete');assert.equal(candidate.people[1].emailResearch.status,'complete');assert.ok(D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks.every(key=>candidate.people[1].contactResearch.checks[key].status==='complete'));
});

test('canonical failed URLs consume one read and retain honest search and source receipts through reload and CRM',async()=>{
 const candidate=company(['Alex Smith','Jamie Brown']),rows=[],reads=[];let sequence=0;
 const report=await D.runMandatoryBuyerResearch(candidate,{rows,search:async()=>results([{url:blocked+'?nav='+sequence+++'#contact',title:'Alex Smith and Jamie Brown — Example contact'},{url:team+'#people',title:'Alex Smith and Jamie Brown — Example team'}]),readPage:async url=>{reads.push(url);if(url.startsWith(blocked))throw unreadable();return source(url);}});
 assert.equal(reads.filter(url=>url.startsWith(blocked)).length,1);assert.equal(reads.filter(url=>url.startsWith(team)).length,1);assert.equal(report.tools.find(row=>row.provider==='direct').failed,1);assert.equal(report.stopReason,'checks_incomplete');
 const saved=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({selectedProspects:[candidate]}))).selectedProspects[0],snapshot=CRM.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch;
 for(const restored of [saved.people,snapshot.buyers])for(const person of restored){const entry=person.contactResearch.checks.public.queryLog[0];assert.equal(entry.status,'partial');assert.equal(entry.searchStatus,'complete');assert.deepEqual(entry.providers,['grounded']);assert.equal(entry.resultCount,2);assert.deepEqual(entry.sourceReads.map(row=>[row.url,row.status]),[[team,'complete'],[blocked,'partial']]);assert.match(entry.sourceReads.find(row=>row.status==='partial').reason,/Relevant source unavailable/);}
 assert.equal(saved.publicResearch.accountability.tools.find(row=>row.provider==='direct').failed,1);
});

test('a resumed partial query retries its failed source while successful query receipts are reused',async()=>{
 const candidate=company(),rows=[];
 await D.runMandatoryBuyerResearch(candidate,{rows,search:async query=>results(publicQuery(query)?[{url:blocked,title:'Alex Smith — Example contact'}]:[]),readPage:async url=>{if(url===blocked)throw unreadable();return source(url);}});
 const saved=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({selectedProspects:[candidate]}))).selectedProspects[0],queries=[];
 const report=await D.runMandatoryBuyerResearch(saved,{rows,search:async query=>{queries.push(query);return results([{url:blocked,title:'Alex Smith — Example contact'}]);},readPage:async url=>source(url)});
 assert.deepEqual(queries,['"Alex Smith" "Example" (email OR phone OR kontakt OR "@gmail.com")']);assert.equal(report.status,'complete');assert.equal(report.checkedPeople,1);assert.equal(saved.people[0].contactResearch.checks.public.queryLog[0].sourceReads[0].status,'complete');
});

test('a completed aggregate cannot conceal an unread selected source when coverage is checked or reused',async()=>{
 const candidate=company(),rows=[];await D.runMandatoryBuyerResearch(candidate,{rows,search:async()=>[],readPage:async url=>source(url)});
 const receipt=candidate.people[0].contactResearch.checks.public.queryLog[0];receipt.sourceReads=[{url:blocked,status:'partial',checkedAt:new Date().toISOString(),reason:'Selected source unread'}];
 assert.equal(D.buyerResearchCheckPassed(candidate,candidate.people[0],'public'),false);assert.equal(D.buyerResearchCoveragePassed(candidate),false);
 const queries=[];await D.runMandatoryBuyerResearch(candidate,{rows,search:async query=>{queries.push(query);return [];},readPage:async url=>source(url)});assert.deepEqual(queries,['"Alex Smith" "Example" (email OR phone OR kontakt OR "@gmail.com")']);
});

test('a third-party PDF remains usable after another selected source fails without becoming official evidence',async()=>{
 const candidate=company(),first='https://association.example/alex-profile',pdf='https://association.example/alex-guide.pdf',reads=[];
 const report=await D.runMandatoryBuyerResearch(candidate,{search:async query=>results(publicQuery(query)?[{url:first,title:'Alex Smith — Example'},{url:pdf,title:'Alex Smith — Example supplier guide PDF'}]:[]),readPage:async url=>{reads.push(url);if(url===first)throw Object.assign(unreadable(),{code:'EXTRACTION_FAILED'});return source(url,url===pdf?'Alex Smith — Procurement Director at Example\nalex.smith@example.com':undefined);}});
 assert.deepEqual(reads,[team,first,pdf]);assert.equal(candidate.people[0].publicEmail,'alex.smith@example.com');assert.equal(candidate.people[0].publicEmailUrl,pdf);assert.equal(candidate.people[0].publicEmailEvidence.sourceKind,'public_listing');assert.equal(D.acceptedOfficialBuyerEmail(candidate,candidate.people[0]),'');assert.equal(report.status,'partial');assert.equal(report.stopReason,'checks_incomplete');
 const receipt=candidate.people[0].contactResearch.checks.public.queryLog[0];assert.equal(receipt.searchStatus,'complete');assert.deepEqual(receipt.sourceReads.map(row=>row.status),['partial','complete']);assert.equal(report.tools.find(row=>row.provider==='direct').failed,1);
});

test('unsupported media bodies remain discovery provenance without supplying contact findings',async()=>{
 const candidate=company(),video={url:'https://youtu.be/alex-profile',title:'Alex Smith — Example',sourceRead:true,markdown:'Alex Smith — Procurement Director at Example\nalex.smith@example.com\nalex.business@gmail.com'},rows=[video];
 const report=await D.runMandatoryBuyerResearch(candidate,{rows,search:async()=>results([video]),readPage:async url=>source(url)});
 assert.equal(report.status,'complete');assert.equal(candidate.people[0].publicEmail||'','');assert.equal(candidate.people[0].gmailMatches?.length||0,0);assert.equal(candidate.people[0].patternFindings?.length||0,0);assert.ok(rows.includes(video));assert.equal(candidate.people[0].contactResearch.checks.public.queryLog[0].sourceReads[0].status,'not_needed');
});

test('a force refresh stopped before execution cannot retain successful search or source receipts',async t=>{
 const candidate=company();await D.runMandatoryBuyerResearch(candidate,{search:async()=>results([{url:team,title:'Alex Smith — Example team'}]),readPage:async url=>source(url)});
 const base=Date.now();let ticks=0;t.mock.method(Date,'now',()=>base+(ticks++?20:0));
 const report=await D.runMandatoryBuyerResearch(candidate,{force:true,maxDurationMs:10,search:async()=>{throw Error('No query should start');}});
 assert.equal(report.stopReason,'time_budget');assert.equal(report.checkedPeople,0);const receipt=candidate.people[0].contactResearch.checks.public.queryLog[0];assert.equal(receipt.status,'not_searched');assert.equal(receipt.searchStatus,'not_searched');assert.deepEqual(receipt.sourceReads,[]);
});
