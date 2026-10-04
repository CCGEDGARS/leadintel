const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Discovery = require('../discovery-engine.js');
const Targeting = require('../targeting-policy.js');

function loadDiscoveryRunner({ renderFails = false, renderNodes = false, fetchImpl = () => new Promise(() => {}), bridgeImpl = null, requestTimeout = 1, scaleProductionRunTimeout = 15000, researchMode = 'deep' } = {}) {
  let source = fs.readFileSync(path.join(__dirname, '..', 'discovery-ui.js'), 'utf8');
  const runTimeout = source.match(/const DISCOVERY_RUN_TIMEOUT_MIN_MS=(\d+);/);
  const runMargin = source.match(/const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=(\d+);/);
  const extractionTimeout = source.match(/const COMPANY_EXTRACTION_TIMEOUT_MS=(\d+);/);
  const testRunTimeout = scaleProductionRunTimeout
    ? Math.ceil(Number(runTimeout?.[1] || 0) / scaleProductionRunTimeout)
    : 8;
  const testRunMargin = scaleProductionRunTimeout
    ? Math.ceil(Number(runMargin?.[1] || 0) / scaleProductionRunTimeout)
    : 2;
  const testExtractionTimeout = scaleProductionRunTimeout
    ? Math.ceil(Number(extractionTimeout?.[1] || 0) / scaleProductionRunTimeout)
    : Number(extractionTimeout?.[1] || 0);
  source = source
    .replace('const DISCOVERY_REQUEST_TIMEOUT_MS=25000;', `const DISCOVERY_REQUEST_TIMEOUT_MS=${requestTimeout};`)
    .replace(runTimeout?.[0], `const DISCOVERY_RUN_TIMEOUT_MIN_MS=${testRunTimeout};`)
    .replace(runMargin?.[0], `const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=${testRunMargin};`)
    .replace(extractionTimeout?.[0], `const COMPANY_EXTRACTION_TIMEOUT_MS=${testExtractionTimeout};`)
    .replace(/\ninitDiscoveryWhenReady\(\);\s*$/, '\ndiscovery=LeadIntelDiscovery.normalizeDiscoveryState({});\nglobalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__discoveryState = () => discovery;\nglobalThis.__setDiscovery = value => { discovery = LeadIntelDiscovery.normalizeDiscoveryState({...value,qualityVersion:value.qualityVersion??LeadIntelDiscovery.DISCOVERY_QUALITY_VERSION}); };\nglobalThis.__renderStatus = renderStatus;\nglobalThis.__setDiscoveryProgress=value=>{discoveryProgress=value;};\nglobalThis.__renderCandidates = renderCandidates;\n')
    .replace('globalThis.__runDiscovery = runCompanyDiscovery;', 'globalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__companyOrigin = companyOrigin;\nglobalThis.__mergeWorkflowCompanies = mergeWorkflowCompanies;\nglobalThis.__existingCompanyResearchTargets = existingCompanyResearchTargets;\nglobalThis.__selectQualifiedForBuyers = selectQualifiedForBuyers;\nglobalThis.__selectTargetForBuyers = selectTargetForBuyers;\nglobalThis.__confirmBuyerContact = confirmBuyerContact;\nglobalThis.__keepBuyer = keepBuyer;\nglobalThis.__confirmPublicBuyerSource=confirmPublicBuyerSource;\nglobalThis.__publicBuyerSource=publicBuyerSource;\nglobalThis.__acceptedBuyerConfirmationLevel=acceptedBuyerConfirmationLevel;\nglobalThis.__setBuyerConfirmationPolicy=()=>{buyerConfirmationLevel="public_confirmed";confirmationPolicyWorkspace=bridge()?.workspace?.id;};\nglobalThis.__holdBuyerForOpportunityReview = holdBuyerForOpportunityReview;\nglobalThis.__toggleBuyerContactFlow = toggleBuyerContactFlow;\nglobalThis.__enrichSelectedProspect = enrichSelectedProspect;\nglobalThis.__enrichContact = enrichContact;\nglobalThis.__scheduleSavedBuyerPublicChecks = scheduleSavedBuyerPublicChecks;\nglobalThis.__findPublicProspectContacts = findPublicProspectContacts;\nglobalThis.__retryFailedDiscoveryChecks = retryFailedDiscoveryChecks;\nglobalThis.__findPotentialDecisionMakers = findPotentialDecisionMakers;\nglobalThis.__savePotentialProspect = savePotentialProspect;\nglobalThis.__addSelectedProspectToPipeline = addSelectedProspectToPipeline;\nglobalThis.__setCrmCompanies = companies => { crmCompanies = companies; };\nglobalThis.__renderPipeline = renderPipeline;\nglobalThis.__renderSelectedProspects = renderSelectedProspects;\nglobalThis.__firecrawlCompanySearch = firecrawlCompanySearch;\nglobalThis.__discoveryRunTimeoutMs = discoveryRunTimeoutMs;\nglobalThis.__renderDiscoveryFunnel = renderDiscoveryFunnel;\nglobalThis.__renderPotentialMatches = renderPotentialMatches;\nglobalThis.__potentialBuyerResultsHtml = potentialBuyerResultsHtml;');
  const mainState = {
    website: 'https://acme.example/',
    profile: {
      website: 'https://acme.example/',
      targetMarkets: 'Latvia',
      priorityOffers: 'industrial automation',
      idealCustomer: 'manufacturers',
      decisionMakers: 'COO; Procurement Director; Plant Manager'
    },
    market: {
      researchMode,
      signals: [{ id: 'expansion', name: 'Expansion', active: true, weight: 9, keywords: 'new factory; expansion' }],
      opportunities: [{ market: 'Latvia', active: true, score: { total: 80 } }]
    }
  };
  mainState.answers={priority_offers:mainState.profile.priorityOffers,ideal_customer:mainState.profile.idealCustomer,buyer_roles:mainState.profile.decisionMakers,exclusions:'No specific exclusions'};
  mainState.targetingConfirmation=Targeting.confirm(mainState);
  const storage = new Map([['leadintel_customer_v2_state', JSON.stringify(mainState)],['leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5})]]);
  const elements = new Map();
  const getElementById = id => {
    if (renderFails && id === 'discovery-status') return { textContent: '' };
    if (!renderNodes) return null;
    if (!elements.has(id)) elements.set(id, {
      id, textContent: '', innerHTML: '', value: '', hidden: false, disabled: false, dataset: {},
      classList: (()=>{const values=new Set();return {add(...names){names.forEach(name=>values.add(name));},remove(...names){names.forEach(name=>values.delete(name));},toggle(name,force){const enabled=force??!values.has(name);if(enabled)values.add(name);else values.delete(name);return enabled;},contains(name){return values.has(name);}};})(),
      addEventListener() {}, remove() {}, insertAdjacentHTML() {}
    });
    return elements.get(id);
  };
  const context = {
    console: { ...console, error() {} },
    AbortController,
    DOMException,
    URL,
    URLSearchParams,
    dispatchEvent() {},
    LeadIntelDiscovery: Discovery,
    LeadIntelTargeting: Targeting,
    LeadIntelServerBridge: bridgeImpl,
    fetch: fetchImpl,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document: { getElementById, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ dataset: {}, addEventListener() {} }), head: { appendChild() {} }, body: { appendChild() {} } },
    navigator: { languages: [] },
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {}
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../first-party-research.js'),'utf8'),context);
  // Existing buyer fixtures represent a previously verified company; provide its readable official page.
  const readWebsite=context.LeadIntelFirstPartyResearch.collectWebsiteEvidence;
  context.LeadIntelFirstPartyResearch.collectWebsiteEvidence=options=>options.purpose==='buyers'
    ?readWebsite({...options,fetchImpl:async()=>({ok:true,json:async()=>({data:{markdown:'Official company website. We operate an industrial manufacturing business in the selected market, with production facilities, engineering capabilities and a management team.',metadata:{sourceURL:options.website}}})})})
    :readWebsite(options);
  vm.runInNewContext(source, context, { filename: 'discovery-ui.js' });
  context.__elements = elements;
  return context;
}

test('a permanently pending provider cannot leave Company Discovery running', async () => {
  const context = loadDiscoveryRunner();
  const completed = await Promise.race([
    context.__runDiscovery().then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 250))
  ]);
  assert.equal(completed, true);
  assert.notEqual(context.__discoveryState().status, 'running');
});

test('shortlist buyer results use distinct cards and reflect saved CRM status honestly',()=>{
  const context=loadDiscoveryRunner();
  const candidate={people:[{name:'Johan',title:'Project Director'},{name:'Mika',title:'Operations Director'}]};
  const saved=context.__potentialBuyerResultsHtml(candidate,{id:'crm-billerud'});
  assert.equal((saved.match(/class="potential-match-person"/g)||[]).length,2);
  assert.match(saved,/First name only · confirm identity/);
  assert.match(saved,/Saved in CRM as a prospect/);
  assert.doesNotMatch(saved,/was not saved to CRM/);
  const unsaved=context.__potentialBuyerResultsHtml(candidate,null);
  assert.match(unsaved,/Select the company for Buyers/);
});

test('a zero-result rerun keeps and clearly marks the last successful company results',async()=>{
  const context=loadDiscoveryRunner({fetchImpl:async()=>({ok:true,json:async()=>({success:true,data:[]})})});
  const previous={company:'Modvion',domain:'modvion.com',website:'https://modvion.com/',market:'Sweden',score:{total:86},confidence:'High',qualified:true,marketVerified:true,buyerVerified:true,matchedSignals:[{id:'launch',name:'Product launch',matchedTerms:['launch']}],evidence:[{url:'https://modvion.com/news/launch',title:'Modvion unveils a turbine tower'}]};
  context.__setDiscovery({status:'complete',lastRunAt:'2026-09-24T10:00:00.000Z',candidates:[previous],pipeline:[]});
  await context.__runDiscovery();
  const state=context.__discoveryState();
  assert.equal(state.status,'no_results');
  assert.equal(state.latestRunCandidateCount,0);
  assert.equal(state.funnel.qualifiedCompanies,0);
  assert.equal(state.retainedLastSuccessfulResults,true);
  assert.equal(state.candidates[0].domain,'modvion.com');
  assert.equal(state.lastSuccessfulRunAt,'2026-09-24T10:00:00.000Z');
});

