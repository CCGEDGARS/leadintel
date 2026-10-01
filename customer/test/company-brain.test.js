const test=require('node:test');
const assert=require('node:assert/strict');
const Brain=require('../company-brain.js');

const ccgroupInput={
  profile:{
    companyName:'Coaching & Consulting Group',
    priorityOffers:'Corporate sales training; business mentoring; business coaching; AI integration; digital marketing; content creation',
    companyOverview:'Sales training and business coaching company integrating psychology, NLP and AI tools for business.',
    differentiation:'15,000+ sales visits; corporate training experience; NLP methodology',
    buyingOutcomes:''
  },
  answers:{buying_triggers:''},
  scrapedSources:[
    {id:'E1',url:'https://www.ccgroup.lv/',title:'Coaching & Consulting Group',text:'Corporate sales training, business mentoring, coaching, AI integration and digital tools for business. Sales professionals and managers improve selling, communication and leadership skills.'}
  ],
  documents:[]
};

test('classifies sales training and coaching as professional services',()=>{
  const classification=Brain.classifyCompany(ccgroupInput);
  assert.equal(classification.businessType,'professional-services');
  assert.ok(classification.offerCategories.includes('sales-training'));
  assert.ok(classification.offerCategories.includes('coaching'));
});

test('digital tools do not create warehouse or storage pain points',()=>{
  const pains=Brain.derivePainPoints(ccgroupInput.profile,ccgroupInput,'en');
  const text=pains.join(' ').toLowerCase();
  assert.doesNotMatch(text,/warehouse|workshop|storage|tools, materials|retrieval time/);
  assert.match(text,/sales|leadership|commercial|process|skills/);
});

test('professional services receive business-model appropriate signal candidates without generic capex defaults',()=>{
  const signals=Brain.recommendSignals(ccgroupInput);
  const ids=signals.map(signal=>signal.id);
  assert.ok(ids.includes('sales-leadership-change'));
  assert.ok(ids.includes('sales-team-hiring'));
  assert.ok(ids.includes('sales-transformation'));
  assert.ok(ids.includes('ai-sales-tech'));
  assert.ok(!ids.includes('facility-expansion'));
  assert.ok(!ids.includes('capital-investment'));
  assert.ok(!ids.includes('tender'));
});

test('tender is recommended only when procurement evidence or explicit user trigger supports it',()=>{
  assert.ok(!Brain.recommendSignals(ccgroupInput).some(signal=>signal.id==='tender'));
  const withTender={...ccgroupInput,answers:{buying_triggers:'Formal procurement tender or RFP'}};
  assert.ok(Brain.recommendSignals(withTender).some(signal=>signal.id==='tender'));
});

test('claims preserve status confidence and evidence references',()=>{
  assert.deepEqual(Brain.claim('Corporate sales training','confirmed','high',['E1']),{
    value:'Corporate sales training',status:'confirmed',confidence:'high',evidenceIds:['E1']
  });
});

test('runtime patch upgrades Step 3 profile without warehouse contamination or generic B2B signals',()=>{
  const LeadIntelProfile={
    buildCompanyIntelligenceProfile(input){return {...input.profile,buyingTriggers:input.answers?.buying_triggers||''};},
    normalizeSavedState(value){return value;},
    deriveBusinessIdentity(profile){return {
      identityLanguage:'en',
      customerPainPoints:'legacy generated pain',
      analysis:{language:'en',frameworks:{goldenCircle:{why:'legacy',how:profile.differentiation,what:profile.priorityOffers},fab:{features:profile.priorityOffers,advantages:profile.differentiation,benefits:'legacy'},valueProposition:'legacy'}}
    };}
  };
  Brain.install({LeadIntelProfile});
  const profile=LeadIntelProfile.buildCompanyIntelligenceProfile(ccgroupInput);
  assert.equal(profile.companyClassification.businessType,'professional-services');
  assert.doesNotMatch(profile.customerPainPoints.toLowerCase(),/warehouse|workshop|storage|retrieval/);
  const ids=profile.recommendedSignals.map(signal=>signal.id);
  assert.ok(ids.includes('sales-leadership-change'));
  assert.ok(!ids.includes('facility-expansion'));
  assert.ok(!ids.includes('capital-investment'));
  assert.ok(!ids.includes('tender'));
  const identity=LeadIntelProfile.deriveBusinessIdentity(profile,ccgroupInput);
  assert.doesNotMatch(identity.analysis.frameworks.goldenCircle.why.toLowerCase(),/warehouse|workshop|storage/);
  assert.match(identity.analysis.frameworks.goldenCircle.why.toLowerCase(),/sales|manager|commercial|ai/);
});

