const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Canonical=require('../canonical-intelligence.js');
const Profile=require('../profile-engine.js');
const input=()=>({website:'https://clinic.example/',targetMarkets:['Germany'],answers:{priority_offers:'Clinical software',ideal_customer:'Independent clinics',buyer_roles:'Medical Director'},answerStatus:{priority_offers:'user',ideal_customer:'user',buyer_roles:'user'},scrapedSources:[{id:'S1',url:'https://clinic.example/',type:'website',text:'We provide clinical software for independent clinics.'}]});
function runtime(){const scope={URL,console,Date};vm.createContext(scope);for(const file of ['step2-brief-schema.js','profile-engine.js','company-brain.js','canonical-intelligence.js','canonical-profile-runtime.js'])vm.runInContext('(function(){'+fs.readFileSync(require.resolve('../'+file),'utf8')+'\n})()',scope);return scope;}

test('research hypotheses do not become website facts through compatibility profile fields',()=>{
 const i=input();i.answers.buying_triggers='Clinics may seek new software after leadership changes';i.answerStatus.buying_triggers='hypothesis_draft';i.researchMeta={fields:{buying_triggers:{origin:'hypothesis_draft',sourceIds:['S1'],reviewed:false}}};
 const p=Canonical.normalizeCanonicalProfile({buyingTriggers:i.answers.buying_triggers},i,{websiteFields:{buyingTriggers:i.answers.buying_triggers}});
 assert.equal(p.canonical.fields.buyingTriggers.status,'needs_confirmation');
});

test('accepted citations must resolve to retained first-party evidence rather than an ID prefix',()=>{
 for(const sources of [[],[{id:'S99',url:'https://directory.example/clinic',text:'Directory claim'}]]){
  const i={...input(),answers:{differentiation:'Unverified certification'},answerStatus:{differentiation:'accepted'},scrapedSources:sources,researchMeta:{fields:{differentiation:{origin:'evidence_draft',reviewed:true,sourceIds:['S99']}}}};
  const p=Canonical.buildCanonicalProfile(i);
  assert.equal(p.canonical.fields.differentiation.status,'needs_confirmation');
  assert.equal(p.canonical.fields.differentiation.provenance,'ai_inference');
 }
});

test('compatibility values without retained supporting evidence stay reviewable',()=>{
 const p=Canonical.normalizeCanonicalProfile({priorityOffers:'Historic unverified offer'},{website:'https://clinic.example/'});
 assert.notEqual(p.canonical.fields.priorityOffers.status,'first_party_evidence');
 assert.equal(p.canonical.diagnostics.find(row=>row.field==='priorityOffers').state,'needs_confirmation');
});

test('profile evidence cards keep the IDs referenced by canonical fields through save and reload',()=>{
 const i=input();i.documents=[{id:'brochure-4',name:'Clinical software.pdf',text:'Clinical software for independent clinics.'}];
 const built=Profile.buildCompanyIntelligenceProfile(i);const restored=Profile.normalizeSavedState(JSON.parse(JSON.stringify({...i,profile:built})));
 assert.deepEqual(restored.scrapedSources.map(s=>s.id),['S1']);
 assert.deepEqual(restored.documents.map(d=>d.id),['brochure-4']);
 assert.deepEqual(restored.profile.evidenceSources.map(s=>s.id),['S1','brochure-4']);
});

test('normalization honors an explicit revised questionnaire value over an older confirmed profile',()=>{
 const r=runtime(),i=input(),profile=r.LeadIntelProfile.buildCompanyIntelligenceProfile(i);
 const restored=r.LeadIntelProfile.normalizeSavedState({...i,profile,answers:{...i.answers,priority_offers:'Scheduling software'},approved:false});
 assert.equal(restored.profile.priorityOffers,'Scheduling software');
 assert.equal(restored.profile.canonical.fields.priorityOffers.value,'Scheduling software');
});

test('normalization does not resurrect an explicitly cleared questionnaire answer',()=>{
 const r=runtime(),i=input(),profile=r.LeadIntelProfile.buildCompanyIntelligenceProfile(i);
 const restored=r.LeadIntelProfile.normalizeSavedState({...i,profile,answers:{...i.answers,priority_offers:''},answerStatus:{...i.answerStatus,priority_offers:'missing'},approved:false});
 assert.equal(restored.profile.priorityOffers,'');
 assert.equal(restored.profile.canonical.fields.priorityOffers.value,'');
});