test('a normal three-stage search is allowed to outlast one provider request window', async () => {
  const phases = new Set();
  const requestCounts = { market_search: 0, resolution: 0, verification: 0 };
  const companyNames = [
    'North Steel', 'Svea Machinery', 'Nordic Foundry', 'Polar Engineering', 'Baltic Mining',
    'Kiruna Metals', 'Stockholm Equipment', 'Vasa Industrial', 'Gothenburg Systems', 'Sundsvall Works'
  ];
  let marketSearchIndex = 0;
  const context = loadDiscoveryRunner({
    requestTimeout: 1000,
    scaleProductionRunTimeout: 1000,
    fetchImpl: async (_url, options) => {
      const query = JSON.parse(options.body).query;
      await new Promise(resolve => setTimeout(resolve, 8));
      if (query.startsWith('site:')) {
        phases.add('verification');
        requestCounts.verification += 1;
        const domain = query.match(/^site:([^ ]+)/)?.[1] || 'northsteel.lv';
        const company = companyNames.find(name => name.toLowerCase().replace(/[^a-z]/g, '') === domain.split('.')[0]) || 'North Steel';
        return { ok: true, json: async () => ({ success: true, data: [{
          date:new Date().toISOString().slice(0,10),url: `https://${domain}/news/new-factory`,
          title: `${company} opens a new factory in Latvia`,
          description: `${company} plans a new factory and expands production capacity in Latvia with new industrial automation.`,
          markdown: `${company} plans a new factory and expands production capacity in Latvia with new industrial automation.`
        }] }) };
      }
      const resolution = query.match(/^"([^"]+)"/);
      if (resolution) {
        phases.add('resolution');
        requestCounts.resolution += 1;
        const company = resolution[1];
        const domain = company.toLowerCase().replace(/[^a-z]/g, '');
        return { ok: true, json: async () => ({ success: true, data: [{
          url: `https://${domain}.lv/`, title: `${company} official website`,
          description: 'Industrial manufacturing company investing in industrial automation in Latvia.'
        }] }) };
      }
      phases.add('market_search');
      requestCounts.market_search += 1;
      const start = (marketSearchIndex++ % 4) * 5;
      return { ok: true, json: async () => ({ success: true, data: companyNames.slice(start, start + 5).map((company, index) => ({
        url: `https://industrynews${start + index}.example/articles/${index}`,
        title: `${company} plans a new factory`,
        description: `${company} plans a new factory and expands production capacity in Latvia with new industrial automation.`,
        markdown: `${company} plans a new factory and expands production capacity in Latvia with new industrial automation.`
      })) }) };
    }
  });

  await context.__runDiscovery();

  assert.deepEqual([...phases].sort(), ['market_search', 'resolution', 'verification']);
  assert.equal(requestCounts.market_search,10,'unverified buyer applications trigger bounded additional research');
  assert.ok(requestCounts.resolution > 4, 'the pipeline should have enough time to process multiple company resolutions');
  assert.ok(requestCounts.verification > 4, 'the pipeline should have enough time to verify multiple company websites');
  assert.notEqual(context.__discoveryState().status, 'error');
});

test('the run deadline covers the worst-case bounded search stages at each supported target size', () => {
  const context=loadDiscoveryRunner({requestTimeout:25,scaleProductionRunTimeout:1000});
  assert.equal(context.__discoveryRunTimeoutMs(10,4),1408);
  assert.equal(context.__discoveryRunTimeoutMs(25,8),1433);
  assert.equal(context.__discoveryRunTimeoutMs(50,10),1458);
});

test('a successful first pass with no qualified companies gets one bounded follow-up pass',async()=>{
  let marketRequests=0;
  let initialResults=0;
  let followUpResults=0;
  const context=loadDiscoveryRunner({
    requestTimeout:1000,
    scaleProductionRunTimeout:1000,
    fetchImpl:async (_url,options)=>{
      const query=JSON.parse(options.body).query;
      if(query.startsWith('site:'))return {ok:true,json:async()=>({success:true,data:[{
        date:new Date().toISOString().slice(0,10),url:'https://northsteel.lv/news/new-factory',title:'North Steel opens a new factory',
        description:'North Steel plans a new factory in Latvia, expands production capacity and invests in industrial automation.',
        markdown:'North Steel plans a new factory in Latvia, expands production capacity and invests in industrial automation. The new production site supplies manufacturing customers.'
      }]})};
      if(query.startsWith('"'))return {ok:true,json:async()=>({success:true,data:[{
        url:'https://northsteel.lv/',title:'North Steel official website',description:'Latvian industrial manufacturing company investing in industrial automation.'
      }]})};
      marketRequests+=1;
      if(marketRequests<=6){initialResults+=1;return {ok:true,json:async()=>({success:true,data:[]})};}
      followUpResults+=1;
      return {ok:true,json:async()=>({success:true,data:[{
        url:'https://industrynews.lv/north-steel-factory',title:'North Steel plans a new factory',
        description:'North Steel plans a new factory in Latvia, expands production capacity and invests in industrial automation.',
        markdown:'North Steel plans a new factory in Latvia, expands production capacity and invests in industrial automation. The new production site supplies manufacturing customers.'
      }]})};
    }
  });

  await context.__runDiscovery();

  const result=context.__discoveryState();
  assert.equal(initialResults,6);
  assert.equal(followUpResults,4,'the second pass has a strict four-search cap');
  assert.equal(result.status,'no_results');
  assert.equal(result.candidates.length,0,'without commercial application research the company remains unqualified');
  assert.equal(result.funnel.marketSearchesCompleted,10);
  assert.equal(result.funnel.marketSearchesTotal,10);
  assert.equal(result.funnel.evidencePages,3,'repeated URLs count once in the funnel');
  assert.equal(result.funnel.companiesIdentified,1);
  assert.equal(result.funnel.officialDomainsResolved,1);
  assert.equal(result.funnel.companySitesChecked,1);
  assert.equal(result.funnel.qualifiedCompanies,0);
  assert.equal(result.funnel.adaptiveFollowUpSearches,4);
});

test('a completed zero-result run renders the search funnel and unqualified matches separately',()=>{
  const context=loadDiscoveryRunner({renderNodes:true,researchMode:'quick'});
  context.__setDiscovery({
    status:'no_results',rawResults:[{url:'https://northstar.com/news',domain:'northstar.com',title:'Northstar expansion'}],
    funnel:{marketSearchesCompleted:8,marketSearchesTotal:8,evidencePages:7,companiesIdentified:1,officialDomainsResolved:1,companySitesChecked:1,verifiedCompanies:1,qualifiedCompanies:0,adaptiveFollowUpSearches:4},
    potentialMatches:[{company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',qualificationGaps:['Target market evidence is missing'],evidence:[{url:'https://northstar.com/news',title:'Northstar expansion'}]}],
    lastRunAt:'2026-09-23T00:00:00.000Z'
  });

  context.__renderDiscoveryFunnel();
  context.__renderCandidates();
  context.__renderPotentialMatches();

  assert.match(context.__elements.get('discovery-funnel').innerHTML,/Evidence pages/i);
  assert.match(context.__elements.get('discovery-funnel').innerHTML,/8 of 8/);
  assert.match(context.__elements.get('company-candidates').innerHTML,/Review Market Research/);
  assert.match(context.__elements.get('company-candidates').innerHTML,/valid finding/i);
  assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/Research review/i);
  assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/Needs more evidence|Not qualified/i);
  assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/Verify company identity/);
  assert.doesNotMatch(context.__elements.get('discovery-potential-matches').innerHTML,/Save to CRM|Add to Pipeline/);
});

test('unqualified research checks do not expose automatic buyer actions',()=>{
  const context=loadDiscoveryRunner({renderNodes:true});
  context.__setDiscovery({
    status:'no_results',checkedCompanyDomains:['northstar.com'],
    potentialMatches:[
      {company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Latvia',marketVerified:true,fitVerified:true,qualificationGaps:['No active buying signal was confirmed'],evidence:[{url:'https://industry.example/northstar',title:'Northstar company profile',description:'Latvian industrial manufacturer.'}]},
      {company:'Unknown Buyer',domain:'unknown.example',website:'https://unknown.example/',market:'Latvia',marketVerified:false,fitVerified:true,qualificationGaps:['Target market evidence is missing','No active buying signal was confirmed'],evidence:[{url:'https://industry.example/unknown',title:'Unknown Buyer profile'}]}
    ]
  });
  context.__renderPotentialMatches();
  const html=context.__elements.get('discovery-potential-matches').innerHTML;
  assert.equal((html.match(/data-action="find-potential-buyers"/g)||[]).length,0);
  assert.equal((html.match(/data-action="save-potential-prospect"/g)||[]).length,0);
  assert.match(html,/Needs more evidence|Not qualified/);
  assert.match(html,/No recent verified buying signal/);
  assert.doesNotMatch(html,/Save to CRM|Add to Pipeline/);
});

test('a verified-fit prospect can be saved by the user without inventing a signal or activating Pipeline',async()=>{
  const saved=[];
  const context=loadDiscoveryRunner({
    renderNodes:true,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},saveCrmCompany:async payload=>{saved.push(payload);return {ok:true,company:{id:'company-1',normalized_domain:payload.company.domain}};}}
  });
  context.LeadIntelCrm=require('../crm-engine.js');
  context.dispatchEvent=()=>{};
  context.__setDiscovery({status:'no_results',checkedCompanyDomains:['northstar.com'],potentialMatches:[
    {company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Sweden',marketVerified:true,fitVerified:true,qualificationGaps:['No active buying signal was confirmed'],evidence:[{url:'https://northstar.com/news',title:'Northstar company site'}]},
    {company:'Thule Group',domain:'thulegroup.com',website:'https://thulegroup.com/',market:'Sweden',marketVerified:true,fitVerified:true,qualificationGaps:['No active buying signal was confirmed'],evidence:[{url:'https://thulegroup.com/',title:'Thule Group'}]},
    {company:'Unverified',domain:'unverified.com',website:'https://unverified.com/',market:'Sweden',marketVerified:false,fitVerified:true,qualificationGaps:['Target market evidence is missing','No active buying signal was confirmed'],evidence:[{url:'https://unverified.com/',title:'Unverified'}]}
  ]});
  assert.equal(await context.__savePotentialProspect('unverified.com'),false);
  assert.equal(await context.__savePotentialProspect('thulegroup.com'),false,'a timed-out company-site check cannot be bypassed');
  assert.equal(saved.length,0);
  assert.equal(await context.__savePotentialProspect('northstar.com'),true);
  assert.equal(saved.length,1);
  assert.deepEqual(saved[0].intelligence.matched_signals,[]);
  assert.equal(saved[0].company.source,'user_selected_discovery');
  assert.equal(saved[0].company.opportunity_score,undefined);
  assert.equal(saved[0].company.pipeline_stage,undefined);
  assert.equal(context.__discoveryState().pipeline.length,0);
  const restored=require('../discovery-engine.js').normalizeDiscoveryState(context.__discoveryState());
  assert.equal(restored.selectedProspects[0].domain,'northstar.com');
  assert.deepEqual(restored.selectedProspects[0].matchedSignals,[]);
  assert.equal(restored.selectedProspects[0].score,undefined);
});

