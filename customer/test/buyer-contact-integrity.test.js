const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),C=require('../crm-engine.js');
const company={company:'LKAB',domain:'lkab.com',market:'Sweden',buyerRoles:['CEO','Procurement Director','Production Manager']};
const johan={id:'johan',name:'Johan Menckel',title:'CEO and President',organization:'LKAB',publicNameUrl:'https://lkab.com/press/interview',publicLinkedinUrl:'https://linkedin.com/in/johan-menckel'};
const press={url:'https://lkab.com/press/interview',sourceRead:true,markdown:'Johan Menckel, CEO and President. Interviews: Mikko Viitala, Press Chief, +46 (0)70 309 81 63.'};

test('a press contact number is never attached to the executive mentioned before it',()=>{
 const person=D.matchPublicBuyerDetails([johan],[press],company.domain,company.company)[0];
 assert.equal(person.publicPhone||'','');
 const saved=D.matchPublicBuyerDetails([{...johan,publicPhone:'+46 (0)70 309 81 63',publicPhoneUrl:press.url}],[press],company.domain,company.company)[0];
 assert.equal(saved.publicPhone,'');assert.equal(saved.publicPhoneUrl,'');
 const merged=D.mergeBuyerPool([{...johan,publicPhone:'+46 (0)70 309 81 63',publicPhoneUrl:press.url}],[saved],{decisionMakers:'CEO'})[0];
 assert.equal(merged.publicPhone,'');assert.equal(merged.publicPhoneUrl,'');
 const reverse=D.mergeBuyerPool([saved],[{...johan,publicPhone:'+46 (0)70 309 81 63',publicPhoneUrl:press.url}],{decisionMakers:'CEO'})[0];
 assert.equal(reverse.publicPhone,'');assert.equal(reverse.publicPhoneUrl,'');
 const stale=D.matchPublicBuyerDetails([saved],[{url:press.url,markdown:'Johan Menckel, CEO and President, +46 (0)70 309 81 63.'}],company.domain,company.company)[0];
 assert.equal(stale.publicPhone,'');
});
test('an extracted source overrides a misleading same-URL search snippet',()=>{
 const snippet={url:press.url,description:'Johan Menckel, CEO and President, +46 (0)70 309 81 63.'};
 const person=D.matchPublicBuyerDetails([johan],[snippet,press],company.domain,company.company)[0];
 assert.equal(person.publicPhone||'','');
 const extracted=D.matchPublicBuyerDetails([johan],[{...snippet,markdown:snippet.description},{...press,sourceRead:true}],company.domain,company.company)[0];
 assert.equal(extracted.publicPhone||'','');
});
test('phone ownership stops at an inline referral even without a heading or blank line',()=>{
 const row={url:press.url,sourceRead:true,markdown:'Johan Menckel, CEO and President. For interviews please contact the press office on +46 70 309 81 63.'};
 assert.equal(D.matchPublicBuyerDetails([johan],[row],company.domain)[0].publicPhone||'','');
});
test('a different email owner before a phone number prevents attribution to the executive',()=>{
 const row={url:press.url,sourceRead:true,markdown:'Johan Menckel, CEO and President. For further information: mikko.viitala@lkab.com, +46 70 309 81 63.'};
 assert.equal(D.matchPublicBuyerDetails([johan],[row],company.domain)[0].publicPhone||'','');
});
test('a named company hiring contact retains the published email and phone with their exact source passage',()=>{
 const person={id:'david',name:'David Englund',title:'Recruiting manager, strategic procurement, Special Products',organization:'LKAB'};
 const row={url:'https://lkab.com/jobs/strategic-buyer',sourceRead:true,markdown:'Kontakt: rekryterande chef David Englund, david.englund@lkab.com, 070-261 89 54.'};
 const result=D.matchPublicBuyerDetails([person],[row],company.domain,company.company)[0];
 assert.equal(result.publicEmail,'david.englund@lkab.com');assert.equal(result.publicPhone,'070-261 89 54');
 assert.ok(result.publicPhoneEvidence?.quote.includes('David Englund'));
 assert.equal(result.publicPhoneEvidence?.sourceKind,'official');
 assert.equal(D.matchPublicBuyerDetails([{...person,organization:''}],[row],company.domain,company.company)[0].organization,'LKAB');
 assert.equal(D.qualifyBuyer(result,{decisionMakers:'Procurement Director'},company).eligible,false);
});
test('a vacancy cannot establish the advertised role for its named recruiter',()=>{
 const person={id:'david',name:'David Englund',title:'Procurement Director',organization:'LKAB'};
 const row={url:'https://lkab.com/jobs/strategic-buyer',sourceRead:true,markdown:'Join us as Procurement Director. Rekryterande chef David Englund, david.englund@lkab.com, 070-261 89 54.'};
 const result=D.matchBuyerRoleEvidence(person,[row],company,{complete:true});
 assert.equal(result.roleReview?.status,'recruitment_contact');
 assert.equal(D.qualifyBuyer(result,{decisionMakers:'Procurement Director'},company).eligible,false);
 assert.equal(D.rankedBuyerShortlist([result],{decisionMakers:'Procurement Director'},company).recommendedIds.length,0);
 const external=D.matchBuyerRoleEvidence(person,[{...row,url:'https://jobs.example/strategic-buyer',markdown:'LKAB. '+row.markdown}],company,{complete:true});
 assert.equal(external.roleReview?.status,'recruitment_contact');
});
test('an external employer job listing can support a direct business phone without becoming an official-company source',()=>{
 const person={id:'tony',name:'Tony Bogdanoff',title:'Produktionschef',organization:'LKAB'};
 const row={url:'https://jobs.example/automation-technician',sourceRead:true,markdown:'Employer: LKAB. Contact produktionschef Tony Bogdanoff tony.bogdanoff@lkab.com alt. +46 76 822 1084.'};
 const result=D.matchPublicBuyerDetails([person],[row],company.domain,company.company)[0];
 assert.equal(result.publicEmail,'tony.bogdanoff@lkab.com');assert.equal(result.publicPhone,'+46 76 822 1084');
 assert.equal(result.publicPhoneEvidence?.sourceKind,'public_listing');
 const publicResearch={sources:[row.url,'https://unrelated.example/list']};
 const restored=D.normalizeDiscoveryState({pipeline:[{...company,people:[result],publicResearch}],selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[result],publicResearch}]});
 for(const c of [restored.pipeline[0],restored.selectedProspects[0]]){assert.equal(c.people[0].publicPhone,'+46 76 822 1084');assert.equal(c.people[0].publicEmail,'tony.bogdanoff@lkab.com');}
 for(const c of [restored.pipeline[0],restored.selectedProspects[0]])assert.deepEqual(c.publicResearch.sources,[row.url]);
 assert.equal(D.matchPublicBuyerDetails([person],[{...row,markdown:'Tony Bogdanoff, production manager at Other Company, +46 76 822 1084.'}],company.domain,company.company)[0].publicPhone||'','');
 assert.equal(D.matchPublicBuyerDetails([person],[{...row,evidenceKind:'model_summary',description:row.markdown,markdown:''}],company.domain,company.company)[0].publicPhone||'','');
});
test('an independently attributed listing phone survives alongside an official email source',()=>{
 const person={id:'tony',name:'Tony Bogdanoff',title:'Produktionschef',organization:'LKAB'};
 const official={url:'https://lkab.com/contacts',sourceRead:true,markdown:'Produktionschef Tony Bogdanoff, tony.bogdanoff@lkab.com.'};
 const listing={url:'https://jobs.example/automation-technician',sourceRead:true,markdown:'Employer: LKAB. Contact produktionschef Tony Bogdanoff tony.bogdanoff@lkab.com alt. +46 76 822 1084.'};
 const result=D.matchPublicBuyerDetails([person],[listing,official],company.domain,company.company)[0];
 assert.equal(result.publicEmailUrl,official.url);assert.equal(result.publicPhoneUrl,listing.url);
 const restored=D.normalizeDiscoveryState({pipeline:[{...company,people:[result],publicResearch:{sources:[listing.url,official.url]}}],selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[result],publicResearch:{sources:[listing.url,official.url]}}]});
 for(const c of [restored.pipeline[0],restored.selectedProspects[0]]){assert.equal(c.people[0].publicPhone,'+46 76 822 1084');assert.ok(c.publicResearch.sources.includes(listing.url));}
});
test('an unresolved executive role is excluded from automatic recommendations and LinkedIn handoff',()=>{
 const person={id:'paul',name:'Paul Pepper',title:'Managing Director',organization:'LKAB',publicNameUrl:'https://linkedin.com/in/paul-pepper',publicLinkedinUrl:'https://linkedin.com/in/paul-pepper',roleReview:{version:1,status:'unconfirmed',reason:'Current executive role has no independent employer evidence',checkedAt:new Date().toISOString(),sources:[]}};
 assert.equal(D.qualifyBuyer(person,{decisionMakers:'CEO'},company).eligible,false);
 assert.equal(D.linkedInVerification(person,company).status,'review_required');
 assert.equal(D.rankedBuyerShortlist([person],{decisionMakers:'CEO'},company).recommendedIds.length,0);
 for(const markdown of ['Paul Pepper, Business Development Manager. Mark Burrell, Managing Director.','Mark Burrell, Managing Director. Paul Pepper, Business Development Manager.']){
  const checked=D.matchBuyerRoleEvidence(person,[{url:'https://lkab.com/team',markdown}],company,{complete:true});
  assert.equal(checked.roleReview.status,'unconfirmed');assert.equal(D.qualifyBuyer(checked,{decisionMakers:'CEO'},company).eligible,false);
 }
});
test('a directly named executive role supports standard reordered CEO and President titles',()=>{
 const person=D.matchBuyerRoleEvidence(johan,[{url:'https://lkab.com/leadership',markdown:'Johan Menckel, President and CEO at LKAB.'}],company,{complete:true});
 assert.equal(person.roleReview.status,'supported');
});
test('phone rejection wins equally timed checks regardless of merge order',()=>{
 const checkedAt=new Date().toISOString(),url=press.url;
 const rejected={...johan,publicPhoneSourceCheck:{version:2,status:'not_attributed',url,checkedAt}},attributed={...johan,publicPhone:'+46 70 309 81 63',publicPhoneUrl:url,publicPhoneSourceCheck:{version:2,status:'attributed',url,checkedAt}};
 assert.equal(D.mergeBuyerPool([rejected],[attributed],{decisionMakers:'CEO'})[0].publicPhone,'');
 assert.equal(D.mergeBuyerPool([attributed],[rejected],{decisionMakers:'CEO'})[0].publicPhone,'');
});
test('attribution evidence and role holds survive normalization and durable CRM snapshots',()=>{
 const p={...johan,roleReview:{version:1,status:'unconfirmed',reason:'Role needs corroboration',checkedAt:new Date().toISOString(),sources:[]},publicPhone:'+46 76 822 1084',publicPhoneUrl:press.url,publicPhoneEvidence:{version:2,url:press.url,quote:'Johan Menckel, CEO, +46 76 822 1084',sourceKind:'official',checkedAt:new Date().toISOString()}};
 const normalized=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[p]}]}).selectedProspects[0];
 assert.equal(normalized.people[0].roleReview?.status,'unconfirmed');
 assert.equal(normalized.people[0].publicPhoneEvidence?.version,2);
 const saved=C.mapDiscoveryCandidateToCrm(normalized).intelligence.research_snapshot.buyerResearch.buyers[0];
 assert.equal(saved.roleReview.status,'unconfirmed');assert.equal(saved.publicPhoneEvidence.quote,p.publicPhoneEvidence.quote);
});

