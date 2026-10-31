const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../research-brief'),D=require('../company-dossier'),E=require('../message-editor'),S=require('../message-studio'),O=require('../outreach-engine');
const url='https://buyer.example/news/plant',quote='Our first plant is under construction in Boden in northern Sweden.';
const essentials={sender:'Robin Lane',company:'North Works',offer:'steel manufacturing and installation',target:'industrial teams',problem:'handoffs',value:'simplify delivery',difference:'Our team has more than 20 years of metalworking experience.',approach:'We turn drawings into steel.',meetingValue:'project lessons',calendly:'https://calendly.com/north/intro',nextAction:'Choose a time'};
function candidate(text=quote){const pass={...D.validatePass({provider:'openai',webSearch:true,facts:[{text,quote:text,sourceUrl:url}],people:[]},[{url,text}],{company:'Buyer',domain:'buyer.example'}),sourceReads:[{url,status:'succeeded',checkedAt:'2026-10-31T07:00:00Z'}],extractedSources:[url]};return {company:'Buyer',domain:'buyer.example',buyerDiscovery:{companyDossier:D.reconcile([pass],{company:'Buyer',domain:'buyer.example'})},evidence:[]};}
function context(brief,excerpt){return {channel:'email',buyerCompany:'Buyer',buyerDomain:'buyer.example',firstName:'Sam',researchBrief:brief,now:'2026-10-31',trigger:{verification:'source_verified',url,excerpt,summary:excerpt}};}
test('a valid brief quote never licenses unsupported prefixed or appended trigger facts',()=>{
 const brief=B.build(candidate());
 for(const excerpt of ['Our new hospital is under construction in Stockholm. '+quote,quote+' Foundation work has started for a new hospital due to open in 2029.','']){
  assert.equal(B.supports(brief,{url,excerpt}),false);
  for(const mode of ['curiosity','friendly','brutal']){const studio=S.normalize({mode,essentials}),prepared=E.prepareFactContext(studio,context(brief,excerpt));assert.equal(prepared.trigger,null);assert.equal(prepared.factPreparation.opening,'approved-omission');assert.doesNotMatch(E.tailor(studio,prepared).message,/Stockholm|hospital|2029/);}
 }
 assert.equal(B.supports(brief,{url,excerpt:'Our first plant is under construction in Boden'}),true);
});
test('conditional source statements cannot become approved factual openings or complete project frames',()=>{
 for(const excerpt of ['If Buyer is constructing a new plant, we will consider expanding services.','Unless funding is secured, Buyer is constructing a new plant.','If funding is secured, foundation work has started for the new Boden plant due to open in 2029.']){
  const brief=B.build({domain:'buyer.example',evidence:[{url,text:excerpt,sourceRead:true}]});
  assert.equal(B.opening(context(brief,excerpt)),null);
  for(const mode of ['curiosity','friendly','brutal']){const studio=S.normalize({mode,essentials}),prepared=E.prepareFactContext(studio,context(brief,excerpt));assert.equal(prepared.factPreparation.opening,'approved-omission');assert.equal(prepared.bodyTrigger,null);assert.equal(prepared.factPreparation.facts.find(row=>row.id==='openingYear').status,'missing');}
 }
});
test('explicit failed and pending source reads override extracted-source labels without discarding independent successful sources',()=>{
 for(const status of ['failed','pending']){const c=candidate(),d=c.buyerDiscovery.companyDossier;for(const pass of d.passes)pass.sourceReads=[{url,status}];const brief=B.build(c);assert.equal(brief.facts.length,0);assert.equal(brief.developments.length,0);}
 const c=candidate(),d=c.buyerDiscovery.companyDossier;d.passes[0].sourceReads.push({url:'https://buyer.example/elsewhere',status:'failed'});assert.equal(B.build(c).facts[0].quote,quote);
});
test('a cached brief row cannot bypass the current dossier failed-read boundary',()=>{const c=candidate(),prior=B.build(c);c.evidence=B.evidenceRows(prior);for(const pass of c.buyerDiscovery.companyDossier.passes)pass.sourceReads=[{url,status:'failed'}];assert.equal(B.build(c,{},null,prior).facts.length,0);});
test('current seller offer ranks equally sourced dossier and extracted developments across industries and seller renames',()=>{
 const c=candidate('Buyer is implementing changes to its management team.');c.evidence=[{url:'https://buyer.example/news/steel',sourceRead:true,text:'Buyer is expanding its steel manufacturing facility.'},{url:'https://buyer.example/news/payroll',sourceRead:true,text:'Buyer is implementing a new payroll platform.'}];
 for(const [offer,expected] of [['steel manufacturing and installation','steel manufacturing'],['payroll software','payroll platform']]){let first;for(const companyName of ['North Works','Renamed Company']){const brief=B.build(c,{companyName,priorityOffers:offer});assert.match(brief.developments[0].quote,new RegExp(expected));if(first)assert.deepEqual(brief.developments,first);first=brief.developments;}}
});
test('supported missing-milestone observations retain the exact shared source and saved body across CRM reopen',()=>{
 const c=candidate(),brief=B.build(c),item={domain:c.domain,company:c.company,selectedPersonId:'sam',channel:'email',dossier:O.buildOpportunityDossier(c,{priorityOffers:essentials.offer}),drafts:{emailSubject:'Saved subject',emailBody:'Exact manual body'},messageStudioDraft:{editorOrigin:'manual',scriptSavedAt:'2026-10-31'}};
 for(const mode of ['curiosity','friendly','brutal']){const studio=S.normalize({mode,essentials}),prepared=E.prepareFactContext(studio,context(brief,quote));assert.equal(prepared.factPreparation.opening,'verified-summary');assert.match(E.tailor(studio,prepared).message,/I noticed your first plant is under construction in Boden in northern Sweden\./);}
 const next=O.attachResearchBrief(item,c,{priorityOffers:essentials.offer}),restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(next),c.domain);assert.equal(restored.drafts.emailSubject,item.drafts.emailSubject);assert.equal(restored.drafts.emailBody,item.drafts.emailBody);assert.deepEqual(restored.dossier.researchBrief.facts,brief.facts);
});
test('supported excerpts never authorize conflicting summary metadata or unread supplemental milestones',()=>{
 const brief=B.build(candidate()),invented='Foundation work has started for the new Stockholm hospital due to open in 2029.';
 for(const extra of [{trigger:{summary:invented,subjectSummary:'Stockholm',projectName:'Stockholm',title:invented}},{buyerFactEvidence:[{url,text:invented.replace('Stockholm','Boden'),sourceRead:false,evidenceKind:'snippet'}]},{buyerFactEvidence:[{url,text:invented.replace('Stockholm','Boden')}]},{preparedFields:{fields:{triggerSummary:invented}}}]){
  for(const mode of ['professional','curiosity','friendly','brutal']){const studio=S.normalize({mode,essentials}),base=context(brief,quote),prepared=E.prepareFactContext(studio,{...base,...extra,trigger:{...base.trigger,...extra.trigger}});assert.equal(prepared.factPreparation.facts.find(row=>row.id==='openingYear').status,'missing');assert.doesNotMatch(E.buyerFactText(prepared),/hospital|2029|Stockholm/);if(!extra.preparedFields)assert.doesNotMatch(E.tailor(studio,prepared).message,/hospital|2029|Stockholm/);}
 }
});
test('unread seller snippets cannot turn a payroll seller into a steel manufacturer or certified contractor',()=>{
 const raw={...essentials,company:'Payroll Software',offer:'payroll software',difference:'Our team builds payroll software.',approach:'We support payroll teams.'},studio=S.normalize({mode:'professional',essentials:raw}),text='We manufacture steel structures and installation packages. We are EN 1090-1 certified, execution class EXC3. We are ISO 45001:2018 certified.';
 for(const provenance of [{sourceRead:false,evidenceKind:'snippet'},{evidenceKind:'search_snippet'},{sourceRead:true,evidenceKind:'model_summary'},{}]){const ctx={firstName:'Sam',sellerWebsite:'https://payroll.example',sellerEvidence:[{url:'https://payroll.example/quality',text,...provenance}]};assert.equal(S.subjectSellerFacts(ctx,raw).steel,false);assert.equal(require('../message-evidence').sources(ctx).length,0);const body=E.tailor(studio,ctx).message;assert.match(body,/payroll software/);assert.doesNotMatch(body,/EN 1090|EXC3|ISO 45001|steel structures/);}
 const supported={sellerWebsite:'https://payroll.example',sellerEvidence:[{url:'https://payroll.example/quality',text,sourceRead:true}]};assert.equal(S.subjectSellerFacts(supported,raw).steel,true);
});
test('seller audience nationality and industry never establish seller origin or manufacturing capability',()=>{
 const raw={...essentials,company:'Payroll Software',offer:'payroll software',difference:'Our team builds payroll software.',approach:'We support payroll teams.'},studio=S.normalize({mode:'professional',essentials:raw});
 for(const text of ['We provide payroll software to Swedish customers.','We provide payroll software for steel manufacturing and installation companies.','Our steel manufacturing customers use payroll software.']){const ctx={firstName:'Sam',sellerWebsite:'https://payroll.example',sellerEvidence:[{url:'https://payroll.example/about',text,sourceRead:true}]};assert.equal(S.subjectSellerFacts(ctx,raw).steel,false);assert.equal(S.subjectSellerFacts(ctx,raw).installation,false);const draft=E.tailor(studio,ctx);assert.match(draft.message,/a payroll software company/);assert.doesNotMatch(draft.message,/a Swedish|steel structures|fabrication and installation company/);}
});
test('selecting an interior source phrase cannot discard its uncertainty or conditional qualifier',()=>{for(const text of ['According to unconfirmed reports, Buyer is constructing a new plant.','If Buyer is constructing a new plant, funding will be reviewed.','Buyer is constructing a new plant only if funding is secured.']){const brief=B.build({domain:'buyer.example',evidence:[{url,text,sourceRead:true}]});assert.equal(B.supports(brief,{url,excerpt:'Buyer is constructing a new plant'}),false);}});