test('Buyers can explicitly promote a selected prospect without fabricating a score or buying signal',async()=>{
  const additions=[];
  const context=loadDiscoveryRunner({renderNodes:true,bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},addCrmToPipeline:async(id,stage)=>{additions.push({id,stage});return {ok:true,company:{id,normalized_domain:'northstar.com',pipeline_stage:stage}};}}});
  context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};
  const candidate={company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Sweden',marketVerified:true,fitVerified:true,qualificationGaps:['No active buying signal was confirmed'],evidence:[{url:'https://northstar.com/',title:'Northstar industrial manufacturer',text:'Northstar manufactures industrial equipment in Sweden.'}]};
  context.__setDiscovery({status:'complete',selectedProspects:[candidate]});
  context.__setCrmCompanies([{id:'crm-1',normalized_domain:'northstar.com',company_name:'Northstar',lifecycle_status:'prospect',source:'user_selected_discovery',pipeline_stage:null}]);
  context.__renderPipeline();
  assert.doesNotMatch(context.__elements.get('customer-pipeline').innerHTML,/Add to Pipeline/);
  assert.equal(context.__elements.get('discovery-pipeline-count').textContent,'1');
  assert.match(context.__elements.get('discovery-selection-breakdown').textContent,/1 selected for Buyers/);
  assert.equal(await context.__addSelectedProspectToPipeline('northstar.com'),true);
  assert.deepEqual(additions,[{id:'crm-1',stage:'Discovered'}]);
  const state=context.__discoveryState();
  assert.equal(state.pipeline.length,1);
  assert.equal(state.pipeline[0].qualified,false);
  assert.equal(state.pipeline[0].matchedSignals.length,0);
  assert.equal(state.pipeline[0].score.total,undefined);
  context.__renderPipeline();
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Buying signal unconfirmed/);
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Find decision-makers/);
  assert.match(context.__elements.get('discovery-selection-breakdown').textContent,/1 selected for Buyers/);
});

test('a user-selected fit-and-market verified potential match can display Apollo decision-makers without CRM promotion',async()=>{
  let crmSaves=0;
  const context=loadDiscoveryRunner({
    renderNodes:true,
    requestTimeout:1000,
    scaleProductionRunTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},searchApolloPeople:async()=>({ok:true,people:[{id:'p1',name:'Pat Example',title:'Chief Operating Officer',linkedin_url:'https://www.linkedin.com/in/pat-example'}]}),saveCrmCompany:async()=>{crmSaves+=1;return {ok:true};}},
    fetchImpl:async()=>({ok:true,json:async()=>({success:true,data:[{url:'https://www.linkedin.com/in/pat-example',title:'Pat Example – Chief Operating Officer at Northstar',description:'Chief Operating Officer at Northstar'}]})})
  });
  context.__setDiscovery({
    status:'no_results',checkedCompanyDomains:['northstar.com'],
    potentialMatches:[{company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Latvia',marketVerified:true,fitVerified:true,qualificationGaps:['No active buying signal was confirmed'],evidence:[{url:'https://industry.example/northstar',title:'Northstar company profile',description:'Latvian industrial manufacturer.'}]}]
  });
  await context.__findPotentialDecisionMakers('northstar.com');
  const candidate=context.__discoveryState().potentialMatches[0];
  assert.equal(candidate.peopleStatus,'complete');
  assert.equal(candidate.people[0].name,'Pat Example');
  assert.equal(candidate.buyerSearchMode,'user_selected_without_signal');
  assert.equal(context.__discoveryState().pipeline.length,0);
  assert.equal(crmSaves,0);
});

test('selected prospect buyer names persist and render as separate review cards',async()=>{
  const context=loadDiscoveryRunner({
    renderNodes:true,
    requestTimeout:1000,
    fetchImpl:async()=>({ok:true,json:async()=>({data:[{url:'https://linkedin.com/in/johan-example',title:'Johan Example – Chief Operating Officer at Northstar'},{url:'https://linkedin.com/in/mika-example',title:'Mika Example – Procurement Director at Northstar'}]})}),
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},searchApolloPeople:async()=>({ok:true,people:[
      {id:'p1',name:'Johan',title:'Chief Operating Officer'},
      {id:'p2',name:'Mika',title:'Procurement Director',linkedin_url:'https://www.linkedin.com/in/mika-example'}
    ]})}
  });
  const candidate={company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Sweden',marketVerified:true,fitVerified:true,qualificationGaps:['No active buying signal was confirmed'],evidence:[{url:'https://northstar.com/',title:'Northstar industrial manufacturer'}]};
  context.__setDiscovery({status:'no_results',selectedProspects:[candidate]});
  context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5}));
  assert.equal(await context.__findPotentialDecisionMakers('northstar.com'),true);
  const restored=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')));
  assert.deepEqual(restored.selectedProspects[0].people.map(person=>person.name),['Mika Example','Johan Example']);
  assert.equal(restored.pipeline.length,0);
  context.__renderPipeline();
  const html=context.__elements.get('customer-pipeline').innerHTML;
  assert.equal((html.match(/class="selected-prospect-person"/g)||[]).length,2);
  assert.doesNotMatch(html,/First name only/);
  assert.match(html,/linkedin\.com\/in\/mika-example/);
  assert.equal(context.__elements.get('discovery-status').textContent,'1 selected company');
});

test('unapproved automatic confirmation holds paid enrichment and never invokes optional Hunter',async()=>{
  const calls=[];
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},enrichCrmContact:async (_company,person,options)=>{calls.push(options.phoneLookup?'apollo-phone':'apollo-email');return {ok:true,contact:{name:person.name,...(options.phoneLookup?{phone_number:'+371 2000 0000'}:{work_email:'marta.berzina@example.lv'})}};}},
    fetchImpl:async(url)=>{
      const target=String(url);calls.push(target.includes('approved-workflow')?'approval':target.includes('/status?')?'hunter-status':target.includes('find-email')?'hunter-finder':'hunter-verifier');
      if(target.includes('approved-workflow'))return {ok:true,json:async()=>({status:'manual',config:{buyers:{confirmContacts:false}}})};
      if(target.includes('/status?'))return {ok:true,json:async()=>({providers:[{provider:'hunter',source:'customer'}]})};
      if(target.includes('find-email'))return {ok:true,json:async()=>({email:'marta.berzina@example.lv'})};
      return {ok:true,json:async()=>({email:'marta.berzina@example.lv',status:'valid',deliverability:'deliverable',checked_at:new Date().toISOString()})};
    }});
  context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.lv',buyerSearchMode:'user_selected_target',publicContactStatus:'complete',people:[{id:'apollo-12345',name:'Marta Berzina'}]}]});
  context.__setCrmCompanies([{id:'c1',normalized_domain:'example.lv'}]);
  const candidate=context.__discoveryState().selectedProspects[0];
  const emailBox={dataset:{flowDomain:'example.lv',flowScope:'selected',flowConfirm:'email',personIndex:'0'},checked:true};
  const phoneBox={dataset:{flowDomain:'example.lv',flowScope:'selected',flowConfirm:'phone',personIndex:'0'},checked:true};
  context.__toggleBuyerContactFlow(emailBox);
  context.__toggleBuyerContactFlow(phoneBox);
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.deepEqual(calls,['approval','hunter-status','approval']);
  assert.equal(Object.keys(candidate.people[0].hunterChecks||{}).length,0);
  assert.equal(candidate.people[0].flowEmailCompletedFor,'');
  assert.equal(candidate.people[0].flowPhoneCompletedFor,'');
});

test('a first-name-only buyer triggers one public source check and renders a sourced full name without Apollo enrichment',async()=>{
  let publicSearches=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},searchApolloPeople:async()=>({ok:true,people:[{id:'p1',name:'Mikael',title:'President & CEO'}]})},
    fetchImpl:async(url,options)=>{
      if(!(/\/firecrawl(?:-search|\/search)/.test(String(url))))throw new Error('Unexpected request');
      publicSearches++;
      if(publicSearches===1){assert.match(JSON.parse(options.body).query,/"Mikael"/);return {ok:true,json:async()=>({data:[{url:'https://boliden.com/management',title:'Management',markdown:'Mikael Example — President & CEO. mikael.example@boliden.com'}]})};}
      if(publicSearches===2)return {ok:true,json:async()=>({data:[]})};
      if(JSON.parse(options.body).query.includes('@'))return {ok:true,json:async()=>({data:[]})};
      assert.match(JSON.parse(options.body).query,/site:linkedin\.com\/in\//);
      return {ok:true,json:async()=>({data:[{url:'https://www.linkedin.com/in/mikael-example',title:'Mikael Example – Boliden | LinkedIn',description:'President and CEO at Boliden'}]})};
    }});
  context.__setDiscovery({status:'no_results',selectedProspects:[{company:'Boliden',domain:'boliden.com',market:'Sweden',buyerSearchMode:'user_selected_target',buyerRoles:'CEO',people:[{id:'p1',name:'Mikael',title:'President & CEO'}]}]});
  await context.__findPublicProspectContacts('boliden.com');
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(publicSearches,7); // Company patterns only; Gmail is searched by full name and company.
  assert.equal(context.__discoveryState().selectedProspects[0].people[0].publicName,'Mikael Example');
  assert.equal(context.__discoveryState().selectedProspects[0].people[0].publicLinkedinUrl,'https://www.linkedin.com/in/mikael-example');
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/mikael\.example@boliden\.com · Public listing/);
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/<strong>LinkedIn<\/strong><span>Public match/);
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/mikael\.example@boliden\.com/);
});

test('a saved first-name-only buyer receives one automatic public check when Buyers opens',async()=>{
  let requests=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async()=>{
    requests++;
    return {ok:true,json:async()=>({data:[{url:'https://boliden.com/management',title:'Leadership',markdown:'Mikael Example — President & CEO'}]})};
  }});
  context.__setDiscovery({selectedProspects:[{company:'Boliden',domain:'boliden.com',buyerSearchMode:'user_selected_target',people:[{id:'p1',name:'Mikael',title:'President & CEO'}]}]});
  context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5,visibleStep:5}));
  context.__scheduleSavedBuyerPublicChecks();
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(requests,10); // Official pages, profiles, grouped patterns, and one focused email search.
  assert.equal(context.__discoveryState().selectedProspects[0].people[0].publicName,'Mikael Example');
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Mikael Example/);
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(requests,10);
});