const ui=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function render(person){const ctx={URL,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,esc:String,emailPatternCandidates:D.rankedEmailGuesses};vm.runInNewContext(ui.slice(ui.indexOf('function buyerContactRows('),ui.indexOf('function emailPatternCandidates('))+';globalThis.render=buyerContactRows;',ctx);return ctx.render(person,company);}
test('Gmail patterns disclose missing ownership and LinkedIn matching does not claim full verification',()=>{
 const html=render({...johan,publicNameUrl:johan.publicLinkedinUrl,gmailCandidates:D.gmailGuessCandidates(johan),contactResearch:{checks:{gmail:{status:'complete',checkedAt:new Date().toISOString()}},channels:{gmail:{status:'complete'},company:{status:'complete'},phone:{status:'complete'}}}});
 assert.match(html,/johan\.menckel@gmail\.com · Name pattern · Unconfirmed/);assert.doesNotMatch(html,/Verified automatically/);
 assert.match(html,/Profile matched automatically/);assert.match(html,/Expanded three-search Gmail research needs refreshing/);
});
test('legacy phone listings require rechecking before they are shown as a direct contact',()=>{
 const html=render({...johan,publicPhone:'+46 (0)70 309 81 63',publicPhoneUrl:press.url});
 assert.doesNotMatch(html,/309 81 63/);assert.match(html,/Phone source needs rechecking/);
});
test('newly discovered source pages are read in the same pass, including contact details omitted from snippets',async()=>{
 const scraped=[],person={id:'david',name:'David Englund',title:'Head of Procurement',organization:'LKAB'};
 const url='https://lkab.com/jobs/strategic-buyer',ctx={URL,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,emailPatternCandidates:D.rankedEmailGuesses,crmAuthenticated:()=>false,bridge:()=>null,
  searchBuyerPublicPages:async query=>query==='site:lkab.com "David Englund"'?[{url,description:'David Englund, david.englund@lkab.com'}]:[],
  fetchFirecrawlBuyerResearch:async(_kind,body)=>{scraped.push(body.url);return {ok:true,json:async()=>({data:{markdown:'Kontakt: Head of Procurement David Englund, david.englund@lkab.com, 070-261 89 54.'}})};}};
 vm.runInNewContext(ui.slice(ui.indexOf('function patternListings('),ui.indexOf('async function groundedBuyerFollowUp('))+';globalThis.search=searchBuyerEmailPatterns;',ctx);
 const candidate={...company,people:[person]};const result=await ctx.search(candidate,[],new AbortController().signal);
 assert.deepEqual(scraped,[url]);assert.equal(candidate.people[0].publicPhone,'070-261 89 54');
 assert.equal(result.evidence[0].sourceRead,true);
 assert.equal(candidate.people[0].contactResearch.evidenceVersion,2);
});
test('search markdown containing a phone still gets a full source read before accepting ownership',async()=>{
 const reads=[],person={...johan},ctx={URL,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,emailPatternCandidates:D.rankedEmailGuesses,crmAuthenticated:()=>false,bridge:()=>null,
  searchBuyerPublicPages:async query=>query==='site:lkab.com "Johan Menckel"'?[{url:press.url,markdown:'Johan Menckel, CEO and President, +46 (0)70 309 81 63.'}]:[],
  fetchFirecrawlBuyerResearch:async(_kind,body)=>{reads.push(body.url);return {ok:true,json:async()=>({data:{markdown:press.markdown}})};}};
 vm.runInNewContext(ui.slice(ui.indexOf('function patternListings('),ui.indexOf('async function groundedBuyerFollowUp('))+';globalThis.search=searchBuyerEmailPatterns;',ctx);
 const candidate={...company,people:[person]};await ctx.search(candidate,[],new AbortController().signal);
 assert.deepEqual(reads,[press.url]);assert.equal(person.publicPhone||'','');
 await ctx.search(candidate,[],new AbortController().signal,{force:true});
 assert.deepEqual(reads,[press.url,press.url]);assert.equal(person.publicPhone||'','');
});
test('a cached contact pass preserves previously supported role evidence without making requests',async()=>{
 let calls=0;
 const person={id:'johan',name:'Johan Menckel',title:'CEO',organization:'LKAB'};
 const url='https://lkab.com/leadership',ctx={URL,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,emailPatternCandidates:D.rankedEmailGuesses,crmAuthenticated:()=>false,bridge:()=>null,
  searchBuyerPublicPages:async()=>{calls++;return [{url,description:'Johan Menckel, CEO at LKAB'}];},
  fetchFirecrawlBuyerResearch:async()=>{calls++;return {ok:true,json:async()=>({data:{markdown:'Johan Menckel, CEO at LKAB.'}})};}};
 vm.runInNewContext(ui.slice(ui.indexOf('function patternListings('),ui.indexOf('async function groundedBuyerFollowUp('))+';globalThis.search=searchBuyerEmailPatterns;',ctx);
 const candidate={...company,people:[person]};await ctx.search(candidate,[],new AbortController().signal);
 assert.equal(person.roleReview?.status,'supported');
 calls=0;await ctx.search(candidate,[],new AbortController().signal);
 assert.equal(calls,0);assert.equal(person.roleReview?.status,'supported');
});
test('the evidence review receives passages around names rather than only the navigation at the start of a page',()=>{
 assert.equal(typeof D.buyerEvidenceExcerpt,'function');
 const row={url:press.url,markdown:'Navigation '.repeat(400)+'Johan Menckel, President and CEO. Contact Mikko Viitala for interviews.'};
 const excerpt=D.buyerEvidenceExcerpt(row,[johan]);
 assert.ok(excerpt.includes('Contact Mikko Viitala'));assert.ok(excerpt.length<=1800);
});

