const test=require('node:test'),assert=require('node:assert/strict');require('../discovery-engine.js');const D=globalThis.LeadIntelDiscovery;
const root='https://acme.example/',team=root+'team',annual=root+'documents/annual-report-2023.pdf';
function scenario(){return {company:'Acme Labs',domain:'acme.example',website:root,people:[],buyerSearchMode:'user_selected_target'};}
const archive=Array.from({length:150},(_,i)=>`[Annual report ${1900+i}](${root}documents/annual-report-${1900+i}.pdf)`).join('\n');
test('financial archives cannot consume a contact-inventory crawl before current staff evidence',async()=>{
 const candidate=scenario(),reads=[],queries=[];
 await D.runOfficialContactResearch(candidate,{search:async q=>{queries.push(q);return [];},readPage:async url=>{reads.push(url);return {url,markdown:url===root?`# Acme Labs\n[Team](${team})\n${archive}`:'### Anna Berg\nOperations Director\nanna.berg@acme.example'};}});
 assert.deepEqual(reads.sort(),[root,team].sort());assert.equal(queries.length,6);assert.equal(candidate.buyerDiscovery.officialContactInventory.research.discoveryTruncated,false);assert.equal(D.officialContactCoveragePassed(candidate),true);assert.ok(candidate.buyerDiscovery.officialContactInventory.channels.some(c=>c.value==='anna.berg@acme.example'));
});
for(const selected of ['targeted_search','explicit_contact_link'])test(`a relevant financial document remains eligible when selected by ${selected}`,async()=>{
 const candidate=scenario(),reads=[];
 await D.runOfficialContactResearch(candidate,{search:async()=>selected==='targeted_search'?[{url:annual}]:[],readPage:async url=>{reads.push(url);return {url,markdown:url===root?(selected==='explicit_contact_link'?`[Supplier contact](${annual})`:'# Acme Labs'):'### Anna Berg\nOperations Director\nanna.berg@acme.example'};}});
 assert.ok(reads.includes(annual));assert.equal(D.officialContactCoveragePassed(candidate),true);assert.ok(candidate.buyerDiscovery.officialContactInventory.channels.some(c=>c.value==='anna.berg@acme.example'));
});
test('a legacy truncated graph executes the contact objective again and preserves saved channels',async()=>{
 const candidate=scenario(),reads=[];candidate.buyerDiscovery={officialContactInventory:{version:1,domain:'acme.example',companyName:candidate.company,checkedAt:new Date().toISOString(),contacts:[],routes:[],sourceEvidence:[],sourcePages:Array.from({length:24},(_,i)=>root+'documents/annual-report-'+i+'.pdf'),channels:[{kind:'email',value:'suppliers@acme.example',url:root+'contact',type:'shared_department'}],research:{policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,status:'partial',startedAt:new Date().toISOString(),checkedAt:new Date().toISOString(),completedUrls:[],pendingUrls:[],queries:[],reads:[],failures:[],discoveryTruncated:true}}};
 const prior=structuredClone(candidate),legacyContact=root+'supplier-contact-legacy';candidate.buyerDiscovery.officialContactInventory.research.pendingUrls=[legacyContact,...Array.from({length:119},(_,i)=>root+'documents/annual-report-'+i+'.pdf')];
 await D.runOfficialContactResearch(candidate,{search:async()=>[],readPage:async url=>{reads.push(url);return {url,markdown:url===root?`[Team](${team})\n${archive}`:'### Anna Berg\nOperations Director\nanna.berg@acme.example'};}});
 assert.deepEqual(reads.sort(),[root,team,legacyContact].sort());assert.equal(D.officialContactCoveragePassed(candidate),true);assert.ok(candidate.buyerDiscovery.officialContactInventory.channels.some(c=>c.value==='suppliers@acme.example'));assert.ok(candidate.buyerDiscovery.officialContactInventory.sourcePages.includes(team));
 const restored=D.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0];assert.equal(restored.buyerDiscovery.officialContactInventory.research.discoveryScope,D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion);assert.equal(D.officialContactCoveragePassed(restored),true);
 assert.equal(D.officialContactCoveragePassed(D.mergeRetainedBuyerResearch(prior,restored)),true,'Retained-history restoration keeps new source pages within the bounded view');
});
test('a genuine excess of relevant contact pages remains a bounded incomplete result',async()=>{
 const candidate=scenario();await D.runOfficialContactResearch(candidate,{search:async()=>[],readPage:async url=>({url,markdown:url===root?Array.from({length:150},(_,i)=>`[Contact ${i}](${root}contact-${i})`).join('\n'):'# Contact\ninfo@acme.example'})});
 assert.equal(candidate.buyerDiscovery.officialContactInventory.research.discoveryTruncated,true);assert.equal(D.officialContactCoveragePassed(candidate),false);assert.equal(candidate.buyerDiscovery.officialContactInventory.research.status,'partial');
});
test('fresh linked-document attribution survives a full legacy source-evidence cap and reopen',()=>{
 const candidate=scenario(),supplier=root+'suppliers',pdf='https://documents.example/contact.pdf',link=`[Supplier contact](${pdf})`,stamp=new Date().toISOString();
 const before=D.officialCompanyContactInventory(Array.from({length:120},(_,i)=>({url:root+'documents/annual-report-'+i+'.pdf',markdown:'# Acme Labs historical report',sourceRead:true})),candidate);
 const after=D.officialCompanyContactInventory([{url:supplier,markdown:link,sourceRead:true},{url:pdf,markdown:'# Acme Labs supplier contact\nsuppliers@acme.example',sourceRead:true,sourceEvidence:{url:pdf,kind:'company_linked',linkedFrom:supplier,linkQuote:link}}],candidate);
 after.research={policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,discoveryScope:D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion,status:'complete',startedAt:stamp,checkedAt:stamp,completedUrls:[supplier,pdf],pendingUrls:[],pendingSources:[],queries:D.officialContactResearchQueries(candidate).map(query=>({query,status:'complete',results:0})),reads:[supplier,pdf].map(url=>({url,status:'complete',reason:''})),failures:[],discoveryTruncated:false};
 const merged=D.mergeOfficialContactInventory(before,after,candidate),restored=D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerDiscovery:{officialContactInventory:merged}}]}).selectedProspects[0];
 assert.ok(restored.buyerDiscovery.officialContactInventory.sourceEvidence.some(row=>row.url===pdf));assert.ok(restored.buyerDiscovery.officialContactInventory.channels.some(row=>row.value==='suppliers@acme.example'&&row.url===pdf));assert.equal(D.officialContactCoveragePassed(restored),true);
});