test('a saved first-name buyer can gain a sourced full name from a unique public LinkedIn result',async()=>{
  let requests=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async(url,options)=>{
    if(String(url).includes('/firecrawl-scrape'))return {ok:true,json:async()=>({data:{}})};
    assert.match(String(url),/firecrawl-search/);
    requests++;
    if(requests<=2)return {ok:true,json:async()=>({data:[]})};
    if(JSON.parse(options.body).query.includes('@'))return {ok:true,json:async()=>({data:[]})};
    assert.match(JSON.parse(options.body).query,/"Jacob".*"Södra"/);
    return {ok:true,json:async()=>({data:[{url:'https://se.linkedin.com/in/jacob-jonstoij',title:'Jacob Jonstoij – Södra | LinkedIn',description:'Teamledare at Södra'}]})};
  }});
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',publicContactStatus:'complete',people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5,visibleStep:5}));
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(requests,8);
  const person=context.__discoveryState().selectedProspects[0].people[0];
  assert.equal(person.publicName,'Jacob Jonstoij');
  assert.equal(context.__discoveryState().selectedProspects[0].publicContactVersion,'buyer-contacts-v18-profile-scope');
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Jacob Jonstoij/);
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/<strong>LinkedIn<\/strong><span>Public match/);
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(requests,8);
});

test('a focused LinkedIn lookup resolves a buyer missed by the combined search',async()=>{
  let requests=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async(url,options)=>{
    if(String(url).includes('/firecrawl-scrape'))return {ok:true,json:async()=>({data:{}})};
    requests++;
    if(requests<4)return {ok:true,json:async()=>({data:[]})};
    if(JSON.parse(options.body).query.includes('@'))return {ok:true,json:async()=>({data:[]})};
    assert.match(JSON.parse(options.body).query,/"Jacob" "Södra" "Team Leader"/);
    return {ok:true,json:async()=>({data:[{url:'https://se.linkedin.com/in/jacob-jonstoij-3bb486222',title:'Jacob Jonstoij – Team Leader | LinkedIn',description:'Team Leader at Södra'}]})};
  }});
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5,visibleStep:5}));
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(requests,9);
  assert.equal(context.__discoveryState().selectedProspects[0].people[0].publicName,'Jacob Jonstoij');
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Jacob Jonstoij/);
});

test('grounded follow-up extracts an official person email and keeps company phone separate',async()=>{
  let apolloCalls=0,openAiCalls=0,scrapes=0,geminiCalls=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},enrichCrmContact:async()=>{apolloCalls++;return {ok:true};}},
    fetchImpl:async(url,options)=>{
      const target=String(url);
      if(target.includes('/api/ai/web-search')){openAiCalls++;return {ok:true,json:async()=>({results:[{url:'https://sodra.com/team',title:'Södra team',description:'Jacob Jonstoij — Team Leader'}]})};}
      if((/\/firecrawl(?:-scrape|\/scrape)/.test(target))){scrapes++;const targetUrl=JSON.parse(options.body).url;return {ok:true,json:async()=>({data:targetUrl.endsWith('/team')?{metadata:{sourceURL:targetUrl},title:'Södra team',markdown:'Jacob Jonstoij — Team Leader. jacob.jonstoij@sodra.com'}:{metadata:{sourceURL:targetUrl},markdown:'Contact Södra: info@sodra.com · +46 470 890 00'}})};}
      if(target.includes('/api/ai/contact-evidence-review')){geminiCalls++;return {ok:true,json:async()=>({status:'complete',provider:'gemini',web_search:false,conflicts:[]})};}
      if((/\/firecrawl(?:-search|\/search)/.test(target))){
        const query=JSON.parse(options.body).query;
        if(query.includes('(contact OR contacts'))return {ok:true,json:async()=>({data:[{url:'https://sodra.com/contact',title:'Contact',markdown:'info@sodra.com · +46 470 890 00'}]})};
        return {ok:true,json:async()=>({data:[]})};
      }
      throw new Error(`Unexpected request ${target}`);
    }
  });
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  assert.equal(await context.__findPublicProspectContacts('sodra.com'),true);
  const candidate=context.__discoveryState().selectedProspects[0],person=candidate.people[0];
  assert.equal(person.publicEmail,'jacob.jonstoij@sodra.com');
  assert.equal(person.publicEmailUrl,'https://sodra.com/team');
  assert.equal(person.phone_number,undefined);
  assert.ok(candidate.publicContacts.some(row=>row.kind==='phone'&&row.value.includes('+46')));
  assert.equal(candidate.publicResearch.openai,'complete');
  assert.equal(candidate.publicResearch.gemini,'complete');
  assert.ok(openAiCalls>=1);assert.equal(scrapes,2);assert.equal(geminiCalls,1);assert.equal(apolloCalls,0);
});

test('refresh repairs a truncated name, matches LinkedIn, and shows official company contacts separately',async()=>{
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async(url,options)=>{
    const target=String(url);
    if((/\/firecrawl(?:-scrape|\/scrape)/.test(target)))return {ok:true,json:async()=>({data:{metadata:{sourceURL:'https://sodra.com/en/global/'},markdown:'Contact us. Phone: +46 470 890 00. Email: info@sodra.com'}})};
    const query=JSON.parse(options.body).query;
    if(query.includes('site:linkedin.com/in/')&&query.includes('"Lotta"'))return {ok:true,json:async()=>({data:[{url:'https://se.linkedin.com/in/lottalyra',title:'Lotta Lyrå – CEO & President på Södra | LinkedIn',description:'CEO & President på Södra'}]})};
    if(query.includes('site:linkedin.com/in/'))return {ok:true,json:async()=>({data:[]})};
    if(query.includes('(contact OR contacts'))return {ok:true,json:async()=>({data:[]})};
    return {ok:true,json:async()=>({data:[{url:'https://sodra.com/sv/se/omoss/organisation/',title:'Management',markdown:'Lotta Lyrå — CEO & President of Södra.'}]})};
  }});
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'p-lotta',name:'Lotta',title:'CEO & President',publicName:'Lotta Lyr',publicNameUrl:'https://sodra.com/sv/se/omoss/organisation/'}]}]});
  assert.equal(await context.__findPublicProspectContacts('sodra.com'),true);
  const candidate=context.__discoveryState().selectedProspects[0],person=candidate.people[0];
  assert.equal(person.publicName,'Lotta Lyrå');
  assert.equal(person.publicLinkedinUrl,'https://se.linkedin.com/in/lottalyra');
  assert.equal(person.publicEmail,'');
  assert.ok(candidate.publicContacts.some(row=>row.value==='info@sodra.com'));
  assert.ok(candidate.publicContacts.some(row=>row.value.includes('+46 470')));
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Lotta Lyrå/);
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/<strong>Phone<\/strong><span>No direct phone found in public searches<\/span>/);
  assert.doesNotMatch(context.__elements.get('customer-pipeline').innerHTML,/<strong>\+46 470 890 00<\/strong> · Public listing/);
});

test('independent grounded Gemini source resolves a profile missed by Firecrawl and OpenAI',async()=>{
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'}},
    fetchImpl:async(url,options)=>{
      const target=String(url);
      if(target.includes('/api/ai/grounded-contact-search'))return {ok:true,json:async()=>({status:'complete',web_search:true,results:[{url:'https://se.linkedin.com/in/lottalyra',title:'Lotta Lyrå – CEO & President på Södra | LinkedIn',description:'CEO & President på Södra'}]})};
      if(target.includes('/api/ai/web-search'))return {ok:true,json:async()=>({results:[]})};
      if(target.includes('/api/ai/contact-evidence-review'))return {ok:true,json:async()=>({status:'complete',conflicts:[]})};
      if((/\/firecrawl(?:-scrape|\/scrape)/.test(target)))return {ok:true,json:async()=>({data:{metadata:{sourceURL:'https://sodra.com/'},markdown:'[Contact](https://sodra.com/en/global/contact/)'}})};
      return {ok:true,json:async()=>({data:[]})};
    }
  });
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'p-lotta',name:'Lotta',title:'CEO & President'}]}]});
  assert.equal(await context.__findPublicProspectContacts('sodra.com'),true);
  const candidate=context.__discoveryState().selectedProspects[0];
  assert.equal(candidate.people[0].publicName,'Lotta Lyrå');
  assert.equal(candidate.people[0].publicLinkedinUrl,'https://se.linkedin.com/in/lottalyra');
  assert.equal(candidate.publicResearch.geminiSearch,'complete');
  assert.equal(candidate.publicResearch.geminiResults,1);
});

test('email button stops at a sourced public work email without calling Apollo',async()=>{
  let searches=0,apolloCalls=0,savedContacts=0,confirmations=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},saveCrmCompany:async()=>({ok:true,company:{id:'crm-sodra',normalized_domain:'sodra.com'}}),saveCrmContacts:async()=>{savedContacts++;return {ok:true};},enrichCrmContact:async()=>{apolloCalls++;return {ok:true};}},
    fetchImpl:async()=>{searches++;return {ok:true,json:async()=>({data:searches===1?[{url:'https://sodra.com/team',title:'Team',markdown:'Jacob Jonstoij — Team Leader. jacob.jonstoij@sodra.com'}]:[]})};}
  });
  context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};context.confirm=()=>{confirmations++;return true;};
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  assert.equal(await context.__enrichSelectedProspect('sodra.com',0),true);
  assert.equal(apolloCalls,0);
  assert.equal(confirmations,0);
  assert.ok(savedContacts>=1);
  assert.equal(context.__discoveryState().selectedProspects[0].people[0].publicEmail,'jacob.jonstoij@sodra.com');
});

test('email button offers Apollo only after a completed public search has no person match',async()=>{
  let searches=0,apolloCalls=0,confirmations=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},saveCrmCompany:async()=>({ok:true,company:{id:'crm-sodra',normalized_domain:'sodra.com'}}),enrichCrmContact:async()=>{apolloCalls++;return {ok:true,contact:{work_email:'jacob@sodra.com'}};}},
    fetchImpl:async()=>{searches++;return {ok:true,json:async()=>({data:[]})};}
  });
  context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};context.confirm=()=>{confirmations++;return true;};
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  assert.equal(await context.__enrichSelectedProspect('sodra.com',0),true);
  assert.equal(searches,8);
  assert.equal(confirmations,1);
  assert.equal(apolloCalls,1);
});

test('public search failure does not silently activate Apollo',async()=>{
  let apolloCalls=0;
  const context=loadDiscoveryRunner({renderNodes:false,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},enrichCrmContact:async()=>{apolloCalls++;return {ok:true};}},
    fetchImpl:async()=>({ok:false,status:503,json:async()=>({})})
  });
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  assert.equal(await context.__enrichSelectedProspect('sodra.com',0,{confirmed:true}),false);
  assert.equal(apolloCalls,0);
});