test('LKAB-style explicitly published at/dot addresses are decoded and attributed to the correct purchasing contact',()=>{
 const url='https://lkab.com/en/contact-us/purchasing/',markdown='## Malin Barsk\n\nRock reinforcement, steel and drilling materials, mobile machinery and cars\n\nmalin.barsk(at)lkab(dot)com\n\n## Julia Öhrn\n\nElectricity, automation and media, supplies for processing plants, steel and drilling materials\n\njulia.ohrn(at)lkab(dot)com\n\n## Fredrik Eriksson\n\nMechanical maintenance services, equipment\n\nfredrik.eriksson2(at)lkab(dot)com';
 const people=[{name:'Malin Barsk',title:'Procurement contact'},{name:'Julia Öhrn',title:'Procurement contact'},{name:'Fredrik Eriksson',title:'Procurement contact'}];
 const matched=D.matchPublicBuyerDetails(people,[{url,markdown,sourceRead:true}],'lkab.com','LKAB');
 assert.deepEqual(matched.map(p=>p.publicEmail),['malin.barsk@lkab.com','julia.ohrn@lkab.com','fredrik.eriksson2@lkab.com']);
 for(const person of matched)assert.equal(person.publicEmailUrl,url);
 assert.deepEqual(D.sourcedBuyerEmails({name:'Malin Barsk'},'lkab.com',[{url,markdown}]).map(p=>p.email),['malin.barsk@lkab.com']);
 assert.equal(D.sourcedBuyerEmails({name:'Other Person'},'lkab.com',[{url,markdown}]).length,0);
});