test('a completed historical archive cannot consume the new contact objective or leave its limit sticky',async()=>{
 const c=scenario(),stamp=new Date().toISOString(),historical=Array.from({length:125},(_,i)=>({url:root+`investors/reports-and-presentations/?t=16&y=${1900+i}`,markdown:'# Acme Labs financial archive',sourceRead:true,extractedAt:stamp}));
 const inventory=D.officialCompanyContactInventory(historical,c);inventory.research={policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,discoveryScope:'20261103-contact-links-v1',status:'partial',startedAt:stamp,checkedAt:stamp,completedUrls:historical.slice(0,120).map(r=>r.url),pendingUrls:[],queries:D.officialContactResearchQueries(c).map(query=>({query,status:'complete',results:8})),reads:historical.slice(0,120).map(r=>({url:r.url,status:'complete',reason:''})),failures:[],discoveryTruncated:true};c.buyerDiscovery={officialContactInventory:inventory};
 const reads=[];await D.runOfficialContactResearch(c,{rows:historical,search:async()=>[{url:team}],readPage:async url=>{reads.push(url);return {url,markdown:url===root?`[Team](${team})\n`+historical.map(r=>`[Reports](${r.url})`).join('\n'):'### Anna Berg\nOperations Director\nanna.berg@acme.example'};}});
 assert.ok(reads.includes(team));assert.equal(D.officialContactCoveragePassed(c),true);assert.equal(c.buyerDiscovery.officialContactInventory.research.discoveryTruncated,false);
 const saved=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0];assert.equal(D.officialContactCoveragePassed(saved),true);
});
test('a company-linked canonical document keeps its original link and actual URL through reopen',async()=>{
 const c=scenario(),linked='https://documents.example/contact.pdf',actual=linked+'/';
 await D.runOfficialContactResearch(c,{search:async()=>[],readPage:async url=>({url:url===linked?actual:url,markdown:url===root?`[Supplier contact](${linked})`:'# Acme Labs\nsuppliers@acme.example'})});
 assert.equal(D.officialContactCoveragePassed(c),true);const inventory=c.buyerDiscovery.officialContactInventory;
 assert.ok(inventory.sourceEvidence.some(source=>source.url===actual&&source.linkQuote.includes(linked)));
 const restored=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0];assert.equal(D.officialContactCoveragePassed(restored),true);assert.ok(restored.buyerDiscovery.officialContactInventory.channels.some(channel=>channel.url===actual&&channel.value==='suppliers@acme.example'));
});
test('reusing a source in the official owner cannot renew its expired contact proof',async()=>{
 const c=scenario(),old=new Date(Date.now()-31*86400000).toISOString(),p={id:'alex',name:'Alex Morgan',publicName:'Alex Morgan',title:'Procurement Director',organization:c.company,publicNameUrl:root,identityStatus:'confirmed'};
 const result=await D.runOfficialContactResearch(c,{search:async()=>[],readPage:async url=>({url,extractedAt:old,markdown:'### Alex Morgan\nProcurement Director\nalex.morgan@acme.example'})});
 const matched=D.matchPublicBuyerDetails([p],result.freshRows,c.domain,c.company)[0];assert.equal(D.acceptedOfficialBuyerEmail(c,matched),'');assert.equal(matched.publicEmailEvidence.checkedAt,old);
});