test('qualified company email action uses public evidence before Apollo',async()=>{
  let apolloCalls=0,savedContacts=0,confirmations=0;
  const context=loadDiscoveryRunner({renderNodes:false,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},saveCrmCompany:async()=>({ok:true,company:{id:'crm-sodra',normalized_domain:'sodra.com'}}),saveCrmContacts:async()=>{savedContacts++;return {ok:true};},enrichCrmContact:async()=>{apolloCalls++;return {ok:true};}},
    fetchImpl:async()=>({ok:true,json:async()=>({data:[{url:'https://sodra.com/team',title:'Team',markdown:'Jacob Jonstoij — Team Leader. jacob.jonstoij@sodra.com'}]})})
  });
  context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};context.confirm=()=>{confirmations++;return true;};
  context.__setDiscovery({candidates:[{company:'Södra',domain:'sodra.com',qualified:true,marketVerified:true,buyerVerified:true,matchedSignals:[{id:'s1'}],evidence:[{url:'https://sodra.com/news',title:'Södra news'}],people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  assert.equal(await context.__enrichContact(0,0),true);
  assert.equal(apolloCalls,0);
  assert.equal(confirmations,0);
  assert.equal(savedContacts,1);
  assert.equal(context.__discoveryState().candidates[0].people[0].publicEmail,'jacob.jonstoij@sodra.com');
});

test('a timed-out company website check can recover with grounded official-domain evidence',async()=>{
  let failedSearches=0,groundedSearches=0;
  const context=loadDiscoveryRunner({
    requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'}},
    fetchImpl:async url=>{
      if(url.includes('/firecrawl-search')){failedSearches++;return {ok:false,status:503,json:async()=>({})};}
      if(url.includes('/api/ai/web-search')){groundedSearches++;return {ok:true,json:async()=>({results:[{url:'https://thulegroup.com/news/factory',title:'Thule Group new factory',description:'Thule Group expands production in Sweden.'}]})};}
      throw new Error('Unexpected request');
    }
  });
  const results=await context.__firecrawlCompanySearch({id:'verify-thule',kind:'verification',company:'Thule Group',domain:'thulegroup.com',market:'Sweden',query:'site:thulegroup.com new factory'});
  assert.equal(failedSearches,1);
  assert.equal(groundedSearches,1);
  assert.equal(results[0].domain,'thulegroup.com');
  assert.equal(context.__discoveryState().funnel.openAiFallbackSearches,1);
});

test('Saving Mode verifies a saved target domain without repeating resolution and checks event evidence and recovers without repeating the website scrape',async()=>{
  const requests=[];
  const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:1000,fetchImpl:async(url,options)=>{
    requests.push({url,body:JSON.parse(options.body)});
    if(url.includes('/firecrawl-scrape'))return {ok:true,json:async()=>({data:{markdown:'Södra is a Swedish manufacturer expanding its new factory and investing in industrial automation. The company produces industrial materials for manufacturing customers.',metadata:{sourceURL:'https://sodra.com/',title:'Södra expansion in Sweden'}}})};
    if(url.includes('/firecrawl-search')&&requests.filter(item=>item.url.includes('/firecrawl-search')).length===1)return {ok:true,json:async()=>({data:[{url:'https://sodra.com/',title:'Södra',description:'Södra is a Swedish manufacturer.'}]})};
    if(url.includes('/firecrawl-search'))throw new TypeError('Connection failed');
    throw new Error('Unexpected request');
  }});
  const state=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
  state.targetCompanies=[{companyName:'Södra',website:'https://sodra.com/',domain:'sodra.com'}];state.targetMarkets=['Sweden'];state.profile.targetMarkets='Sweden';state.targetingConfirmation=Targeting.confirm(state);
  context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(state));
  await context.__runDiscovery({targetOnly:true,savingMode:true,targetDomain:'sodra.com'});
  assert.equal(requests.some(item=>item.body.query?.includes('official company website')),false);
  assert.equal(requests.filter(item=>item.url.includes('/firecrawl-search')).length,2);
  assert.equal(requests.filter(item=>item.url.includes('/firecrawl-scrape')).length,1);
  assert.equal(context.__discoveryState().savingMode,true);
  assert.equal(context.__discoveryState().funnel.companySitesChecked,1);
  assert.equal(context.__discoveryState().searchFailures.length,1);
});

test('retry of a failed saved-target lookup uses the known domain and preserves Saving Mode',async()=>{
  const requests=[];
  const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:1000,fetchImpl:async(url,options)=>{
    requests.push({url,body:JSON.parse(options.body)});
    if(url.includes('/firecrawl-search'))return {ok:true,json:async()=>({data:[{url:'https://sodra.com/news/new-factory',title:'Södra new factory',description:'Södra expands production in Sweden with a new factory.'}]})};
    throw new Error('Unexpected request');
  }});
  const state=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
  state.targetCompanies=[{companyName:'Södra',website:'https://sodra.com/',domain:'sodra.com'}];state.targetMarkets=['Sweden'];state.targetingConfirmation=Targeting.confirm(state);
  context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(state));
  context.__setDiscovery({status:'error',savingMode:true,searchFailures:[{phase:'resolving',company:'Södra',queryMeta:{id:'resolve-sodra',kind:'resolution',company:'Södra',market:'Sweden',query:'"Södra" Sweden official company website'},reason:'network_error'}],funnel:{marketSearchesCompleted:1,marketSearchesTotal:1,openAiFallbackSearches:1}});
  await context.__retryFailedDiscoveryChecks();
  assert.equal(requests.length,2);
  assert.match(requests[0].body.url,/sodra\.com/);
  assert.match(requests[1].body.query,/site:sodra\.com/);
  assert.doesNotMatch(requests[1].body.query,/official company website/);
  assert.equal(requests[1].body.limit,2);
  assert.equal(context.__discoveryState().funnel.openAiFallbackSearches,0);
  assert.equal(context.__discoveryState().funnel.companySitesChecked,0);
});

test('Saving Mode samples two saved targets and one opportunity hypothesis within its search budget',async()=>{
  const requests=[];
  const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:1000,fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body);requests.push({url,body});
    const target=/site:(sodra|boliden)\.com/.exec(body.query);
    return {ok:true,json:async()=>({data:target?[{url:`https://${target[1]}.com/news`,title:target[1],description:`${target[1]} operates in Sweden.`}]:[]})};
  }});
  const state=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
  state.targetCompanies=['Södra','Boliden','Billerud'].map((companyName,index)=>({companyName,website:`https://${['sodra','boliden','billerud'][index]}.com/`,domain:`${['sodra','boliden','billerud'][index]}.com`}));
  state.targetMarkets=['Sweden'];state.profile.targetMarkets='Sweden';state.targetingConfirmation=Targeting.confirm(state);
  state.referenceCustomers={analyzedAt:'2026-09-27T09:00:00Z',opportunityMap:{analysisAt:'2026-09-27T09:00:00Z',service:'Automation',problem:'Production efficiency',hypotheses:[{niche:'Packaging plants',sharedNeed:'Upgrade machinery',evidenceToCheck:'Factory investment'}]}};
  context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(state));
  await context.__runDiscovery({savingMode:true});
  const searches=requests.filter(item=>item.url.includes('/firecrawl-search'));
  assert.ok(searches.length<=10);
  assert.equal(searches.filter(item=>item.body.query.includes('site:sodra.com')||item.body.query.includes('site:boliden.com')||item.body.query.includes('site:billerud.com')).filter(item=>!item.body.query.startsWith('site:')).length,2);
  assert.equal(context.__discoveryState().funnel.marketSearchesTotal,4);
  assert.ok(searches.every(item=>item.body.limit<=4));
  assert.equal(searches.some(item=>/official company website/.test(item.body.query)&&/Södra|Boliden/.test(item.body.query)),false,"known target domains should skip resolution during general discovery");
  assert.equal(context.__discoveryState().funnel.firecrawlSearchCalls,searches.length);
  assert.ok(context.__discoveryState().funnel.companySitesChecked<=3);
});

test('an aborted resolution stage does not start company verification', async () => {
  const phases=[];
  let actions=null;
  const context=loadDiscoveryRunner({
    requestTimeout:1000,
    fetchImpl:async (_url,options)=>{
      const query=JSON.parse(options.body).query;
      if(query.startsWith('"')){
        actions.cancel();
        throw Object.assign(new Error('aborted'),{name:'AbortError'});
      }
      return {ok:true,json:async()=>({success:true,data:Array.from({length:5},(_,index)=>({
        url:`https://industrynews${index}.example/article`,
        title:`Buyer${index} plans a new factory`,
        description:`Buyer${index} plans a new factory in Latvia.`,
        markdown:`Buyer${index} plans a new factory in Latvia.`
      }))})};
    }
  });
  context.LeadIntelTaskCentre={
    start(){},
    registerActions(_id,value){actions=value;},
    update(_id,value){if(value.stage)phases.push(value.stage);},
    get(){return {status:'canceled'};},
    fail(){},complete(){}
  };

  await context.__runDiscovery();

  assert.ok(phases.includes('Resolving official company domains'));
  assert.equal(phases.includes('Verifying company websites'),false);
});

test('an errored search is not presented as a confirmed no-match and offers retry', () => {
  const context = loadDiscoveryRunner({ renderNodes: true });
  context.__setDiscovery({ status: 'error', rawResults: [], candidates: [], lastRunAt: '2026-09-23T00:00:00.000Z' });

  context.__renderStatus();
  context.__renderCandidates();

  assert.equal(context.__elements.get('discovery-status').textContent, 'Search issue');
  assert.match(context.__elements.get('company-discovery-status').textContent, /search did not complete/i);
  assert.doesNotMatch(context.__elements.get('company-discovery-status').textContent, /no company passed/i);
  assert.match(context.__elements.get('run-company-discovery').innerHTML, /Retry company search/);
});

test('transient Firecrawl failures are retried once before being reported',async()=>{
  let requests=0;
  const context=loadDiscoveryRunner({fetchImpl:async()=>{
    requests+=1;
    if(requests===1)return {ok:false,status:503,json:async()=>({error:'temporary outage'})};
    return {ok:true,json:async()=>({success:true,data:[{url:'https://buyer.lv/news',title:'Buyer update',description:'Company update.'}]})};
  }});
  const result=await context.__firecrawlCompanySearch({id:'verify-buyer',market:'Latvia',domain:'buyer.lv',company:'Buyer',kind:'verification',query:'site:buyer.lv expansion'});
  assert.equal(requests,2);
  assert.equal(result.length,1);
});