test('normalization retains historical sources separately from active seller evidence',()=>{
 const i=input();const old={id:'old-seller',type:'website',url:'https://old-seller.example/',text:'We provide industrial engineering services.',logoUrl:'https://old-seller.example/logo.svg'};
 const snippet={id:'snippet',type:'website',url:i.website,text:'We provide software.',extracted:false};
 const state=Profile.normalizeSavedState({...i,scrapedSources:[old,snippet],profile:Profile.buildCompanyIntelligenceProfile(i)});
 assert.equal(state.scrapedSources.length,2,'historical and unextracted context is retained');
 assert.equal(state.profile.evidenceSources.length,0,'neither is verified evidence for the active seller');
 assert.equal(state.profile.sourceSummary.total,0);
 assert.equal(state.profile.logoUrl,undefined);
});

function editorHarness(){
 const {JSDOM}=require('jsdom');
 const dom=new JSDOM('<div id="profile-editor"></div><button id="edit-profile"></button><div id="toast"></div>',{url:'https://leadintel.example/',runScripts:'outside-only'});const w=dom.window;
 w.LeadIntelServerBridge={workspace:{id:'clinic-workspace'}};
 for(const file of ['step2-brief-schema.js','profile-engine.js','company-brain.js','canonical-intelligence.js','canonical-profile-runtime.js','intelligence-profile-ui.js'])w.eval(fs.readFileSync(require.resolve('../'+file),'utf8'));
 const i=input();const p=w.LeadIntelProfile.buildCompanyIntelligenceProfile(i);p.canonical.fields.buyingTriggers=w.LeadIntelCanonicalIntelligence.fieldRecord('Leadership change may create demand',{status:'needs_confirmation',provenance:'ai_inference',sourceIds:['S1'],confidence:'low'});p.buyingTriggers=p.canonical.fields.buyingTriggers.value;
 const state={...i,profile:p,approved:true,market:{strategyApproved:true}};
 w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(state));
 w.eval(fs.readFileSync(require.resolve('../intelligence-profile-runtime.js'),'utf8'));w.LeadIntelIntelligenceProfileRuntime.enterEditMode();
 return {w,dom,state:()=>JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state')),save:()=>w.LeadIntelIntelligenceProfileRuntime.saveCanonicalEdits(),close:()=>w.close()};
}

test('saving one profile edit preserves unchanged hypothesis provenance',()=>{
 const h=editorHarness();try{const before=h.state().profile.canonical.fields.buyingTriggers;h.w.document.querySelector('[data-profile-field="priorityOffers"]').value='Appointment software';assert.equal(h.save(),true);assert.deepEqual(h.state().profile.canonical.fields.buyingTriggers,before);assert.equal(h.state().profile.companyClaims.offers.value,'Appointment software');assert.equal(h.state().approved,false);assert.equal(h.state().market.strategyApproved,false);}finally{h.close();}
});

test('a profile editor opened in another workspace cannot write to the new workspace',()=>{
 const h=editorHarness();try{h.w.document.querySelector('[data-profile-field="priorityOffers"]').value='Old editor change';h.w.LeadIntelServerBridge.workspace.id='different-workspace';const next={...h.state(),website:'https://next.example/',approved:true};h.w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(next));assert.equal(h.save(),false);assert.deepEqual(h.state(),next);}finally{h.close();}
});

test('accepted AI hypotheses keep inference provenance even when they cite an official page',()=>{
 const i=input();i.answers.buying_triggers='Leadership changes may create software demand';i.answerStatus.buying_triggers='accepted';i.researchMeta={fields:{buying_triggers:{origin:'hypothesis_draft',reviewed:true,sourceIds:['S1']}}};const p=Canonical.buildCanonicalProfile(i);
 assert.equal(p.canonical.fields.buyingTriggers.provenance,'ai_inference');
 assert.notEqual(p.canonical.fields.buyingTriggers.status,'first_party_evidence');
});

test('canonical profile cards identify their retained source URLs and missing citation targets',()=>{
 const UI=require('../intelligence-profile-ui.js');const html=UI.render({canonical:{fields:{priorityOffers:{value:'Clinical software',status:'first_party_evidence',sourceIds:['brochure-4','missing-source']}}},evidenceSources:[{id:'brochure-4',title:'Official clinical software',url:'https://clinic.example/software'}]});
 assert.match(html,/href="https:\/\/clinic.example\/software"/);
 assert.match(html,/Official clinical software/);
 assert.match(html,/Source unavailable.*missing-source/);
});

test('a concurrent edit to the same profile field is preserved without overwriting it',()=>{
 const h=editorHarness();try{h.w.document.querySelector('[data-profile-field="priorityOffers"]').value='Stale edit';const next=h.state();next.profile.canonical.fields.priorityOffers.value='Newer edit';next.profile.priorityOffers='Newer edit';h.w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(next));assert.equal(h.save(),false);assert.deepEqual(h.state(),next);}finally{h.close();}
});