test('profile pain-point generation follows the English workspace policy and refreshes stale generated Latvian text',()=>{
  const englishFallback='The specific customer problem is not yet sufficiently evidenced; LeadIntel should ask for confirmation before treating a pain point as fact.';
  const latvianFallback='Konkrētā klienta problēma vēl nav pietiekami pamatota; LeadIntel jāprasa apstiprinājums, pirms to uzskatīt par faktu.';
  const source={id:'E1',url:'https://ercon.lv/',title:'Ercon',text:'Ercon nodrošina rūpniecības inženieriju un metālapstrādi Latvijas uzņēmumiem.'};
  const input={
    uiLanguage:'lv',
    profile:{companyName:'Ercon',priorityOffers:'Rūpniecības inženierija un metālapstrāde'},
    answers:{},
    scrapedSources:[source],
    documents:[]
  };
  const engine={
    buildCompanyIntelligenceProfile(value){return {...value.profile};},
    normalizeSavedState(value){return structuredClone(value);},
    deriveBusinessIdentity(){return {identityLanguage:'lv',analysis:{language:'lv'}};}
  };
  const root={LeadIntelProfile:engine,LeadIntelContentLanguage:{workspaceContentLanguage:()=> 'en'}};
  Brain.install(root);

  const generated=engine.buildCompanyIntelligenceProfile(input);
  assert.equal(generated.customerPainPoints,englishFallback);
  assert.equal(generated.customerPainPointsLanguage,'en');

  const saved={...input,profile:{...input.profile,customerPainPoints:latvianFallback,customerPainPointsStatus:'AI-inferred · review recommended',customerPainPointsLanguage:'lv'}};
  const refreshed=engine.normalizeSavedState(saved);
  assert.equal(refreshed.profile.customerPainPoints,englishFallback);
  assert.equal(refreshed.profile.customerPainPointsLanguage,'en');

  const confirmed={...saved,profile:{...saved.profile,customerPainPointsStatus:'Customer-confirmed'}};
  assert.equal(engine.normalizeSavedState(confirmed).profile.customerPainPoints,latvianFallback);
});

test('industrial seller offer takes precedence over unrelated scraped sales wording and stale classification',()=>{
  const input={website:'https://www.ercon.lv/',profile:{companyName:'Ercon',priorityOffers:'Full-service industrial project delivery',companyOverview:'Industrial engineering and installation',companyClassification:{businessType:'professional-services',offerCategories:['sales-training']},recommendedSignals:[{id:'sales-team-hiring',name:'Sales team hiring or expansion'}]},scrapedSources:[{text:'Our partner offered sales training at this event.'}]};
  const classified=Brain.classifyCompany(input);
  assert.equal(classified.businessType,'industrial-services');
  const recommended=Brain.recommendSignals({...input,companyClassification:classified,profile:{...input.profile,companyClassification:classified}});
  assert.deepEqual(recommended.map(item=>item.id),['industrial-project','facility-expansion','capital-investment']);
  assert.deepEqual(Brain.unrelatedSignals(input.profile,input.profile.recommendedSignals).map(item=>item.id),['sales-team-hiring']);
});