test('failed company-site checks can be retried without repeating market searches and successful results qualify',async()=>{
  let requests=0;
  const context=loadDiscoveryRunner({
    renderNodes:true,
    requestTimeout:1000,
    fetchImpl:async(_url,options)=>{
      requests+=1;
      const query=JSON.parse(options.body).query;
      assert.match(query,/^site:northstar\.com/);
      return {ok:true,json:async()=>({success:true,data:[{
        date:new Date().toISOString().slice(0,10),url:'https://northstar.com/news/new-factory',title:'Northstar expands its Latvian production site',
        description:'Northstar is a Latvian industrial manufacturer investing in automation and expanding production capacity at a new factory.',
        markdown:'Northstar is a Latvian industrial manufacturer investing in automation and expanding production capacity at a new factory. The company designs and manufactures industrial equipment.'
      }]})};
    }
  });
  context.__setDiscovery({
    qualityVersion:Discovery.DISCOVERY_QUALITY_VERSION,status:'error',lastRunAt:'2026-09-25T11:00:00.000Z',
    rawResults:[{queryId:'discover-latvia-1',market:'Latvia',url:'https://industry.example/northstar',domain:'industry.example',company:'Northstar',title:'Northstar company profile',description:'Latvian industrial manufacturer investing in automation.'}],
    companyMentions:[{company:'Northstar',market:'Latvia',sourceUrl:'https://industry.example/northstar'}],
    checkedCompanyDomains:[],
    funnel:{marketSearchesCompleted:4,marketSearchesTotal:4,evidencePages:1,companiesIdentified:1,officialDomainsResolved:1,companySitesChecked:0,qualifiedCompanies:0},
    potentialMatches:[{company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Latvia',marketVerified:true,fitVerified:true,qualificationGaps:['No active buying signal was confirmed'],evidence:[{url:'https://industry.example/northstar',sourceDomain:'industry.example',title:'Northstar company profile',description:'Latvian industrial manufacturer investing in automation.'}]}],
    searchFailures:[{phase:'verifying',company:'Northstar',domain:'northstar.com',queryMeta:{id:'verify-northstar',kind:'verification',company:'Northstar',domain:'northstar.com',market:'Latvia',sourceUrl:'https://industry.example/northstar',query:'site:northstar.com "new factory"'},reason:'provider_unavailable',status:503}]
  });
  assert.equal(context.__discoveryState().searchFailures[0].phase,'verifying');
  assert.equal(context.__discoveryState().searchFailures[0].queryMeta.domain,'northstar.com');
  assert.match(context.__discoveryState().searchFailures[0].queryMeta.query,/^site:/);

  await context.__retryFailedDiscoveryChecks();

  const state=context.__discoveryState();
  assert.equal(requests,2,`one direct website read and the failed evidence search should be retried: ${JSON.stringify(context.__discoveryState().searchFailures)}`);
  assert.equal(state.funnel.marketSearchesCompleted,4,'market searches must not be repeated or recounted');
  assert.equal(state.funnel.companySitesChecked,1);
  assert.equal(state.funnel.qualifiedCompanies,1,JSON.stringify({potential:state.potentialMatches,candidates:state.candidates,raw:state.rawResults,failures:state.searchFailures}));
  assert.equal(state.candidates[0].domain,'northstar.com');
  assert.equal(state.searchFailures.length,0);
  assert.equal(state.status,'complete');
});

test('saved results from older scoring rules require a fresh company search',()=>{
  const context=loadDiscoveryRunner({renderNodes:true});
  context.__setDiscovery({qualityVersion:Discovery.DISCOVERY_QUALITY_VERSION-1,status:'complete',rawResults:[{url:'https://old.se/news',domain:'old.se'}],lastRunAt:'2026-09-24T12:00:00.000Z'});
  context.__renderStatus();
  context.__renderCandidates();
  assert.equal(context.__discoveryState().needsRefresh,true);
  assert.match(context.__elements.get('company-discovery-status').textContent,/scores need rechecking/i);
  assert.match(context.__elements.get('company-candidates').innerHTML,/No retained company shortlist/i);
  assert.match(context.__elements.get('run-company-discovery').innerHTML,/Refresh company results/i);
});

test('provider failures fail the Discovery task and cannot be reported as completed zero results', async () => {
  let failedTask='';
  let completedTask=false;
  let requests=0;
  const context=loadDiscoveryRunner({
    renderNodes:true,
    requestTimeout:1,
    scaleProductionRunTimeout:500,
    fetchImpl:async()=>{requests+=1;return {ok:false,status:503,json:async()=>({error:'Provider unavailable'})};}
  });
  context.LeadIntelTaskCentre={
    start(){},registerActions(){},update(){},get(){return {status:'running'};},
    fail(_id,error){failedTask=error.message;},
    complete(){completedTask=true;}
  };

  await context.__runDiscovery();

  assert.equal(context.__discoveryState().status,'error');
  assert.match(failedTask,/provider checks failed or timed out/i);
  assert.match(failedTask,/no no-match conclusion/i);
  assert.equal(completedTask,false);
  assert.equal(requests,12,'each transient provider failure gets exactly one bounded retry');
  assert.equal(context.__discoveryState().searchFailures.length,6);
  assert.ok(context.__discoveryState().searchFailures.every(item=>item.phase==='searching'&&item.reason==='provider_unavailable'&&item.status===503));
  context.__renderDiscoveryFunnel();
  assert.match(context.__elements.get('discovery-funnel').innerHTML,/Market evidence/);
  assert.match(context.__elements.get('discovery-funnel').innerHTML,/HTTP 503/);
  assert.match(context.__elements.get('discovery-funnel').innerHTML,/Retry failed checks/);
});

test('Firecrawl HTTP 402 switches official-domain lookup to grounded OpenAI results', async () => {
  const requests=[];
  const context=loadDiscoveryRunner({
    requestTimeout:100,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'}},
    fetchImpl:async(url,options)=>{
      requests.push({url,options});
      if(url.includes('/api/ai/web-search'))return {ok:true,status:200,json:async()=>({results:[
        {url:'https://northstar.com/',title:'Northstar official website',description:'Northstar builds industrial machinery in Latvia.'},
        {url:'https://unrelated.example/',title:'Unrelated source',description:'Other company.'}
      ]})};
      return {ok:false,status:402,json:async()=>({error:'Credits exhausted'})};
    }
  });
  const results=await context.__firecrawlCompanySearch({id:'resolve-northstar',kind:'resolution',company:'Northstar',market:'Latvia',query:'"Northstar" Latvia official company website'},new AbortController().signal);
  assert.equal(requests.length,2,'a billing error must not retry Firecrawl');
  assert.match(requests[1].url,/\/api\/ai\/web-search\?workspace_id=workspace-1/);
  assert.equal(requests[1].options.credentials,'include');
  assert.equal(results.length,1,'source and company-domain checks still reject unrelated results');
  assert.equal(results[0].domain,'northstar.com');
  assert.equal(context.__discoveryState().funnel.openAiFallbackSearches,1);
});

test('Firecrawl HTTP 402 without usable fallback stops and tells the user to check credits', async () => {
  let requests=0;
  const context=loadDiscoveryRunner({renderNodes:true,fetchImpl:async()=>{requests+=1;return {ok:false,status:402,json:async()=>({error:'Billing limit'})};}});
  await assert.rejects(context.__firecrawlCompanySearch({id:'resolve-northstar',kind:'resolution',company:'Northstar',market:'Latvia',query:'Northstar official company website'},new AbortController().signal),error=>error.status===402);
  assert.equal(requests,1,'credit failures are not transient');
  context.__setDiscovery({status:'error',lastRunAt:new Date().toISOString(),searchFailures:[{phase:'resolving',company:'Northstar',queryMeta:{id:'resolve-northstar',company:'Northstar',kind:'resolution',query:'Northstar official company website'},reason:'quota_exhausted',status:402}]});
  context.__renderDiscoveryFunnel();
  const html=context.__elements.get('discovery-funnel').innerHTML;
  assert.match(html,/Firecrawl credits or billing limit reached/);
  assert.match(html,/Open AI &amp; Tools/);
  assert.match(html,/Retry failed checks with fallback/);
});

test('saved failed official-domain lookups reuse discovered names and market evidence', async () => {
  const requests=[];
  const context=loadDiscoveryRunner({
    renderNodes:true,requestTimeout:100,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'}},
    fetchImpl:async(url,options)=>{
      const query=JSON.parse(options.body).query;
      requests.push({url,query});
      if(url.includes('/api/ai/web-search'))return {ok:true,status:200,json:async()=>({results:[query.startsWith('site:')
        ?{date:new Date().toISOString().slice(0,10),url:'https://northstar.com/news/new-factory',title:'Northstar invests in a new factory',description:'Northstar invests in a new factory in Latvia for industrial automation.'}
        :{url:'https://northstar.com/',title:'Northstar official site',description:'Northstar is an industrial automation manufacturer in Latvia.'}
      ]})};
      return {ok:false,status:402,json:async()=>({error:'Credits exhausted'})};
    }
  });
  context.__setDiscovery({
    status:'error',lastRunAt:'2026-09-25T17:00:00.000Z',
    rawResults:[{queryId:'discover-latvia-1',market:'Latvia',url:'https://industry.example/northstar',domain:'industry.example',company:'Northstar',title:'Northstar invests in new factory',description:'Northstar invests in a new factory in Latvia for industrial automation.'}],
    companyMentions:[{company:'Northstar',market:'Latvia',sourceUrl:'https://industry.example/northstar'}],
    funnel:{marketSearchesCompleted:4,marketSearchesTotal:4,evidencePages:1,companiesIdentified:1,officialDomainsResolved:0,companySitesChecked:0,qualifiedCompanies:0},
    searchFailures:[{phase:'resolving',company:'Northstar',queryMeta:{id:'resolve-northstar',kind:'resolution',company:'Northstar',market:'Latvia',sourceUrl:'https://industry.example/northstar',query:'"Northstar" Latvia official company website'},reason:'request_rejected',status:402}]
  });
  await context.__retryFailedDiscoveryChecks();
  const state=context.__discoveryState();
  assert.equal(requests.length,5,'one direct website read plus official-domain and evidence searches should call the existing providers');
  assert.ok(requests.every(item=>!String(item.query||'').includes('discover-')));
  assert.equal(state.funnel.marketSearchesCompleted,4);
  assert.equal(state.funnel.officialDomainsResolved,1);
  assert.equal(state.funnel.openAiFallbackSearches,2);
  assert.equal(state.searchFailures.length,0);
});

test('a rendering failure cannot leave Company Discovery running', async () => {
  const context = loadDiscoveryRunner({ renderFails: true });
  await assert.doesNotReject(context.__runDiscovery());
  assert.equal(context.__discoveryState().status, 'error');
});

test('company discovery highlights and announces its active verification status',()=>{
  const context=loadDiscoveryRunner({renderNodes:true});
  context.__setDiscovery({status:'running'});
  context.__setDiscoveryProgress({phase:'verifying',completed:10,total:12});
  context.__renderStatus();
  const status=context.__elements.get('company-discovery-status');
  assert.equal(status.classList.contains('is-active'),true);
  assert.match(status.textContent,/Verifying company websites.*10\/12 checked/i);
  context.__setDiscovery({status:'complete'});
  context.__renderStatus();
  assert.equal(status.classList.contains('is-active'),false);
});

test('Company Discovery asks Firecrawl to attach page evidence to search results', async () => {
  let requestBody;
  const context = loadDiscoveryRunner({
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [{
            url: 'https://example-supplier.test/',
            title: 'Example Supplier',
            description: 'Office furniture supplier for expanding companies.'
          }]
        })
      };
    }
  });

  const results = await context.__firecrawlCompanySearch({
    id: 'latvia-office',
    market: 'Latvia',
    query: 'Latvia office furniture companies official website'
  });

  assert.deepEqual(requestBody, {
    query: 'Latvia office furniture companies official website',
    limit: 8,
    scrapeOptions: { formats: ['markdown'], onlyMainContent: true }
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].text, 'Office furniture supplier for expanding companies.');
});