test('saving an unchanged profile does not manufacture confirmation or invalidate approvals',()=>{
 const h=editorHarness();try{const before=h.state();assert.equal(h.save(),true);assert.deepEqual(h.state(),before);}finally{h.close();}
});

test('legacy positional citations remain aligned after unrelated and unreadable evidence is filtered',()=>{
 const i=input();i.scrapedSources=[{url:'https://directory.example/',text:'Unrelated directory'}, {type:'website',url:i.website,text:'Clinical software'}];i.documents=[{name:'unreadable.pdf',text:''},{name:'clinical.pdf',text:'Clinical software'}];
 const p=Profile.buildCompanyIntelligenceProfile(i);
 assert.deepEqual(p.evidenceSources.map(s=>s.id),['S2','D2']);
 const research={...i,answers:{differentiation:'Clinical software'},answerStatus:{differentiation:'accepted'},researchMeta:{fields:{differentiation:{origin:'evidence_draft',sourceIds:['D2'],reviewed:true}}}};
 assert.equal(Canonical.buildCanonicalProfile(research).canonical.fields.differentiation.provenance,'document');
});

test('displaced manually confirmed values remain available for review after normalization and reload',()=>{
 const r=runtime(),i=input(),profile=r.LeadIntelProfile.buildCompanyIntelligenceProfile(i);
 const next=r.LeadIntelProfile.normalizeSavedState({...i,profile,answers:{...i.answers,priority_offers:'Scheduling software'},approved:false});
 assert.equal(next.profile.canonical.fieldHistory.priorityOffers[0].value,'Clinical software');
 const reload=r.LeadIntelProfile.normalizeSavedState(JSON.parse(JSON.stringify(next)));
 assert.equal(reload.profile.canonical.fieldHistory.priorityOffers[0].value,'Clinical software');
 const UI=require('../intelligence-profile-ui.js');assert.match(UI.render(reload.profile),/Previous confirmed value/);
});

test('canonical edits update buying-outcome aliases and the core Strategy ICP while retaining custom segments',()=>{
 const h=editorHarness();try{const initial=h.state();initial.market.icps=[{id:'icp-core',offers:initial.profile.priorityOffers,buyerRoles:'Medical Director',description:'Independent clinics',custom:'retain'},{id:'custom',offers:'Custom sector offer',buyerRoles:'CFO'}];h.w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(initial));h.w.LeadIntelIntelligenceProfileRuntime.enterEditMode();h.w.document.querySelector('[data-profile-field="priorityOffers"]').value='Scheduling software';h.w.document.querySelector('[data-profile-field="customerPainPoints"]').value='Reduce scheduling delays';assert.equal(h.save(),true);const saved=h.state();assert.equal(saved.profile.buyingOutcomes,'Reduce scheduling delays');assert.equal(saved.market.icps[0].offers,'Scheduling software');assert.equal(saved.market.icps[0].custom,'retain');assert.deepEqual(saved.market.icps[1],initial.market.icps[1]);}finally{h.close();}
});

test('normalization invalidates Profile and Strategy approval when saved questionnaire supersedes confirmed context',()=>{
 const r=runtime(),i=input(),profile=r.LeadIntelProfile.buildCompanyIntelligenceProfile(i);
 const next=r.LeadIntelProfile.normalizeSavedState({...i,profile,approved:true,answers:{...i.answers,priority_offers:'Scheduling software'},market:{strategyApproved:true,strategyApprovedAt:'2026-10-01',researchResults:[{title:'Retained research'}]}});
 assert.equal(next.approved,false);assert.equal(next.market.strategyApproved,false);assert.equal(next.market.strategyApprovedAt,'');assert.equal(next.market.researchResults[0].title,'Retained research');
});

test('seller context is industry-driven and invariant to fixture or customer names',()=>{
 const r=runtime();for(const [offer,expected] of [['Clinical software','software'],['Legal advice and litigation','other'],['Sales training and coaching','professional-services'],['Custom metal fabrication','industrial-services']]){
  const profiles=['ERCON','CCGROUP','Independent Seller'].map(name=>{const i=input();i.answers.priority_offers=offer;i.scrapedSources=[{id:'S1',type:'website',url:i.website,title:name,text:`${name} provides ${offer}.`}];return r.LeadIntelProfile.buildCompanyIntelligenceProfile(i);});
  for(const p of profiles){assert.equal(p.priorityOffers,offer);assert.equal(p.companyClassification.businessType,expected);assert.deepEqual(Array.from(p.recommendedSignals,x=>x.id),Array.from(profiles[0].recommendedSignals,x=>x.id));assert.equal(p.canonical.fields.priorityOffers.provenance,'user');}
 }
});

