const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const company={company:'Example',domain:'example.com',buyerRoles:['Procurement Director']};
const person={id:'anna',name:'Anna Smith',title:'Head of Procurement',organization:'Example',publicNameUrl:'https://linkedin.com/in/anna-smith',publicLinkedinUrl:'https://linkedin.com/in/anna-smith'};
test('exact sourced name/employer/role profile is automatically verified; ambiguous and held identities require review',()=>{
 assert.equal(D.linkedInVerification(person,company).status,'automatic');
 for(const update of [{organization:'Other'},{identityStatus:'pending'},{publicNameUrl:'https://example.com/directory'},{opportunityScope:{status:'review_required',reason:'Scope mismatch'}},{identityEvidenceDate:'2013-01-01'}])assert.equal(D.linkedInVerification({...person,...update},company).status,'review_required');
 assert.equal(D.linkedInVerification({...person,linkedinConfirmedUrl:person.publicLinkedinUrl},company).status,'manual');
});
test('independent contact checks and reasons survive durable snapshot normalization',()=>{
 const p={...person,contactResearch:{version:1,identityKey:'example.com|anna smith',checks:{gmail:{status:'complete',checkedAt:'2026-10-05T07:00:00Z'},phone:{status:'partial',reason:'Request timeout',attempts:1}},channels:{gmail:{status:'complete'},phone:{status:'partial',reason:'Request timeout'},company:{status:'partial'}}}};
 const saved=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[p]}]}).selectedProspects[0].people[0];
 assert.equal(saved.contactResearch.channels.gmail.status,'complete');assert.equal(saved.contactResearch.channels.phone.reason,'Request timeout');
});
test('buyer titles are concise without altering original source text',()=>{
 assert.equal(D.buyerDisplayTitle('Head of Procurement Development på'),'Head of Procurement Development');
 assert.equal(D.buyerDisplayTitle('Projektchef process och produktutveckling'),'Project Director · Process & Product Development');
});
const fs=require('node:fs'),vm=require('node:vm'),ui=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function contactRuntime(){const ctx={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,esc:String,emailPatternCandidates:D.rankedEmailGuesses};vm.runInNewContext(ui.slice(ui.indexOf('function buyerContactRows('),ui.indexOf('function emailPatternCandidates('))+';globalThis.render=buyerContactRows;',ctx);return ctx;}
test('candidate company emails and Gmail appear directly with accurate evidence labels and isolated statuses',()=>{
 const ctx=contactRuntime(),p={...person,gmailCandidates:D.gmailGuessCandidates(person),contactResearch:{channels:{gmail:{status:'complete'},phone:{status:'partial',reason:'Phone request timed out'},company:{status:'partial',reason:'Email source timed out'}}}};
 const html=ctx.render(p,company);
 assert.match(html,/<strong>Company email<\/strong><span><span[^>]*>anna.smith@example.com · Likely email · ownership unconfirmed/);
 assert.match(html,/<strong>Gmail<\/strong><span><span[^>]*>anna.smith@gmail.com · Likely email · ownership unconfirmed/);
 assert.match(html,/Phone request timed out/);assert.match(html,/Verified automatically/);
 assert.doesNotMatch(html,/<strong>Gmail[\s\S]*Additional checks incomplete/);
 const invalid=ctx.render({...p,hunterChecks:{'anna.smith@example.com':{status:'invalid',deliverability:'undeliverable'}}},company);
 assert.doesNotMatch(invalid,/anna.smith@example.com/);
});
const O=require('../outreach-engine.js');
test('LinkedIn AI prompt uses the actual workspace offer, buyer and evidence across industries; parser rejects foreign sources',()=>{
 for(const [company,offer,title] of [['Factory','Metal fabrication','Head of Procurement'],['Retailer','Inventory software','Operations Director'],['Law firm','Document automation','General Counsel']]){
  const dossier={company,domain:'example.com',recommendedOffer:offer,evidence:[{url:'https://example.com/news/new-office',text:company+' opened a new office to support its expanding operations.'}]};
  const prompt=O.linkedInDraftPrompt(dossier,{id:'p1',name:'Anna Smith',title},{companyName:'Seller'},{});
  assert.ok(prompt.prompt.includes(offer)&&prompt.prompt.includes(title)&&prompt.prompt.includes(dossier.evidence[0].text));
  assert.equal(O.parseLinkedInDraft(JSON.stringify({linkedinMessage:'Hi Anna, I saw the new office. Is your team the right contact?',eventSourceUrl:dossier.evidence[0].url}),dossier).eventSourceUrl,dossier.evidence[0].url);
  assert.throws(()=>O.parseLinkedInDraft({linkedinMessage:'Hello',eventSourceUrl:'https://foreign.test/news'},dossier));
 }
});
test('AI event provenance and edited draft survive CRM package save/reload',()=>{
 const dossier={company:'Example',domain:'example.com',people:[person],evidence:[{url:'https://example.com/news/plant',text:'Example is investing in a new production plant.'}]};
 const item={channel:'linkedin',domain:'example.com',dossier,selectedPersonId:person.id,drafts:{linkedinMessage:'An edited buyer-specific draft.',scriptContext:{eventSourceUrl:dossier.evidence[0].url}},localizationStatus:'complete'};
 const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(item),'example.com');
 assert.equal(restored.drafts.linkedinMessage,item.drafts.linkedinMessage);assert.equal(restored.drafts.scriptContext.eventSourceUrl,dossier.evidence[0].url);
});

test('homepage capture date is not presented as a company event date',()=>{
 const event=O.specificEventEvidence({evidence:[{url:'https://example.com/',date:'2026-10-05',text:'Example is investing six billion in a new sorting plant.'}]});
 assert.equal(event.date,'');assert.match(event.event,/new sorting plant/);
});