test('Company Discovery verifies candidate websites before strict qualification', async () => {
  const requests=[];
  const context=loadDiscoveryRunner({
    fetchImpl:async (_url,options)=>{
      const body=JSON.parse(options.body);requests.push(body);
      const verified=/site:buyer\.lv/i.test(body.query);
      return {
        ok:true,
        json:async()=>({success:true,data:[verified?{
          date:new Date().toISOString().slice(0,10),url:'https://buyer.lv/news/new-factory',title:'Buyer opens a new factory',
          description:'The Latvian industrial manufacturing company is expanding production capacity with new industrial automation.',
          markdown:'Buyer is opening a new factory in Latvia, expanding production capacity and investing in industrial automation.'
        }:{
          url:'https://buyer.lv/',title:'Buyer plans a new factory',description:'Buyer plans a new factory in Latvia.'
        }]})
      };
    }
  });

  await context.__runDiscovery();

  assert.ok(requests.some(body=>/site:buyer\.lv/i.test(body.query)),'a direct domain verification request must run');
  assert.equal(context.__discoveryState().candidates.length,0,'site verification without a purchasing application cannot qualify');
});

test('Company Discovery bounds concurrent Firecrawl verification requests', async () => {
  let active=0;
  let maximum=0;
  const context=loadDiscoveryRunner({
    requestTimeout:50,
    fetchImpl:async (_url,options)=>{
      const body=JSON.parse(options.body);
      active+=1;maximum=Math.max(maximum,active);
      await new Promise(resolve=>setTimeout(resolve,2));
      active-=1;
      const verified=/^site:/i.test(body.query);
      const data=verified?[{
        url:`https://${body.query.match(/^site:([^ ]+)/i)[1]}/news`,title:'Expansion',
        description:'Latvian manufacturer expansion',markdown:'The Latvian company opens a new factory and expands capacity.'
      }]:Array.from({length:5},(_,index)=>({
        url:`https://buyer${index}.lv/`,title:`Buyer${index} plans a new factory`,description:`Buyer${index} plans a new factory in Latvia.`
      }));
      return {ok:true,json:async()=>({success:true,data})};
    }
  });

  await context.__runDiscovery();

  assert.ok(maximum<=4,`expected at most four concurrent provider requests, observed ${maximum}`);
});

test('unreadable company website blocks buyer lookup before Apollo is called',async()=>{let apolloCalls=0;const context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'ws'},searchApolloPeople:async()=>{apolloCalls++;return {ok:true,people:[]};}}});context.__setDiscovery({checkedCompanyDomains:['northstar.com'],potentialMatches:[{company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Latvia',marketVerified:true,fitVerified:true,qualificationGaps:['No active buying signal was confirmed'],evidence:[{url:'https://northstar.com/about',text:'Latvian industrial manufacturer.'}]}]});context.LeadIntelFirstPartyResearch.collectWebsiteEvidence=async()=>{throw new Error('Insufficient readable company evidence');};await context.__findPotentialDecisionMakers('northstar.com');assert.equal(apolloCalls,0);assert.equal(context.__discoveryState().potentialMatches[0].peopleStatus,'error');});


test('find-more merges domains without losing saved buyers or duplicating companies',()=>{
 const ctx=loadDiscoveryRunner();
 const old={company:'North',domain:'north.example',saved:true,people:[{name:'Anna'}],peopleStatus:'complete'};
 const merged=ctx.__mergeWorkflowCompanies([old,{company:'South',domain:'south.example'}],[{company:'North renewed',domain:'www.north.example',people:[]},{company:'East',domain:'east.example'}]);
 assert.equal(merged.length,3);assert.equal(merged[0].company,'North renewed');assert.equal(merged[0].people[0].name,'Anna');assert.equal(merged[0].saved,true);
 const rechecked=ctx.__mergeWorkflowCompanies([old],[{company:'East',domain:'east.example'}],{replaceDomains:['north.example']});
 assert.equal(rechecked.length,1);assert.equal(rechecked[0].domain,'east.example');
});
test('recheck target pool is limited to known domains and deduplicates the shortlist',()=>{
 const ctx=loadDiscoveryRunner();
 ctx.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({website:'acme.example',targetCompanies:[{companyName:'North',domain:'north.example',website:'https://north.example'}]}));
 ctx.__setDiscovery({selectedProspects:[{company:'North',domain:'north.example',buyerSearchMode:'user_selected_target'},{company:'South',domain:'south.example',buyerSearchMode:'user_selected_target'}]});
 const pool=ctx.__existingCompanyResearchTargets();assert.equal(pool.length,2);assert.deepEqual(Array.from(pool,item=>item.domain),['north.example','south.example']);
});
test('qualified company selection survives normalization and enables Buyers without Pipeline',async()=>{
 const ctx=loadDiscoveryRunner({renderNodes:true});
 const researchedAt=new Date().toISOString(),date=researchedAt.slice(0,10);
 const evidence=[{verifiedAt:researchedAt,url:'https://modvion.com/about',text:'Modvion operates industrial manufacturing equipment in Latvia and uses industrial automation to assemble its products for manufacturers.'},{verifiedAt:researchedAt,date,url:'https://modvion.com/news/factory',text:'Modvion announces a new factory in Latvia with industrial automation and expands manufacturing capacity.'},{date,url:'https://journal.example/modvion',text:'Modvion announces expansion of manufacturing at a new factory in Latvia with industrial automation.'}];
 const main=JSON.parse(ctx.localStorage.getItem('leadintel_customer_v2_state')),profile={...main.profile,...Targeting.profileFields(main)};
 let candidate={company:'Modvion',domain:'modvion.com',website:'https://modvion.com/',market:'Latvia',score:{total:95},confidence:'High',qualified:true,marketVerified:true,buyerVerified:true,evidence,matchedSignals:[{evidence:[{url:evidence[1].url},{url:evidence[2].url}]}]};
 candidate=Discovery.parseBuyerFit(JSON.stringify({companies:[{domain:candidate.domain,fit:100,purchase:'industrial automation',buyerRole:'manufacturer',reason:'Factory assembly uses automation equipment.',relevantSignalUrls:[evidence[1].url,evidence[2].url],evidence:[{url:evidence[0].url,quote:evidence[0].text}]}]}),[candidate],profile)[0];
 ctx.__setDiscovery({candidates:[candidate],lastRunAt:researchedAt});
 assert.equal(await ctx.__selectQualifiedForBuyers(0),true);
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(ctx.localStorage.getItem('leadintel_customer_v2_discovery')));
 assert.equal(restored.selectedProspects.length,1);assert.equal(restored.selectedProspects[0].qualified,true);assert.equal(restored.selectedProspects[0].buyerSearchMode,'user_selected_qualified');
 assert.equal(restored.pipeline.length,0);ctx.__renderPipeline();assert.equal(ctx.__elements.get('continue-company-buyers').disabled,false);
 restored.selectedProspects[0].buyerRoles='CEO; Procurement Director';
 assert.equal(Discovery.normalizeDiscoveryState(restored).selectedProspects[0].buyerRoles,'CEO; Procurement Director');
});
test('a failed provider run preserves previous potential companies and checked domains',async()=>{
 const ctx=loadDiscoveryRunner();
 const potential={company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Latvia',marketVerified:true,fitVerified:true,buyerSearchMode:'user_selected_without_signal',qualificationGaps:['Buying signal unconfirmed'],evidence:[{url:'https://northstar.com/',title:'Northstar manufacturer in Latvia'}]};
 ctx.__setDiscovery({status:'no_results',potentialMatches:[potential],checkedCompanyDomains:['northstar.com']});
 await ctx.__runDiscovery();assert.equal(ctx.__discoveryState().potentialMatches[0].domain,'northstar.com');assert.ok(ctx.__discoveryState().checkedCompanyDomains.includes('northstar.com'));
});
test('paused Lookalike does not call the reference model while known targets remain searchable',async()=>{
 const ctx=loadDiscoveryRunner();let calls=0;
 ctx.LeadIntelReferenceCustomerPortfolio={getCombinedActiveModel(){calls++;return {dna:{referenceProfiles:[]}}}};
 const main=JSON.parse(ctx.localStorage.getItem('leadintel_customer_v2_state'));main.market.icps=[{id:'icp-lookalike',type:'lookalike',active:false}];main.targetCompanies=[{companyName:'North',domain:'north.example',website:'https://north.example'}];ctx.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
 await ctx.__runDiscovery({recheckOnly:true});assert.equal(calls,0);assert.ok(ctx.__discoveryState().queries.some(q=>q.query.includes('North')));
});


test('a known target without a website keeps its origin after domain resolution',()=>{
 const ctx=loadDiscoveryRunner();ctx.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({website:'seller.example',targetCompanies:[{companyName:'North Steel',website:''}]}));assert.equal(ctx.__companyOrigin({company:'North Steel',domain:'north.example'}),'Added by you');assert.equal(ctx.__companyOrigin({company:'New Company',domain:'new.example'}),'Found by LeadIntel');
});


test('a late company render keeps the Buyers guide out of the Companies stage',()=>{
 const ctx=loadDiscoveryRunner({renderNodes:true});ctx.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:4}));ctx.__renderPipeline();assert.equal(ctx.__elements.get('discovery-buyers-guide').hidden,true);ctx.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5}));ctx.__renderPipeline();assert.equal(ctx.__elements.get('discovery-buyers-guide').hidden,false);
});
test('Save buyer saves in CRM, survives reload, and Unsave preserves CRM history',async()=>{
 let saved=0;
 const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'},saveNow:async()=>({saved:true}),saveCrmCompany:async()=>({ok:true,company:{id:'c1'}}),saveCrmContacts:async()=>{saved++;return {ok:true};}}});
 context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{id:'public-anna',name:'Anna Buyer',title:'Procurement Director'}]}]});
 assert.equal(await context.__keepBuyer('example.com',0),true);assert.equal(saved,1);
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')));
 assert.equal(restored.selectedProspects[0].people[0].kept,true);assert.equal(restored.selectedProspects[0].buyerDiscovery.pool[0].kept,true);
 context.__renderPipeline();const html=context.__elements.get('customer-pipeline').innerHTML;
 assert.match(html,/data-keep-buyer[^>]*aria-pressed="true"/);assert.match(html,/Save &amp; proceed/);assert.ok(html.indexOf('data-find-prospect-buyers')<html.indexOf('selected-prospect-people'));
 assert.equal(await context.__keepBuyer('example.com',0),true);assert.equal(saved,1);assert.equal(context.__discoveryState().selectedProspects[0].people[0].kept,false);
});
test('Save buyer fails closed when CRM save fails',async()=>{
 const context=loadDiscoveryRunner({renderNodes:true,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'},saveCrmCompany:async()=>({ok:true,company:{id:'c1'}}),saveCrmContacts:async()=>({ok:false,error:'Save failed'})}});
 context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{id:'public-anna',name:'Anna Buyer',title:'Procurement Director'}]}]});
 assert.equal(await context.__keepBuyer('example.com',0),false);assert.equal(context.__discoveryState().selectedProspects[0].people[0].kept,false);
});
test('Save buyer does not claim Saved when server preference sync fails',async()=>{
 const context=loadDiscoveryRunner({renderNodes:true,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'},saveNow:async()=>({saved:false}),saveCrmCompany:async()=>({ok:true,company:{id:'c1'}}),saveCrmContacts:async()=>({ok:true})}});
 context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{id:'public-anna',name:'Anna Buyer',title:'Procurement Director'}]}]});
 assert.equal(await context.__keepBuyer('example.com',0),false);assert.equal(context.__discoveryState().selectedProspects[0].people[0].kept,false);
});