test('persisted company claim summaries keep draft status and field-specific source associations',()=>{
 const r=runtime(),i=input();i.answerStatus.priority_offers='evidence_draft';i.researchMeta={fields:{priority_offers:{origin:'evidence_draft',sourceIds:['S1'],reviewed:false,confidence:'medium'}}};i.scrapedSources.push({id:'S2',url:'https://directory.example/',text:'Unrelated third-party claim'});
 const profile=r.LeadIntelProfile.buildCompanyIntelligenceProfile(i);
 assert.equal(profile.companyClaims.offers.status,'inferred');
 assert.deepEqual(Array.from(profile.companyClaims.offers.evidenceIds),['S1']);
 assert.equal(profile.companyClaims.idealCustomer.status,'confirmed');
 assert.deepEqual(Array.from(profile.companyClaims.idealCustomer.evidenceIds),['U:ideal_customer']);
 const restored=r.LeadIntelProfile.normalizeSavedState({...i,profile});
 assert.equal(restored.profile.companyClaims.offers.status,'inferred');
 assert.deepEqual(Array.from(restored.profile.companyClaims.offers.evidenceIds),['S1']);
});

test('normalization persists document citation identities before filtering and through reorder and deletion',()=>{
 const i=input();i.documents=[{name:'',text:''},{name:'clinical.pdf',text:'Clinical scheduling software'},{id:'brochure-42',name:'brochure.pdf',text:'Medical scheduling support'}];
 assert.deepEqual(Canonical.activeFirstPartySources(i).filter(doc=>doc.type==='document').map(doc=>doc.id),['D2','brochure-42']);
 const state=Profile.normalizeSavedState(i);
 assert.deepEqual(state.documents.map(doc=>doc.id),['D2','brochure-42']);
 const reordered=Profile.normalizeSavedState({...state,documents:[state.documents[1],state.documents[0]]});
 assert.deepEqual(reordered.documents.map(doc=>doc.id),['brochure-42','D2']);
 const research={...reordered,answers:{differentiation:'Clinical scheduling software'},answerStatus:{differentiation:'accepted'},researchMeta:{fields:{differentiation:{origin:'evidence_draft',sourceIds:['D2'],reviewed:true}}}};
 assert.equal(Canonical.buildCanonicalProfile(research).canonical.fields.differentiation.provenance,'document');
 const deleted=Profile.normalizeSavedState({...research,documents:[reordered.documents[0]]});
 assert.equal(Canonical.buildCanonicalProfile({...deleted,researchMeta:research.researchMeta}).canonical.fields.differentiation.provenance,'ai_inference');
 assert.deepEqual(Profile.buildCompanyIntelligenceProfile(i).evidenceSources.filter(row=>row.scope==='document').map(doc=>doc.id),['D2','brochure-42']);
});

test('a newly added unnamed document identity cannot collide with a retained citation ID',()=>{
 const i=input();i.documents=[{id:'D2',name:'retained.pdf',text:'Original retained proof'},{name:'new.pdf',text:'Unrelated new proof'}];
 const state=Profile.normalizeSavedState(i);
 assert.equal(state.documents[0].id,'D2');
 assert.match(state.documents[1].id,/^D\d+$/);
 assert.notEqual(state.documents[1].id,'D2');
 assert.equal(new Set(state.documents.map(doc=>doc.id)).size,2);
});

test('AJ hostname uses the same evidence-derived identity as any other seller',()=>{
 for(const website of ['https://www.ajprodukti.lv/','https://independent-seller.example/']){
  const i={...input(),website,scrapedSources:[{type:'website',url:website,title:'Reviewed Seller Brand | Products',text:'Reviewed Seller Brand provides clinical software.'}]};
  assert.equal(Profile.buildCompanyIntelligenceProfile(i).companyName,'Reviewed Seller Brand');
 }
 assert.equal(Profile.buildCompanyIntelligenceProfile({...input(),website:'https://www.ajprodukti.lv/',scrapedSources:[]}).companyName,'ajprodukti.lv');
});

test('AJ hostname cannot silently replace a saved reviewed company identity',()=>{
 for(const website of ['https://www.ajprodukti.lv/','https://independent-seller.example/']){
  const i={...input(),website,scrapedSources:[{type:'website',url:website,title:'Current Website Title',text:'We provide clinical software.'}],profile:{companyName:'Customer-reviewed legal identity',companyOverview:'Customer-reviewed company description',evidenceDigest:'Retained evidence'}};
  const next=Profile.normalizeSavedState(i);
  assert.equal(next.profile.companyName,'Customer-reviewed legal identity');
  assert.equal(Profile.normalizeSavedState(JSON.parse(JSON.stringify(next))).profile.companyName,'Customer-reviewed legal identity');
 }
});