test('loading a saved seller profile replaces stale classification and sales recommendations',()=>{
  const engine={normalizeSavedState(value){return structuredClone(value);},buildCompanyIntelligenceProfile(value){return value.profile;}};
  Brain.install({LeadIntelProfile:engine});
  const saved=engine.normalizeSavedState({website:'https://www.ercon.lv/',profile:{companyName:'Ercon',priorityOffers:'Full-service industrial project delivery',companyClassification:{businessType:'professional-services',offerCategories:['sales-training']},recommendedSignals:[{id:'sales-team-hiring',name:'Sales team hiring or expansion'}]}});
  assert.equal(saved.profile.companyClassification.businessType,'industrial-services');
  assert.deepEqual(saved.profile.recommendedSignals.map(item=>item.id),['industrial-project','facility-expansion','capital-investment']);
});

test('industrial project buyer roles are checked before company discovery',()=>{
  const profile={priorityOffers:'Full-service industrial project delivery',decisionMakers:'CEO/Owner; Sales/Commercial Director'};
  assert.equal(Brain.unrelatedBuyerRoles(profile,[{active:true,buyerRoles:'Sales Director'}]).length,2);
  assert.deepEqual(Brain.unrelatedBuyerRoles({priorityOffers:'Corporate sales training',decisionMakers:'Sales Director'},[]),[]);
});

test('buyer-role repair keeps market evidence, opportunities, signals, and the active seller',()=>{
  const original={website:'https://www.ercon.lv/',profile:{companyName:'Ercon',priorityOffers:'Full-service industrial project delivery',decisionMakers:'CEO/Owner; Sales Director'},market:{icps:[{id:'core',buyerRoles:'Sales Director',active:true}],signals:[{id:'industrial-project',name:'New industrial project'}],researchResults:[{url:'https://example.com/evidence'}],opportunities:[{market:'Sweden'}],researchStatus:'partial',strategyApproved:true}};
  const fixed=Brain.repairIndustrialBuyerRoles(original);
  assert.deepEqual(Brain.unrelatedBuyerRoles(fixed.profile,fixed.market.icps),[]);
  assert.match(fixed.profile.decisionMakers,/Project Director; Operations Director/);
  assert.equal(fixed.market.icps[0].buyerRoles,fixed.profile.decisionMakers);
  assert.deepEqual(fixed.market.researchResults,original.market.researchResults);
  assert.deepEqual(fixed.market.opportunities,original.market.opportunities);
  assert.deepEqual(fixed.market.signals,original.market.signals);
  assert.equal(fixed.website,original.website);
  assert.equal(fixed.market.strategyApproved,false);
  assert.equal(original.profile.decisionMakers,'CEO/Owner; Sales Director');
});

test('legacy industrial roles repaired only without explicit user answers',()=>{
 const state={profile:{priorityOffers:'Drawing development; serial production; custom metal manufacturing',decisionMakers:'CEO/Owner; Sales/Commercial Leadership'},answers:{},market:{icps:[{buyerRoles:'CEO/Owner; Sales/Commercial Leadership',active:true}]}};
 const repaired=Brain.repairLegacyStrategy(state);
 assert.match(repaired.profile.decisionMakers,/Engineering Director/);
 assert.equal(repaired.market.icps[0].buyerRoles,repaired.profile.decisionMakers);
 assert.equal(Brain.repairLegacyStrategy({...state,answers:{buyer_roles:'Sales Director'}}).profile.decisionMakers,state.profile.decisionMakers);
 const legal={...state,profile:{...state.profile,priorityOffers:'Legal advice'}};
 assert.equal(Brain.repairLegacyStrategy(legal),legal);
});
test('tender exclusion conflicts distinguish price qualification from broad exclusions',()=>{
 const signals=[{id:'tender',name:'Tender procurement',active:true}];
 assert.equal(Brain.strategyConflicts({exclusions:'lowest price in tender'},signals)[0].blocking,false);
 assert.equal(Brain.strategyConflicts({exclusions:'No tenders'},signals)[0].blocking,true);
 assert.deepEqual(Brain.strategyConflicts({exclusions:'No tenders'},[{...signals[0],active:false}]),[]);
});