test('Companies does not render saved buyer cards; switching to Buyers preserves them',()=>{const c=loadDiscoveryRunner({renderNodes:true});c.__setDiscovery({selectedProspects:[{company:'Target',domain:'target.se',buyerSearchMode:'user_selected_target',people:[{id:'p1',name:'Alex Buyer',title:'Director',kept:true}]}]});c.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:4}));c.__renderPipeline();assert.equal(c.__elements.get('customer-pipeline').innerHTML,'');assert.equal(c.__discoveryState().selectedProspects[0].people[0].kept,true);c.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5}));c.__renderPipeline();assert.match(c.__elements.get('customer-pipeline').innerHTML,/Alex Buyer/);});
test('optional contact-review timeout preserves completed email checks and exposes a focused retry',async()=>{
 const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:30,
  bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'}},
  fetchImpl:async url=>{
   if(String(url).includes('contact-evidence-review'))return new Promise(()=>{});
   if(String(url).includes('web-search'))return {ok:true,json:async()=>({results:[]})};
   return {ok:true,json:async()=>({data:[{url:'https://example.com/team',markdown:'Anna Buyer COO contact team'}]})};
  }});
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{id:'anna',name:'Anna Buyer',title:'COO',organization:'Example',publicName:'Anna Buyer',publicNameUrl:'https://example.com/team',publicLinkedinUrl:'https://linkedin.com/in/anna'}]}]});
 assert.equal(await context.__findPublicProspectContacts('example.com'),false);
 const candidate=context.__discoveryState().selectedProspects[0];
 assert.equal(candidate.people[0].emailResearch.status,'complete');assert.ok(candidate.publicResearch.patternSearches>0);
 assert.equal(candidate.publicContactStatus,'error');assert.ok(candidate.publicResearch.issues.some(issue=>issue.includes('completed identity and email evidence preserved')));
 assert.match(context.__elements.get('customer-pipeline').innerHTML,/data-find-public-contacts="example.com"/);
});

test('completed public evidence is synced to CRM when an optional grounded follow-up times out',async()=>{
  let snapshots=0,savedContacts=0;
  const context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'},saveCrmContacts:async()=>{savedContacts++;return {ok:true};},saveCrmCompany:async()=>{snapshots++;return {ok:true};}},fetchImpl:async(url)=>{
    if(String(url).includes('/ai/web-search'))throw Object.assign(new Error('Request timed out'),{name:'AbortError'});
    return {ok:true,json:async()=>({data:[{url:'https://example.com/team',title:'Leadership',markdown:'Jane Example — Head of Procurement\njane.example@example.com +46 70 235 51 61'}]})};
  }});
  context.LeadIntelCrm=require('../crm-engine.js');
  context.__setCrmCompanies([{id:'c1',normalized_domain:'example.com'}]);
  context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',market:'Sweden',buyerSearchMode:'user_selected_target',people:[{id:'p1',name:'Jane Example',title:'Head of Procurement',linkedin_url:'https://linkedin.com/in/jane-example'}]}]});
  await context.__findPublicProspectContacts('example.com');
  const candidate=context.__discoveryState().selectedProspects[0];
  assert.equal(candidate.publicContactStatus,'error');
  assert.equal(candidate.people[0].publicEmail,'jane.example@example.com');
  assert.ok(candidate.publicResearch.patternSearches>0);
  assert.equal(savedContacts,1);
  assert.equal(snapshots,1);
});

test('known full identities receive contact evidence searches before optional profile follow-ups',async()=>{
 const queries=[];
 const context=loadDiscoveryRunner({requestTimeout:1000,fetchImpl:async(url,options)=>{
  if(String(url).includes('/firecrawl-search'))queries.push(JSON.parse(options.body).query);
  return {ok:true,json:async()=>({data:[]})};
 }});
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',market:'Sweden',buyerSearchMode:'user_selected_target',people:[{id:'p1',name:'Jane Example',title:'Head of Procurement'}]}]});
 await context.__findPublicProspectContacts('example.com');
 const contact=queries.indexOf('site:example.com "Jane Example"');
 const profiles=queries.findIndex(query=>query.startsWith('site:linkedin.com/in/ ('));
 assert.ok(contact>=0&&profiles>contact);
});

test('ranked buyer controls retain the original candidate index after ranking clones the people',()=>{
 const ctx=loadDiscoveryRunner({renderNodes:true,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}}});
 ctx.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',market:'Sweden',buyerSearchMode:'user_selected_target',people:[{id:'p1',name:'Jane Buyer',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team/jane'}]}]});
 ctx.__renderPipeline();
 const html=ctx.__elements.get('customer-pipeline').innerHTML;
 assert.match(html,/data-review-linkedin="example.com" data-person-index="0"/);
 assert.doesNotMatch(html,/data-person-index="-1"/);
});

test('manual opportunity review holds persist without paid contact enrichment',async()=>{
 let snapshots=0;
 const ctx=loadDiscoveryRunner({bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'},saveNow:async()=>({saved:true}),saveCrmCompany:async()=>{snapshots++;return {ok:true};}}});
 ctx.LeadIntelCrm=require('../crm-engine.js');
 ctx.__setCrmCompanies([{id:'c1',normalized_domain:'example.com'}]);
 ctx.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',market:'Sweden',buyerSearchMode:'user_selected_target',people:[{id:'p1',name:'Jane Buyer',title:'Operations Manager',organization:'Example',linkedin_url:'https://linkedin.com/in/jane-buyer'}]}]});
 assert.equal(await ctx.__holdBuyerForOpportunityReview('example.com',0,'Public profile identifies a different subsidiary; project responsibility unconfirmed'),true);
 const person=ctx.__discoveryState().selectedProspects[0].people[0];
 assert.equal(person.opportunityScope.status,'review_required');
 assert.equal(person.buyerQualification.eligible,false);
 assert.equal(snapshots,1);
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(ctx.localStorage.getItem('leadintel_customer_v2_discovery')));
 assert.equal(restored.selectedProspects[0].people[0].opportunityScope.status,'review_required');
});

test('recommended buyers precede potential buyers and unresolved research with correct action targets',()=>{
 const context=loadDiscoveryRunner({renderNodes:true});
 const people=Array.from({length:6},(_,i)=>({id:`person-${i}`,name:`Anna Buyer${i}`,publicName:`Anna Buyer${i}`,title:'Procurement Director',organization:'Example',publicNameUrl:`https://example.com/team/${i}`}));
 const html=context.__renderSelectedProspects([{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people,buyerDiscovery:{pool:[...people,{name:'Unresolved',title:'Procurement Director',identityStatus:'pending'}],providerStatus:{firecrawl:{status:'complete'}},researchIncomplete:true}}]);
 assert.ok(html.indexOf('4 recommended buyers')>=0,html);assert.ok(html.indexOf('4 recommended buyers')<html.indexOf('2 other potential buyers'),html);
 assert.ok(html.indexOf('2 other potential buyers')<html.indexOf('1 unresolved identities'));
 assert.match(html,/<details class="buyer-pending-identities"><summary>/);
 assert.match(html,/<details class="buyer-provider-status"><summary>/);
 assert.equal((html.match(/data-keep-buyer="example.com"/g)||[]).length,6);
 assert.doesNotMatch(html,/data-save-buyer-only|data-person-index="-1"/);
});

test('a rejected official source persists and stops a cached listing from showing accepted-email readiness',async()=>{
 const ctx=loadDiscoveryRunner({renderNodes:true,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async()=>({ok:false,status:409,json:async()=>({error:'The official page did not confirm this exact person and email'})})});
 ctx.LeadIntelContactPolicy=require('../contact-confirmation-policy.js');ctx.__setBuyerConfirmationPolicy();
 ctx.__setCrmCompanies([{id:'c1',normalized_domain:'example.com'}]);
 ctx.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',market:'Sweden',buyerSearchMode:'user_selected_target',people:[{id:'p1',name:'Jane Buyer',title:'Procurement Director',organization:'Example',publicName:'Jane Buyer',publicNameUrl:'https://example.com/team',publicEmail:'jane.buyer@example.com',publicEmailUrl:'https://example.com/team'}]}]});
 const candidate=ctx.__discoveryState().selectedProspects[0],person=candidate.people[0];
 assert.equal(ctx.__acceptedBuyerConfirmationLevel(),'public_confirmed');
 assert.ok(ctx.__publicBuyerSource(candidate,person));
 await assert.rejects(ctx.__confirmPublicBuyerSource(candidate,person),/did not confirm/);
 assert.equal(person.publicEmailSourceCheck.status,'failed');
 ctx.__renderPipeline();const html=ctx.__elements.get('customer-pipeline').innerHTML;
 assert.match(html,/Official email source needs rechecking/);assert.match(html,/Recheck public source/);
 assert.match(html,/data-keep-buyer="example.com"[^>]*disabled/);
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(ctx.localStorage.getItem('leadintel_customer_v2_discovery')));
 assert.equal(restored.selectedProspects[0].people[0].publicEmailSourceCheck.status,'failed');
});
