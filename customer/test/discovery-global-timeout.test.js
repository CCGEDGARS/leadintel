function isOfficialInventoryQuery(query=''){return /\(contact OR contacts OR kontakt OR team\)|\(management OR leadership OR ledning OR executive\)|\(investor-contacts OR press-contact|\(supplier OR procurement OR contact OR kontakt\)|site:news\.cision\.com\/|\(privacy OR invoices OR accounting OR supplier\)/.test(query);}
const {weakBuyerFitResponse}=require('./helpers/buyer-fit-fixtures.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Discovery = require('../discovery-engine.js');
const StrategyIntegrity = require('../strategy-integrity.js');
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
    .replace('Math.max(DISCOVERY_REQUEST_TIMEOUT_MS*18,450000)', 'Math.max(DISCOVERY_REQUEST_TIMEOUT_MS*18,1000)')
    .replace(runMargin?.[0], `const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=${testRunMargin};`)
    .replace(extractionTimeout?.[0], `const COMPANY_EXTRACTION_TIMEOUT_MS=${testExtractionTimeout};`)
    .replace(/\ninitDiscoveryWhenReady\(\);\s*$/, '\ndiscovery=LeadIntelDiscovery.normalizeDiscoveryState({});\nglobalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__discoveryState = () => discovery;\nglobalThis.__setDiscovery = value => { discovery = LeadIntelDiscovery.normalizeDiscoveryState({...value,qualityVersion:value.qualityVersion??LeadIntelDiscovery.DISCOVERY_QUALITY_VERSION}); };\nglobalThis.__renderStatus = renderStatus;\nglobalThis.__setDiscoveryProgress=value=>{discoveryProgress=value;};\nglobalThis.__renderCandidates = renderCandidates;\n')
    .replace('globalThis.__runDiscovery = runCompanyDiscovery;', 'globalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__clearCompanySearchResults=clearCompanySearchResults;globalThis.__renderSearchPreferences=typeof renderSearchPreferences==="function"?renderSearchPreferences:undefined;globalThis.__bindDiscovery=bindDiscovery;globalThis.__companySearchFeedbackHtml=typeof companySearchFeedbackHtml==="function"?companySearchFeedbackHtml:undefined;globalThis.__updateCompanySearchFeedback=typeof updateCompanySearchFeedback==="function"?updateCompanySearchFeedback:undefined;globalThis.__syncStrategyFingerprint=syncStrategyFingerprint;globalThis.__restoreNewerBuyerResearch=restoreNewerBuyerResearch;globalThis.__findExecutiveBuyer=findExecutiveBuyer;\nglobalThis.__companyOrigin = companyOrigin;\nglobalThis.__mergeWorkflowCompanies = mergeWorkflowCompanies;\nglobalThis.__existingCompanyResearchTargets = existingCompanyResearchTargets;\nglobalThis.__selectQualifiedForBuyers = selectQualifiedForBuyers;\nglobalThis.__selectTargetForBuyers = selectTargetForBuyers;\nglobalThis.__confirmBuyerContact = confirmBuyerContact;\nglobalThis.__keepBuyer = keepBuyer;\nglobalThis.__confirmPublicBuyerSource=confirmPublicBuyerSource;\nglobalThis.__publicBuyerSource=publicBuyerSource;\nglobalThis.__acceptedBuyerConfirmationLevel=acceptedBuyerConfirmationLevel;\nglobalThis.__setBuyerConfirmationPolicy=()=>{buyerConfirmationLevel="public_confirmed";confirmationPolicyWorkspace=bridge()?.workspace?.id;};\nglobalThis.__holdBuyerForOpportunityReview = holdBuyerForOpportunityReview;\nglobalThis.__toggleBuyerContactFlow = toggleBuyerContactFlow;\nglobalThis.__enrichSelectedProspect = enrichSelectedProspect;\nglobalThis.__enrichContact = enrichContact;\nglobalThis.__scheduleSavedBuyerPublicChecks = scheduleSavedBuyerPublicChecks;\nglobalThis.__findPublicProspectContacts = findPublicProspectContacts;\nglobalThis.__retryFailedDiscoveryChecks = retryFailedDiscoveryChecks;\nglobalThis.__findPotentialDecisionMakers = findPotentialDecisionMakers;\nglobalThis.__savePotentialProspect = savePotentialProspect;\nglobalThis.__addSelectedProspectToPipeline = addSelectedProspectToPipeline;\nglobalThis.__setCrmCompanies = companies => { crmCompanies = companies; };\nglobalThis.__renderPipeline = renderPipeline;\nglobalThis.__renderSelectedProspects = renderSelectedProspects;\nglobalThis.__firecrawlCompanySearch = firecrawlCompanySearch;\nglobalThis.__withDiscoveryDeadline = withDiscoveryDeadline;\nglobalThis.__discoveryRunTimeoutMs = discoveryRunTimeoutMs;\nglobalThis.__renderDiscoveryFunnel = renderDiscoveryFunnel;\nglobalThis.__renderPotentialMatches = renderPotentialMatches;\nglobalThis.__potentialBuyerResultsHtml = potentialBuyerResultsHtml;');
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
  mainState.approved=true;mainState.market.strategyApproved=true;mainState.market.icps=[{id:'icp-core',type:'core',active:true}];mainState.market.strategyApproval=StrategyIntegrity.approval(mainState);
  const storage = new Map([['leadintel_customer_v2_state', JSON.stringify(mainState)],['leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5})]]);
  const elements = new Map();
  const getElementById = id => {
    if (renderFails && id === 'discovery-status') return { textContent: '' };
    if (!renderNodes) return null;
    if (!elements.has(id)) elements.set(id, {
      id, textContent: '', innerHTML: '', value: '', hidden: false, disabled: false, dataset: {},
      classList: (()=>{const values=new Set();return {add(...names){names.forEach(name=>values.add(name));},remove(...names){names.forEach(name=>values.delete(name));},toggle(name,force){const enabled=force??!values.has(name);if(enabled)values.add(name);else values.delete(name);return enabled;},contains(name){return values.has(name);}};})(),
      addEventListener(type,listener) { this.listeners||={};this.listeners[type]=listener; }, remove() {}, insertAdjacentHTML() {}
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
    addEventListener() {},
    LeadIntelDiscovery: Discovery,
    LeadIntelStrategyIntegrity: StrategyIntegrity,
    LeadIntelTargeting: Targeting,
    LeadIntelServerBridge: bridgeImpl,
    fetch: (url,args)=>String(url).includes('/api/integrations/services/contact-policy?')?Promise.resolve({ok:true,json:async()=>({confirmationLevel:'provider_verified'})}):fetchImpl(url,args),
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document: { getElementById, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ dataset: {}, addEventListener() {} }), head: { appendChild() {} }, body: { appendChild() {} } },
    navigator: { languages: [] },
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {}
  };
  context.window = context;
  require('./helpers/dossier-boundary.cjs')(context);
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

test('verification recovers a real internal URL returned by search when the home contains only consent text',async()=>{
 const calls=[],cookie='We use cookies to improve your browsing experience. Manage cookie preferences. Accept all cookies. '.repeat(3);
 const operating='Nordic operates equipment assembly facilities in Latvia. Our production teams integrate purchased industrial automation and commission complete machinery for business customers.';
 const context=loadDiscoveryRunner({requestTimeout:1000,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  if(body.url)return {ok:true,json:async()=>({data:{markdown:body.url.endsWith('/operations')?operating:cookie,metadata:{sourceURL:body.url}}})};
  return {ok:true,json:async()=>({data:[{url:'https://nordic.lv/operations',title:'Nordic operations',markdown:cookie}]})};
 }});
 const rows=await context.__firecrawlCompanySearch({kind:'verification',domain:'nordic.lv',company:'Nordic',market:'Latvia',query:'site:nordic.lv operations'},new AbortController().signal);
 assert.ok(calls.some(body=>body.url==='https://nordic.lv/operations'));
 assert.ok(rows.some(row=>row.text.includes('integrate purchased industrial automation')));
});

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
      if(JSON.parse(options.body).task==='buyer-fit')return {ok:true,json:async()=>({text:weakBuyerFitResponse(JSON.parse(options.body).prompt)})};
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

test('an empty first pass gets one bounded follow-up and retains a checked low-score company',async()=>{
  let marketRequests=0;
  let initialResults=0;
  let followUpResults=0;
  const context=loadDiscoveryRunner({
    requestTimeout:1000,
    scaleProductionRunTimeout:1000,
    fetchImpl:async (_url,options)=>{
      if(JSON.parse(options.body).task==='buyer-fit')return {ok:true,json:async()=>({text:weakBuyerFitResponse(JSON.parse(options.body).prompt)})};
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
  assert.equal(result.status,'complete');
  assert.equal(result.candidates.length,1,'completed low-score research remains on the manual list');
  assert.equal(result.candidates[0].qualification.automaticEligible,false);
  assert.equal(result.funnel.marketSearchesCompleted,10);
  assert.equal(result.funnel.marketSearchesTotal,10);
  assert.equal(result.funnel.evidencePages,3,'repeated URLs count once in the funnel');
  assert.equal(result.funnel.companiesIdentified,1);
  assert.equal(result.funnel.officialDomainsResolved,1);
  assert.equal(result.funnel.companySitesChecked,1);
  assert.equal(result.funnel.qualifiedCompanies,1);
  assert.equal(result.funnel.adaptiveFollowUpSearches,4);
});

test('an isolated verification outage does not prevent qualifying readable companies and broadening the search',async()=>{
  let marketRequests=0;
  const names=['North Steel','Polar Engineering'];
  const slug=name=>name.toLowerCase().replace(/[^a-z]/g,'');
  const text=name=>`${name} manufactures mining machinery in Latvia. Its production facilities assemble industrial equipment. The company plans a new factory to expand manufacturing capacity.`;
  const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:0,fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body||'{}');
    if(body.task==='buyer-fit'){
      const supplied=JSON.parse(body.prompt.split('. Companies: ')[1]);
      return {ok:true,json:async()=>({text:JSON.stringify({companies:supplied.map(c=>({domain:c.domain,fit:90,purchase:'industrial automation',reason:'Automation equipment supports the evidenced machinery assembly operations.',buyerRole:'industrial manufacturer',evidence:[{url:c.evidence.find(e=>e.url.includes(c.domain)).url,quote:text(c.company)}]}))})})};
    }
    if(String(url).includes('/firecrawl-scrape')){
      const name=names.find(n=>body.url.includes(slug(n)))||names[0];
      return {ok:true,json:async()=>({data:{markdown:text(name),metadata:{sourceURL:body.url,title:name}}})};
    }
    const query=body.query||'';
    if(query.startsWith('site:northsteel.lv'))return {ok:false,status:502,json:async()=>({})};
    const positiveQuery=query.replace(/-site:\S+/g,'');
    const name=positiveQuery.includes('Polar Engineering')||positiveQuery.includes('polarengineering.lv')?names[1]:positiveQuery.includes('North Steel')||positiveQuery.includes('northsteel.lv')?names[0]:names[marketRequests++<6?0:1];
    const official=query.startsWith('site:')||query.startsWith('"')&&!query.includes('-site:');
    return {ok:true,json:async()=>({success:true,data:[{url:official?`https://${slug(name)}.lv/`:`https://industrynews.lv/${slug(name)}`,title:`${name} plans a new factory`,description:text(name),markdown:text(name)}]})};
  }});
  await context.__runDiscovery();
  const state=context.__discoveryState();
  assert.ok(state.searchFailures.some(f=>f.status===502),'the source failure remains visible');
  assert.equal(state.funnel.adaptiveFollowUpSearches,4,'healthy evidence still drives the bounded follow-up');
  assert.ok(state.candidates.some(c=>c.domain==='polarengineering.lv'&&c.qualification.eligible),JSON.stringify({candidates:state.candidates.map(c=>c.domain),review:state.potentialMatches.map(c=>({domain:c.domain,gaps:c.qualificationGaps,buyerFit:c.buyerFit})),failures:state.searchFailures}));
});

test('a single-company recheck spends calls only on the requested review company',async()=>{
  const queries=[];
  const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:0,fetchImpl:async(_url,options)=>{
    const body=JSON.parse(options.body||'{}');if(body.query)queries.push(body.query);
    return {ok:true,json:async()=>body.task?{text:'{"companies":[]}'}:{success:true,data:[]}};
  }});
  context.__setDiscovery({potentialMatches:[{company:'North Steel',domain:'northsteel.lv',market:'Latvia',qualificationGaps:['Verify company evidence'],evidence:[{url:'https://northsteel.lv/',text:'North Steel manufactures industrial equipment in Latvia.'}]},{company:'Polar Engineering',domain:'polarengineering.lv',market:'Latvia',qualificationGaps:['Verify company evidence'],evidence:[{url:'https://polarengineering.lv/',text:'Polar Engineering manufactures industrial equipment in Latvia.'}]}]});
  await context.__runDiscovery({recheckOnly:true,targetDomain:'northsteel.lv'});
  assert.ok(queries.length>0);
  assert.ok(queries.every(query=>!query.includes('Polar Engineering')&&!query.includes('polarengineering.lv')),'a row recheck must not run the bulk list');
});

test('retrying failed websites preserves the verification timestamp of retained review evidence',async()=>{
  const at=new Date().toISOString();
  const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:0,fetchImpl:async()=>({ok:true,json:async()=>({data:[],text:'{"companies":[]}'})})});
  context.__setDiscovery({status:'error',lastRunAt:at,potentialMatches:[{company:'North Steel',domain:'northsteel.lv',market:'Latvia',qualificationGaps:['Verify purchasing application'],evidence:[{url:'https://northsteel.lv/',verifiedAt:at,text:'North Steel manufactures industrial equipment in Latvia. Our production facilities assemble mining machinery for international industrial customers.'}]}],searchFailures:[{phase:'verifying',status:502,domain:'polarengineering.lv',queryMeta:{id:'verify-polar',kind:'verification',domain:'polarengineering.lv',company:'Polar Engineering',market:'Latvia',query:'site:polarengineering.lv manufacturing'}}]});
  await context.__retryFailedDiscoveryChecks();
  const retained=context.__discoveryState().potentialMatches.find(c=>c.domain==='northsteel.lv');
  assert.equal(retained.evidence[0].verifiedAt,at);
});

test('a row recheck can reach a company beyond the bulk thirty-company check limit',async()=>{
  const queries=[];
  const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:0,fetchImpl:async(_url,options)=>{
    const body=JSON.parse(options.body||'{}');if(body.query)queries.push(body.query);
    return {ok:true,json:async()=>body.task?{text:'{"companies":[]}'}:{success:true,data:[]}};
  }});
  context.__setDiscovery({potentialMatches:Array.from({length:35},(_,i)=>({company:`Factory ${i}`,domain:`factory${i}.lv`,market:'Latvia',qualificationGaps:['Verify company evidence'],evidence:[{url:`https://factory${i}.lv/`,text:`Factory ${i} manufactures industrial equipment in Latvia.`}]}))});
  await context.__runDiscovery({recheckOnly:true,targetDomain:'factory34.lv'});
  assert.ok(queries.length>0,'the clicked company is researched even when it lies beyond the bulk cap');
  assert.ok(queries.every(query=>query.includes('factory34.lv')));
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
  assert.match(html,/Verify a specific purchasing application|Verify company identity/);
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
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Research not started/);
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Start buyer research/);
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
  assert.deepEqual(restored.selectedProspects[0].people.map(person=>person.name).sort(),['Johan Example','Mika Example']);
  assert.equal(restored.pipeline.length,0);
  context.__renderPipeline();
  const html=context.__elements.get('customer-pipeline').innerHTML;
  assert.equal((html.match(/class="selected-prospect-person"/g)||[]).length,2);
  assert.doesNotMatch(html,/First name only/);
  assert.match(html,/linkedin\.com\/in\/mika-example/);
  assert.equal(context.__elements.get('discovery-status').textContent,'1 selected company');
});

test('changed buyer roles keep saved names visible while preventing message handoff',()=>{
 const context=loadDiscoveryRunner({renderNodes:true});
 const people=[{id:'p1',name:'Mika Example',title:'Procurement Director',organization:'Northstar',publicNameUrl:'https://northstar.com/team'}];
 context.__setDiscovery({selectedProspects:[{company:'Northstar',domain:'northstar.com',buyerSearchMode:'user_selected_target',buyerRoles:'Procurement Director',buyerRolesChanged:true,people}]});
 const candidate=context.__discoveryState().selectedProspects[0];
 const html=context.__renderSelectedProspects([candidate]);
 assert.match(html,/Mika Example/);assert.doesNotMatch(html,/Previous buyer suggestions are hidden/);
 assert.equal(Discovery.qualifyBuyer(candidate.people[0],{decisionMakers:'Procurement Director'},candidate).eligible,false);
 assert.doesNotMatch(html,/Recommended · researched match/);
 assert.doesNotMatch(html,/data-research-executive/);
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(JSON.stringify(context.__discoveryState()))).selectedProspects[0];
 assert.match(context.__renderSelectedProspects([restored]),/Mika Example/);
 assert.equal(restored.buyerRolesChanged,true);
 candidate.peopleStatus='loading';
 const loading=context.__renderSelectedProspects([candidate]);
 assert.match(loading,/Mika Example/);assert.match(loading,/buyer-research-progress/);
});

test('the first successful search after a role change produces a buyer shortlist',async()=>{
 const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async(url)=>({ok:true,json:async()=>String(url).includes('scrape')?{data:{markdown:'Northstar industrial manufacturing company.',metadata:{sourceURL:'https://northstar.com/'}}}:{data:[{url:'https://linkedin.com/in/mika-example',title:'Mika Example – Procurement Director at Northstar'}]}})});
 context.__setDiscovery({selectedProspects:[{company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Sweden',buyerSearchMode:'user_selected_target',buyerRoles:'Procurement Director',buyerRolesChanged:true,people:[{id:'old',name:'Mika Example',title:'Procurement Director',organization:'Northstar',publicNameUrl:'https://linkedin.com/in/mika-example',publicLinkedinUrl:'https://linkedin.com/in/mika-example'}]}]});
 assert.equal(await context.__findPotentialDecisionMakers('northstar.com'),true);
 const candidate=context.__discoveryState().selectedProspects[0];
 assert.ok(candidate.people.some(person=>person.name==='Mika Example'));
 assert.equal(candidate.buyerRolesChanged,false);
 assert.match(context.__renderSelectedProspects([candidate]),/Mika Example/);
});

test('unavailable buyer sources preserve the saved list and pending role review',async()=>{
 const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async()=>{throw new Error('Provider unavailable');}});
 context.__setDiscovery({selectedProspects:[{company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Sweden',buyerSearchMode:'user_selected_target',buyerRoles:'Procurement Director',buyerRolesChanged:true,people:[{id:'old',name:'Mika Example',title:'Procurement Director',organization:'Northstar',publicNameUrl:'https://linkedin.com/in/mika-example',publicLinkedinUrl:'https://linkedin.com/in/mika-example'}]}]});
 await context.__findPotentialDecisionMakers('northstar.com');
 const candidate=context.__discoveryState().selectedProspects[0];
 assert.equal(candidate.buyerRolesChanged,true);assert.equal(candidate.people[0]?.name,'Mika Example');
 assert.match(context.__renderSelectedProspects([candidate]),/Mika Example/);
 assert.equal(Discovery.qualifyBuyer(candidate.people[0],{decisionMakers:'Procurement Director'},candidate).eligible,false);
});

test('editing buyer roles during a search keeps the newer selection pending',async()=>{
 let context,edited=false;
 context=loadDiscoveryRunner({requestTimeout:1000,fetchImpl:async()=>{
  if(!edited){edited=true;const candidate=context.__discoveryState().selectedProspects[0];candidate.buyerRoles='Engineering Director';candidate.buyerRolesChanged=true;}
  return {ok:true,json:async()=>({data:[{url:'https://linkedin.com/in/mika-example',title:'Mika Example – Procurement Director at Northstar'}]})};
 }});
 context.__setDiscovery({selectedProspects:[{company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Sweden',buyerSearchMode:'user_selected_target',buyerRoles:'Procurement Director',buyerRolesChanged:true,people:[{id:'old',name:'Mika Example',title:'Procurement Director',organization:'Northstar',publicNameUrl:'https://linkedin.com/in/mika-example',publicLinkedinUrl:'https://linkedin.com/in/mika-example'}]}]});
 await context.__findPotentialDecisionMakers('northstar.com');
 const candidate=context.__discoveryState().selectedProspects[0];
 assert.equal(candidate.buyerRoles,'Engineering Director');assert.equal(candidate.buyerRolesChanged,true);
 assert.match(context.__renderSelectedProspects([candidate]),/value="Engineering Director"/);
});

test('editing buyer roles during company verification cannot be overwritten by the search plan',async()=>{
 let finishVerification;
 const context=loadDiscoveryRunner({requestTimeout:1000,fetchImpl:async()=>({ok:true,json:async()=>({data:[{url:'https://linkedin.com/in/mika-example',title:'Mika Example – Procurement Director at Northstar'}]})})});
 context.LeadIntelFirstPartyResearch.collectWebsiteEvidence=()=>new Promise(resolve=>{finishVerification=resolve;});
 context.__setDiscovery({selectedProspects:[{company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',market:'Sweden',buyerSearchMode:'user_selected_target',buyerRoles:'Procurement Director',buyerRolesChanged:true,people:[{id:'old',name:'Mika Example',title:'Procurement Director',organization:'Northstar',publicNameUrl:'https://linkedin.com/in/mika-example',publicLinkedinUrl:'https://linkedin.com/in/mika-example'}]}]});
 const search=context.__findPotentialDecisionMakers('northstar.com');
 for(let i=0;i<20&&!finishVerification;i++)await new Promise(resolve=>setImmediate(resolve));
 const candidate=context.__discoveryState().selectedProspects[0];candidate.buyerRoles='Engineering Director';candidate.buyerRolesChanged=true;
 finishVerification({pages:[{url:'https://northstar.com/',text:'Northstar operates an industrial manufacturing facility with production and engineering capabilities.',fetchedAt:new Date().toISOString()}]});
 assert.equal(await search,false);
 assert.equal(candidate.buyerRoles,'Engineering Director');assert.equal(candidate.buyerRolesChanged,true);
 assert.equal(candidate.people[0].name,'Mika Example');
});

test('unapproved automatic confirmation holds paid enrichment and never invokes optional Hunter',async()=>{
  const calls=[];
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},enrichCrmContact:async (_company,person,options)=>{calls.push(options.phoneLookup?'apollo-phone':'apollo-email');return {ok:true,contact:{name:person.name,...(options.phoneLookup?{phone_number:'+371 2000 0000'}:{work_email:'marta.berzina@example.lv'})}};}},
    fetchImpl:async(url)=>{
      const target=String(url);calls.push(target.includes('approved-workflow')?'approval':target.includes('/status?')?'hunter-status':target.includes('find-email')?'hunter-finder':target.includes('verify-email')?'hunter-verifier':'public-research');
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
  assert.ok(calls.every(call=>call==='public-research')); // Public checks may run; no paid provider may execute.
  assert.equal(Object.keys(candidate.people[0].hunterChecks||{}).length,0);
  assert.equal(candidate.people[0].flowEmailCompletedFor,'');
  assert.equal(candidate.people[0].flowPhoneCompletedFor,'');
});

test('a first-name-only buyer triggers one public source check and renders a sourced full name without Apollo enrichment',async()=>{
  let publicSearches=0;const publicQueries=[];
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},searchApolloPeople:async()=>({ok:true,people:[{id:'p1',name:'Mikael',title:'President & CEO'}]})},
    fetchImpl:async(url,options)=>{
      if(!(/\/firecrawl(?:-search|\/search)/.test(String(url))))throw new Error('Unexpected request');
      if(isOfficialInventoryQuery(JSON.parse(options.body).query))return {ok:true,json:async()=>({data:[]})};
      publicSearches++;
      publicQueries.push(JSON.parse(options.body).query);
      if(publicSearches===1){assert.match(JSON.parse(options.body).query,/"Mikael"/);return {ok:true,json:async()=>({data:[{url:'https://boliden.com/management',title:'Management',markdown:'Mikael Example — President & CEO. mikael.example@boliden.com'}]})};}
      if(publicSearches===2)return {ok:true,json:async()=>({data:[]})};
      if(!JSON.parse(options.body).query.startsWith('site:linkedin.com/in/'))return {ok:true,json:async()=>({data:[]})};
      return {ok:true,json:async()=>({data:[{url:'https://www.linkedin.com/in/mikael-example',title:'Mikael Example – Boliden | LinkedIn',description:'President and CEO at Boliden'}]})};
    }});
  context.__setDiscovery({status:'no_results',selectedProspects:[{company:'Boliden',domain:'boliden.com',market:'Sweden',buyerSearchMode:'user_selected_target',buyerRoles:'CEO',people:[{id:'p1',name:'Mikael',title:'President & CEO'}]}]});
  await context.__findPublicProspectContacts('boliden.com');
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.ok(publicSearches<=14,'two Buyer Agent queries plus reconciling the mandatory LinkedIn result must avoid a redundant lookup');
  const checks=context.__discoveryState().selectedProspects[0].people[0].contactResearch.checks;
  for(const [key,count] of [['direct_email',2],['gmail',3],['linkedin',1],['buyer_agent',2]]){
    assert.equal(checks[key].status,'complete');assert.equal(checks[key].queryLog.length,count);
    for(const receipt of checks[key].queryLog){assert.equal(receipt.status,'complete');assert.ok(publicQueries.includes(receipt.query));}
  }
  assert.equal(publicQueries.filter(query=>query.startsWith('site:linkedin.com/in/')&&query.includes('"Mikael Example"')).length,1);
  assert.equal(context.__discoveryState().selectedProspects[0].people[0].publicName,'Mikael Example');
  assert.equal(context.__discoveryState().selectedProspects[0].people[0].publicLinkedinUrl,'https://www.linkedin.com/in/mikael-example');
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/mailto:mikael\.example@boliden\.com/);assert.match(context.__elements.get('customer-pipeline').innerHTML,/Publicly listed · unverified/);
  const linkedinField=new (require('jsdom').JSDOM)(context.__elements.get('customer-pipeline').innerHTML).window.document.querySelector('[data-contact-channel="linkedin"]');
  assert.equal(linkedinField.dataset.contactStatus,'found');assert.match(linkedinField.textContent,/Profile matched automatically/);assert.match(linkedinField.querySelector('a').href,/linkedin\.com\/in\//);
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/mikael\.example@boliden\.com/);
});

test('a saved first-name-only buyer receives one automatic public check when Buyers opens',async()=>{
  let requests=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async()=>{
    requests++;
    return {ok:true,json:async()=>({data:[{url:'https://boliden.com/management',title:'Leadership',markdown:'Mikael Example — President & CEO'}]})};
  }});
  context.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'test'}};
  context.__setDiscovery({selectedProspects:[{company:'Boliden',domain:'boliden.com',buyerSearchMode:'user_selected_target',people:[{id:'p1',name:'Mikael',title:'President & CEO'}]}]});
  context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5,visibleStep:5}));
  context.__scheduleSavedBuyerPublicChecks();
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.ok(requests>0);const finishedRequests=requests;
  assert.equal(context.__discoveryState().selectedProspects[0].people[0].publicName,'Mikael Example');
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Mikael Example/);
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(requests,finishedRequests);
});

test('a saved first-name buyer can gain a sourced full name from a unique public LinkedIn result',async()=>{
  let requests=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async(url,options)=>{
    if(String(url).includes('/ai/'))return {ok:false,json:async()=>({})};
    if(/firecrawl(?:-scrape|\/scrape)/.test(String(url)))return {ok:true,json:async()=>({data:{}})};
    assert.match(String(url),/firecrawl(?:-search|\/search)/);
    requests++;
    if(requests<=2)return {ok:true,json:async()=>({data:[]})};
    if(JSON.parse(options.body).query.includes('@'))return {ok:true,json:async()=>({data:[]})};
    assert.match(JSON.parse(options.body).query,/"Jacob".*"Södra"/);
    return {ok:true,json:async()=>({data:[{url:'https://se.linkedin.com/in/jacob-jonstoij',title:'Jacob Jonstoij – Södra | LinkedIn',description:'Teamledare at Södra'}]})};
  }});
  context.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'test'}};
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',publicContactStatus:'complete',people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5,visibleStep:5}));
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.ok(requests>0);
  const finishedRequests=requests;
  const person=context.__discoveryState().selectedProspects[0].people[0];
  assert.equal(person.publicName,'Jacob Jonstoij');
  assert.equal(context.__discoveryState().selectedProspects[0].publicContactVersion,'buyer-contacts-v23-company-record');
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Jacob Jonstoij/);
  const linkedinField=new (require('jsdom').JSDOM)(context.__elements.get('customer-pipeline').innerHTML).window.document.querySelector('[data-contact-channel="linkedin"]');
  assert.equal(linkedinField.dataset.contactStatus,'found');assert.match(linkedinField.textContent,/Profile matched automatically/);assert.match(linkedinField.querySelector('a').href,/linkedin\.com\/in\//);
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(requests,finishedRequests);
});

test('a focused LinkedIn lookup resolves a buyer missed by the combined search',async()=>{
  let requests=0;
  const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async(url,options)=>{
    if(String(url).includes('/ai/'))return {ok:false,json:async()=>({})};
    if(/firecrawl(?:-scrape|\/scrape)/.test(String(url)))return {ok:true,json:async()=>({data:{}})};
    if(isOfficialInventoryQuery(JSON.parse(options.body).query))return {ok:true,json:async()=>({data:[]})};
    requests++;
    if(requests<4)return {ok:true,json:async()=>({data:[]})};
    if(JSON.parse(options.body).query.includes('@'))return {ok:true,json:async()=>({data:[]})};
    assert.match(JSON.parse(options.body).query,/"Jacob" "Södra" "Team Leader"/);
    return {ok:true,json:async()=>({data:[{url:'https://se.linkedin.com/in/jacob-jonstoij-3bb486222',title:'Jacob Jonstoij – Team Leader | LinkedIn',description:'Team Leader at Södra'}]})};
  }});
  context.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'test'}};
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5,visibleStep:5}));
  context.__scheduleSavedBuyerPublicChecks();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.ok(requests>0);
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
  assert.ok(openAiCalls>=1);assert.equal(scrapes,4);assert.equal(geminiCalls,1);assert.equal(apolloCalls,0);
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
  const phoneField=new (require('jsdom').JSDOM)(context.__elements.get('customer-pipeline').innerHTML).window.document.querySelector('[data-contact-channel="phone"]');
  assert.equal(phoneField.dataset.contactStatus,'not_found');assert.match(phoneField.querySelector('.buyer-field-state').textContent,/Not found/);assert.match(phoneField.querySelector('details').textContent,/No direct phone found in completed searches/);
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
    fetchImpl:async(url,options)=>{if(/firecrawl(?:-scrape|\/scrape)/.test(String(url))||isOfficialInventoryQuery(JSON.parse(options.body).query))return {ok:true,json:async()=>({data:[]})};searches++;return {ok:true,json:async()=>({data:searches===1?[{url:'https://sodra.com/team',title:'Team',markdown:'Jacob Jonstoij — Team Leader. jacob.jonstoij@sodra.com'}]:[]})};}
  });
  context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};context.LeadIntelDialogs={confirm:async ()=>{confirmations++;return true;}};
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
    fetchImpl:async(url,options)=>{if(/firecrawl(?:-scrape|\/scrape)/.test(String(url))||isOfficialInventoryQuery(JSON.parse(options.body).query))return {ok:true,json:async()=>({data:[]})};searches++;return {ok:true,json:async()=>({data:[]})};}
  });
  context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};context.LeadIntelDialogs={confirm:async ()=>{confirmations++;return true;}};
  context.__setDiscovery({selectedProspects:[{company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'p-jacob',name:'Jacob',title:'Team Leader'}]}]});
  assert.equal(await context.__enrichSelectedProspect('sodra.com',0),true);
  assert.equal(searches,11); // Includes four grounded retries after empty public results; counts person search requests; page reads and the three official scans are handled separately.
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
  context.LeadIntelCrm=require('../crm-engine.js');context.dispatchEvent=()=>{};context.LeadIntelDialogs={confirm:async ()=>{confirmations++;return true;}};
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
    if(JSON.parse(options.body).task==='buyer-fit')return {ok:true,json:async()=>({text:weakBuyerFitResponse(JSON.parse(options.body).prompt)})};
    throw new Error('Unexpected request');
  }});
  const state=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
  state.targetCompanies=[{companyName:'Södra',website:'https://sodra.com/',domain:'sodra.com'}];state.targetMarkets=['Sweden'];state.profile.targetMarkets='Sweden';state.targetingConfirmation=Targeting.confirm(state);state.market.strategyApproval=StrategyIntegrity.approval(state);
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
    if(JSON.parse(options.body).task==='buyer-fit')return {ok:true,json:async()=>({text:weakBuyerFitResponse(JSON.parse(options.body).prompt)})};
    requests.push({url,body:JSON.parse(options.body)});
    if(url.includes('/firecrawl-search'))return {ok:true,json:async()=>({data:[{url:'https://sodra.com/news/new-factory',title:'Södra new factory',description:'Södra expands production in Sweden with a new factory.'}]})};
    throw new Error('Unexpected request');
  }});
  const state=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
  state.targetCompanies=[{companyName:'Södra',website:'https://sodra.com/',domain:'sodra.com'}];state.targetMarkets=['Sweden'];state.targetingConfirmation=Targeting.confirm(state);state.market.strategyApproval=StrategyIntegrity.approval(state);
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
  state.targetMarkets=['Sweden'];state.profile.targetMarkets='Sweden';state.targetingConfirmation=Targeting.confirm(state);state.market.strategyApproval=StrategyIntegrity.approval(state);
  state.referenceCustomers={analyzedAt:'2026-09-27T09:00:00Z',opportunityMap:{analysisAt:'2026-09-27T09:00:00Z',service:'Automation',problem:'Production efficiency',hypotheses:[{niche:'Packaging plants',sharedNeed:'Upgrade machinery',evidenceToCheck:'Factory investment'}]}};state.market.icps.push({id:'icp-lookalike',type:'lookalike',active:true});state.market.strategyApproval=StrategyIntegrity.approval(state);
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

  context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({autonomousDiscovery:{active:true}}));
  await context.__runDiscovery();

  assert.ok(phases.includes('Resolving official company domains'));
  assert.equal(phases.includes('Verifying company websites'),false);
  assert.equal(context.__discoveryState().status,'partial');assert.equal(context.__discoveryState().searchFailures.length,0);
  assert.equal(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta')).lastCompanyRun.canceled,true);
  assert.equal(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta')).autonomousDiscovery.active,false);
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
  assert.equal(requests,3,'home check, successful search and a discovered internal-page recovery');
  assert.equal(result.length,1);
});

test('failed company-site checks can be retried without repeating market searches and successful results qualify',async()=>{
  let requests=0;
  const context=loadDiscoveryRunner({
    renderNodes:true,
    requestTimeout:1000,
    fetchImpl:async(_url,options)=>{
      if(JSON.parse(options.body).task==='buyer-fit')return {ok:true,json:async()=>({text:JSON.stringify({companies:[{domain:'northstar.com',fit:100,purchase:'industrial automation',reason:'Latvian production capacity requires industrial automation.',buyerRole:'manufacturer',relevantSignalUrls:['https://northstar.com/news/new-factory'],evidence:[{url:'https://northstar.com/news/new-factory',quote:'Northstar is a Latvian industrial manufacturer investing in automation and expanding production capacity at a new factory.'}]}]})})};
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
    // This case verifies provider retry classification, not the separate global deadline.
    scaleProductionRunTimeout:50,
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
      if(JSON.parse(options.body).task==='buyer-fit')return {ok:true,json:async()=>({text:weakBuyerFitResponse(JSON.parse(options.body).prompt)})};
      const query=JSON.parse(options.body).query;
      requests.push({url,query});
      if(url.includes('/api/ai/web-search'))return {ok:true,status:200,json:async()=>({results:[query.includes('-site:')?{url:'https://independent.example/northstar',title:'Northstar company profile',text:'Northstar is an industrial manufacturer in Latvia.'}:query.startsWith('site:')
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
  assert.equal(requests.length,7,'website read, resolution, official evidence and independent corroboration use the existing providers');
  assert.ok(requests.every(item=>!String(item.query||'').includes('discover-')));
  assert.equal(state.funnel.marketSearchesCompleted,4);
  assert.equal(state.funnel.officialDomainsResolved,1);
  assert.equal(state.funnel.openAiFallbackSearches,3);
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
    location: 'Latvia',
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
 const main=JSON.parse(ctx.localStorage.getItem('leadintel_customer_v2_state'));main.market.icps=[{id:'icp-core',type:'core',active:true},{id:'icp-lookalike',type:'lookalike',active:false}];main.targetCompanies=[{companyName:'North',domain:'north.example',website:'https://north.example'}];main.market.strategyApproval=StrategyIntegrity.approval(main);ctx.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
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
 assert.match(html,/data-keep-buyer[^>]*aria-pressed="false"[^>]*disabled/);assert.match(html,/Proceed/);assert.ok(html.indexOf('data-find-prospect-buyers')<html.indexOf('selected-prospect-people'));
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
test('optional contact-review timeout preserves a completed core contact pass and records the review gap',async()=>{
 const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:30,
  bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'}},
  fetchImpl:async url=>{
  if(String(url).includes('/grounded-contact-search'))return {ok:true,json:async()=>({status:'unavailable',provider:'gemini',web_search:false,reason:'Gemini is not configured',results:[]})};
   if(String(url).includes('contact-evidence-review'))return new Promise(()=>{});
   if(String(url).includes('web-search'))return {ok:true,json:async()=>({results:[]})};
   if(/firecrawl(?:-scrape|\/scrape)/.test(String(url)))return {ok:true,json:async()=>({data:{markdown:'Anna Buyer COO contact team'}})};
   return {ok:true,json:async()=>({data:[{url:'https://example.com/team',markdown:'Anna Buyer COO contact team'}]})};
  }});
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{id:'anna',name:'Anna Buyer',title:'COO',organization:'Example',publicName:'Anna Buyer',publicNameUrl:'https://example.com/team',publicLinkedinUrl:'https://linkedin.com/in/anna'}]}]});
 assert.equal(await context.__findPublicProspectContacts('example.com'),true);
 const candidate=context.__discoveryState().selectedProspects[0];
 assert.equal(candidate.people[0].emailResearch.status,'complete');assert.ok(candidate.publicResearch.patternSearches>0);
 assert.equal(candidate.publicContactStatus,'complete');assert.equal(candidate.publicResearch.gemini,'unavailable');assert.ok(candidate.publicResearch.issues.some(issue=>/Optional.*review.*unavailable/i.test(issue)));
 assert.match(context.__elements.get('customer-pipeline').innerHTML,/data-find-public-contacts="example.com"/);
});

test('a failed personal phone query keeps the overall contact pass incomplete despite a known identity',async()=>{
 const context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async(url,options)=>{
  if(String(url).includes('/ai/web-search')&&JSON.parse(options.body).query.includes('(phone OR'))return {ok:false,status:503,json:async()=>({error:'Phone source unavailable'})};
  if(String(url).includes('/ai/'))return {ok:true,json:async()=>({status:'complete',results:[],conflicts:[]})};
  if(/firecrawl(?:-scrape|\/scrape)/.test(String(url)))return {ok:true,json:async()=>({data:{markdown:'Anna Buyer — Head of Procurement at Example. anna.buyer@example.com'}})};
  if(JSON.parse(options.body).query.includes('(phone OR'))throw new Error('Phone source unavailable');
  return {ok:true,json:async()=>({data:[{url:'https://example.com/team',markdown:'Anna Buyer — Head of Procurement at Example. anna.buyer@example.com'}]})};
 }});
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{id:'anna',name:'Anna Buyer',title:'Head of Procurement',organization:'Example',publicName:'Anna Buyer',publicNameUrl:'https://example.com/team',publicLinkedinUrl:'https://linkedin.com/in/anna'}]}]});
 await context.__findPublicProspectContacts('example.com');
 const c=context.__discoveryState().selectedProspects[0];assert.equal(c.people[0].publicEmail,'anna.buyer@example.com');assert.equal(c.people[0].contactResearch.channels.gmail.status,'complete');assert.equal(c.publicContactStatus,'error');
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
 assert.equal(contact,6);assert.ok(queries.slice(0,6).every(isOfficialInventoryQuery));assert.ok(profiles>contact);
});

test('ranked buyer controls retain the original candidate index after ranking clones the people',()=>{
 const ctx=loadDiscoveryRunner({renderNodes:true,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}}});
 ctx.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',market:'Sweden',buyerSearchMode:'user_selected_target',people:[{id:'p1',name:'Jane Buyer',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team/jane'}]}]});
 ctx.__renderPipeline();
 const html=ctx.__elements.get('customer-pipeline').innerHTML;
 assert.match(html,/data-recheck-buyer="example.com" data-person-index="0"/);
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
 const people=Array.from({length:6},(_,i)=>({id:`person-${i}`,name:`Anna Buyer${i}`,publicName:`Anna Buyer${i}`,title:'Procurement Director',organization:'Example',publicNameUrl:`https://example.com/team/${i}`,emailResearch:{status:"complete",searches:3,failed:0,checkedAt:new Date().toISOString()}}));
 const html=context.__renderSelectedProspects([{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people,buyerDiscovery:{pool:[...people,{name:'Unresolved',title:'Procurement Director',identityStatus:'pending'}],providerStatus:{firecrawl:{status:'complete'}},researchIncomplete:true}}]);
 assert.ok(html.indexOf('4 priority buyers')>=0,html);assert.ok(html.indexOf('4 priority buyers')<html.indexOf('2 other potential buyers'),html);
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
 assert.match(html,/Official email source needs rechecking/);assert.match(html,/data-recheck-buyer/);
 assert.match(html,/data-keep-buyer="example.com"[^>]*disabled/);
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(ctx.localStorage.getItem('leadintel_customer_v2_discovery')));
 assert.equal(restored.selectedProspects[0].people[0].publicEmailSourceCheck.status,'failed');
});

test('buyers with incomplete research have visible reasons and cannot occupy the researched recommendation group',()=>{
 const context=loadDiscoveryRunner({renderNodes:true});
 const people=Array.from({length:11},(_,i)=>({id:`person-${i}`,name:`Anna Buyer${i}`,title:i===10?'Head of Procurement':'Project Director',organization:'Example',publicNameUrl:`https://example.com/team/${i}`,emailResearch:i===10?{status:'complete',searches:3,failed:0,checkedAt:new Date().toISOString()}:{status:'partial',searches:1,failed:1,checkedAt:new Date().toISOString()}}));
 const html=context.__renderSelectedProspects([{company:'Example',domain:'example.com',people,buyerRoles:['Project Director','Procurement Director']}]);
 assert.match(html,/4 priority buyers/);assert.equal((html.match(/class="buyer-recommendation">Recommended</g)||[]).length,1);assert.ok(html.indexOf('Anna Buyer10')<html.indexOf('other potential buyers'));
 assert.match(html,/Purchasing \/ supplier selection/);assert.match(html,/purchasing authority unconfirmed/);assert.match(html,/Research: incomplete/);assert.match(html,/Checks incomplete/);
});

test('a company-level completed check does not conceal an unresearched individual and follow-up runs only once',async()=>{
 let requests=0;
 const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,fetchImpl:async()=>{requests++;return {ok:true,json:async()=>({data:[]})};}});
 context.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'test'}};
  context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',publicContactStatus:'complete',publicContactVersion:'buyer-contacts-v23-company-record',people:[{id:'p1',name:'Anna Buyer',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team'}]}]});
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5,visibleStep:5}));
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:4,visibleStep:4}));
 context.__scheduleSavedBuyerPublicChecks();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(requests,0);
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:5,visibleStep:5}));
 context.__scheduleSavedBuyerPublicChecks();context.__scheduleSavedBuyerPublicChecks();
 await new Promise(resolve=>setTimeout(resolve,50));
 assert.ok(requests>0);assert.ok(context.__discoveryState().selectedProspects[0].people[0].emailResearch.searches>0);
 const completed=requests;context.__scheduleSavedBuyerPublicChecks();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(requests,completed);
});

test('a stale role shows its actual hold reason beside a disabled proceed action',()=>{
 const context=loadDiscoveryRunner({renderNodes:true});
 const html=context.__renderSelectedProspects([{company:'Example',domain:'example.com',people:[{id:'old',name:'Anna Buyer',title:'Project Director',organization:'Example',publicNameUrl:'https://example.com/team',identityEvidenceDate:'2013-05-01'}],buyerRoles:['Project Director']}]);
 assert.match(html,/On hold · Current role needs verification/);assert.match(html,/Review buyer qualification before continuing: Current role requires review/);
 assert.match(html,/data-keep-buyer="example.com"[^>]*disabled/);assert.doesNotMatch(html,/Recommended · researched match/);
});

test('authentication delay does not consume the one automatic buyer check',async()=>{
 let requests=0;
 const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,bridgeImpl:{session:null,workspace:null},fetchImpl:async()=>{requests++;return {ok:true,json:async()=>({data:[]})};}});
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',publicContactStatus:'error',people:[{id:'p1',name:'Anna Buyer',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team'}]}]});
 context.__scheduleSavedBuyerPublicChecks();await new Promise(r=>setTimeout(r,10));assert.equal(requests,0);
 context.LeadIntelServerBridge.session={authenticated:true};context.LeadIntelServerBridge.workspace={id:'test'};
 context.__scheduleSavedBuyerPublicChecks();await new Promise(r=>setTimeout(r,80));assert.ok(requests>0);
 const finished=requests;context.__scheduleSavedBuyerPublicChecks();await new Promise(r=>setTimeout(r,10));assert.equal(requests,finished);
});

test('newer same-company CRM research restores the shortlist, sources and local confirmations',()=>{
 const context=loadDiscoveryRunner();
 const candidate={domain:'example.com',company:'Example',buyerRoles:'Procurement Director',people:[{id:'p1',name:'Anna Buyer',kept:true,flowSelected:true,linkedinConfirmationMethod:'automatic',linkedinConfirmedUrl:'https://www.linkedin.com/in/anna-buyer',contactResearch:{version:1,checks:{gmail:{status:'complete'}},channels:{gmail:{status:'complete'}}}}],buyerDiscovery:{checkedAt:'2026-10-01T00:00:00Z',pool:[{id:'obsolete',name:'Old',title:'Procurement Director',identityStatus:'pending'}]}};
 const detail={company:{normalized_domain:'example.com'},contacts:[{external_person_id:'p1',linkedin_url:'https://www.linkedin.com/in/anna-buyer',public_linkedin_url:'https://www.linkedin.com/in/anna-buyer'}],intelligence:{research_snapshot:{buyerResearch:{checkedAt:'2026-10-02T00:00:00Z',researchIncomplete:true,buyers:[{id:'p1',name:'Anna Buyer',title:'Procurement Director',organization:'Example',identitySourceUrl:'https://example.com/team',emailResearch:{status:'complete',searches:3,failed:0,checkedAt:new Date().toISOString()},contactEvidence:{email:'anna@example.com',emailUrl:'https://example.com/contact',phone:'+371 12345678',phoneUrl:'https://example.com/contact'}}],unresolved:[{id:'pending',name:'John',title:'Procurement Director'}]}}}};
 assert.equal(context.__restoreNewerBuyerResearch(candidate,detail),true);
 const person=candidate.people[0];assert.equal(person.linkedinConfirmationMethod,'automatic');assert.equal(person.contactResearch.channels.gmail.status,'complete');assert.equal(person.linkedin_url,'https://www.linkedin.com/in/anna-buyer');assert.equal(person.publicLinkedinUrl,'https://www.linkedin.com/in/anna-buyer');assert.equal(person.publicEmailUrl,'https://example.com/contact');assert.equal(person.publicPhone,'+371 12345678');assert.equal(person.kept,true);assert.equal(person.flowSelected,true);assert.equal(person.emailResearch.searches,3);assert.equal(candidate.buyerDiscovery.researchIncomplete,true);assert.equal(candidate.buyerDiscovery.pool.some(p=>p.identityStatus==='pending'),true);assert.equal(candidate.buyerDiscovery.pool.some(p=>p.id==='obsolete'),false);
 assert.equal(context.__restoreNewerBuyerResearch(candidate,detail),false);
 candidate.buyerDiscovery.pool.push({id:'obsolete-again',name:'Old',title:'Procurement Director',identityStatus:'pending'});assert.equal(context.__restoreNewerBuyerResearch(candidate,detail),true);assert.equal(candidate.buyerDiscovery.pool.some(p=>p.id==='obsolete-again'),false);
 detail.intelligence.research_snapshot.buyerResearch.checkedAt='2026-10-03T00:00:00Z';detail.company.normalized_domain='other.example';assert.equal(context.__restoreNewerBuyerResearch(candidate,detail),false);
 detail.company.normalized_domain='example.com';candidate.peopleStatus='loading';assert.equal(context.__restoreNewerBuyerResearch(candidate,detail),false);
});


test('restored legacy research keeps unresolved identities and incomplete coverage visible',()=>{
 const context=loadDiscoveryRunner({renderNodes:true});
 const candidate={domain:'example.com',company:'Example',buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director'],people:[],buyerDiscovery:{}};
 context.__restoreNewerBuyerResearch(candidate,{company:{normalized_domain:'example.com'},intelligence:{research_snapshot:{buyerResearch:{version:1,checkedAt:'2026-10-02T00:00:00Z',researchIncomplete:true,unresolved:[{id:'pending',name:'John',title:'Procurement Director'}],buyers:[{id:'p1',name:'Anna Buyer',title:'Procurement Director',organization:'Example',identitySourceUrl:'https://example.com/team',emailResearch:{status:'complete',searches:3,failed:0,checkedAt:new Date().toISOString()}}]}}}});
 const html=context.__renderSelectedProspects([candidate]);assert.match(html,/1 unresolved identities/);assert.match(html,/Research incomplete/);assert.match(html,/Aggregate provider activity was not retained/);assert.match(html,/3 email evidence searches/);
});

test('default contact research attempts all ten, retains four recommendations and resumes only requested checks',async()=>{
 const queries=[],savedSnapshots=[];
 const bridgeImpl={session:{authenticated:true},workspace:{id:'w1'},listCrmCompanies:async()=>({ok:true,companies:[{id:'c1',normalized_domain:'example.com'}]}),saveCrmContacts:async()=>({ok:true}),saveCrmCompany:async row=>{savedSnapshots.push(row);return {ok:true};}};
 const context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl,fetchImpl:async(url,options)=>{
  if(String(url).includes('/grounded-contact-search'))return {ok:true,json:async()=>({status:'unavailable',provider:'gemini',web_search:false,reason:'Gemini is not configured',results:[]})};
  if(/firecrawl(?:-search|\/search)/.test(String(url)))queries.push(JSON.parse(options.body).query);
  if(/firecrawl(?:-scrape|\/scrape)/.test(String(url)))return {ok:true,json:async()=>({data:{markdown:'Official Example company team and business contact information.'}})};
  return {ok:true,json:async()=>({data:[]})};
 }});
 context.LeadIntelCrm=require('../crm-engine.js');
 const people=Array.from({length:10},(_,i)=>({id:'p'+i,name:'Anna '+['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet'][i],publicName:'Anna '+['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet'][i],organization:'Example',title:i<4?'Head of Procurement':'Procurement Manager',publicNameUrl:'https://example.com/team/'+i,linkedin_url:'https://linkedin.com/in/anna-buyer'+i}));
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director','Procurement Manager'],people}]});
 assert.equal(await context.__findPublicProspectContacts('example.com'),true);
 let c=context.__discoveryState().selectedProspects[0];assert.equal(c.people.length,10);assert.equal(c.people.filter(p=>p.emailResearch.status==='complete').length,10);
 assert.ok(queries.some(q=>/Juliet/.test(q)));assert.equal(Discovery.rankedBuyerShortlist(c.people,{decisionMakers:'Procurement Director; Procurement Manager'},c).recommendedIds.length,4);
 assert.equal(savedSnapshots.at(-1).intelligence.research_snapshot.buyerResearch.buyers.length,10);
 const roundtrip=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery'))).selectedProspects[0];assert.equal(roundtrip.publicResearch.researchedPersonIds.length,10);assert.equal(roundtrip.people[0].gmailCandidates.length,3);
 queries.length=0;assert.equal(await context.__findPublicProspectContacts('example.com',{personIds:['p7'],force:true}),true);
 c=context.__discoveryState().selectedProspects[0];assert.equal(c.people.filter(p=>p.emailResearch.status==='complete').length,10);assert.ok(queries.some(q=>q.includes('Anna Hotel')));assert.ok(!queries.some(q=>/Alpha|Bravo|Charlie|Delta|Echo|Foxtrot|Golf|India|Juliet/.test(q)));
 const before=queries.length;context.__scheduleSavedBuyerPublicChecks();await new Promise(r=>setTimeout(r,5));assert.ok(queries.slice(before).every(query=>!/Anna (Alpha|Bravo|Charlie|Delta|Echo|Foxtrot|Golf|Hotel|India|Juliet)/.test(query)),'Entry may resume missing company evidence while completed person checks are reused');
});

test('one failed contact source does not prevent research for the other nine and retry skips completed checks',async()=>{
 let fail=true;const queries=[];
 const context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async(url,options)=>{
  if(String(url).includes('/ai/web-search')&&fail&&JSON.parse(options.body).query.includes('Anna Juliet')&&JSON.parse(options.body).query.includes('(phone OR'))return {ok:false,status:503,json:async()=>({error:'Phone source unavailable'})};
  if(String(url).includes('/ai/'))return {ok:true,json:async()=>({status:'complete',results:[],conflicts:[]})};
  if(/firecrawl(?:-scrape|\/scrape)/.test(String(url)))return {ok:true,json:async()=>({data:{markdown:'Official Example leadership team.'}})};
  const query=JSON.parse(options.body).query;queries.push(query);
  if(fail&&query.includes('Anna Juliet')&&query.includes('(phone OR'))throw new Error('Phone source unavailable');
  return {ok:true,json:async()=>({data:[]})};
 }});
 const people=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet'].map((last,i)=>({id:'p'+i,name:'Anna '+last,organization:'Example',title:'Procurement Director',publicNameUrl:'https://example.com/team/'+i,linkedin_url:'https://linkedin.com/in/anna-'+last.toLowerCase()}));
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:'Procurement Director',people}]});
 await context.__findPublicProspectContacts('example.com');let c=context.__discoveryState().selectedProspects[0];
 assert.equal(c.people.filter(p=>p.emailResearch.status==='complete').length,9);assert.equal(c.people[9].contactResearch.channels.phone.status,'partial');assert.equal(c.publicContactStatus,'error');
 fail=false;queries.length=0;await context.__findPublicProspectContacts('example.com');c=context.__discoveryState().selectedProspects[0];
 assert.equal(c.people.filter(p=>p.emailResearch.status==='complete').length,10);assert.equal(c.publicContactStatus,'complete');
 assert.equal(queries.filter(isOfficialInventoryQuery).length,6,'an earlier empty company inventory must be rechecked');const personQueries=queries.filter(query=>!isOfficialInventoryQuery(query));assert.equal(personQueries.length,1);assert.ok(personQueries[0].includes('Anna Juliet')&&personQueries[0].includes('(phone OR'));
});
test('pending role edits do not start contact research automatically before the buyer refresh',async()=>{
 let calls=0;const context=loadDiscoveryRunner({bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({data:[]})};}});
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRolesChanged:true,people:[{id:'p1',name:'Anna Buyer',title:'COO',publicNameUrl:'https://example.com/team'}]}]});
 context.__scheduleSavedBuyerPublicChecks();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(calls,0);
});
test('evidence-disqualified top pick is replaced by the next researched buyer, within ten candidates',async()=>{
 const context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async(url,options)=>{
  if(String(url).includes('/grounded-contact-search'))return {ok:true,json:async()=>({status:'unavailable',provider:'gemini',web_search:false,reason:'Gemini is not configured',results:[]})};
  if(String(url).includes('/contact-evidence-review')){const people=JSON.parse(options.body).people;return {ok:true,json:async()=>({status:'complete',conflicts:people.some(p=>p.id==='p0')?[{person_id:'p0',reason:'Different employer'}]:[]})};}
  if(/firecrawl(?:-scrape|\/scrape)/.test(String(url)))return {ok:true,json:async()=>({data:{markdown:'Example leadership team and business contacts.'}})};
  if(/firecrawl(?:-search|\/search)/.test(String(url)))return {ok:true,json:async()=>({data:[{url:'https://example.com/team',markdown:'Example leadership team and business contacts.'}]})};
  return {ok:true,json:async()=>({data:[]})};
 }});
 const people=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet'].map((last,i)=>({id:'p'+i,name:'Anna '+last,publicName:'Anna '+last,organization:'Example',title:'Procurement Director',publicNameUrl:'https://example.com/team/'+i,linkedin_url:'https://linkedin.com/in/anna-'+last.toLowerCase()}));
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director'],people}]});
 assert.equal(await context.__findPublicProspectContacts('example.com'),true);
 const c=context.__discoveryState().selectedProspects[0],ranked=Discovery.rankedBuyerShortlist(c.people,{decisionMakers:'Procurement Director'},c);
 assert.deepEqual(Array.from(ranked.recommendedIds),['p1','p2','p3','p4']);assert.equal(c.people.filter(p=>p.emailResearch.status==='complete').length,10);
 assert.ok(c.publicResearch.conflicts.some(row=>row.person_id==='p0'));
});

test('targeted executive search fills the reserved place and retains completed existing contact checks',async()=>{
 const context=loadDiscoveryRunner({requestTimeout:1000,renderNodes:true,fetchImpl:async url=>({ok:true,json:async()=>/firecrawl(?:-scrape|\/scrape)/.test(String(url))?{data:{markdown:'Anna Executive is CEO at Example'}}:{data:[{url:'https://example.com/team/anna-executive',title:'Anna Executive | CEO | Example',description:'Anna Executive is CEO at Example'}]}}),bridgeImpl:{session:{authenticated:true},workspace:{id:'test'},saveNow:async()=>({saved:true})}});
 const people=Array.from({length:5},(_,i)=>({id:'p'+i,name:'Person Buyer'+i,title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team/'+i,emailResearch:{status:'complete',searches:7,failed:0,checkedAt:new Date().toISOString()},contactResearch:{version:1,identityKey:'existing',checks:{gmail:{status:'complete',checkedAt:new Date().toISOString()}},channels:{gmail:{status:'complete'}}}}));
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',market:'Sweden',buyerRoles:'Procurement Director',people,peopleStatus:'complete',publicContactVersion:'buyer-contacts-v23-company-record',buyerSearchMode:'user_selected_target'}]});
 assert.equal(await context.__findExecutiveBuyer('example.com'),true);
 const candidate=context.__discoveryState().selectedProspects[0],ranked=Discovery.rankedBuyerShortlist(candidate.people,{decisionMakers:candidate.buyerRoles},candidate);
 assert.equal(ranked.committeeCoverage.executives,1);assert.equal(ranked.executiveCoverage.status,'incomplete');assert.ok(candidate.buyerDiscovery.executiveResearch.queries>=3&&candidate.buyerDiscovery.executiveResearch.queries<=8);
 assert.ok(candidate.people.filter(p=>/^p\d+$/.test(p.id)).every(p=>p.emailResearch.searches===7&&p.contactResearch.channels.gmail.status==='complete'));
 const html=context.__elements.get('customer-pipeline').innerHTML;assert.match(html,/Buying committee coverage incomplete/);
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery'))).selectedProspects[0];assert.equal(restored.buyerDiscovery.executiveResearch.status,'partial');
});

test('reserved executive cards display consecutive priority ranks independent of the full ten-person pool',()=>{
 const context=loadDiscoveryRunner({renderNodes:true});
 const people=['CEO','COO','Managing Director','Project Manager','Project Manager','Project Manager','Project Manager'].map((title,i)=>({id:'person'+i,name:'Qualified Person'+i,title,organization:'Northstar',publicNameUrl:'https://northstar.com/team/'+i,identityEvidenceDate:new Date().toISOString()}));
 const candidate={company:'Northstar',domain:'northstar.com',buyerRoles:['Project Manager'],people,peopleStatus:'complete'};
 const html=context.__renderSelectedProspects([candidate]);
 const ranks=[...html.matchAll(/selected-prospect-rank">(\d+)</g)].slice(0,4).map(m=>Number(m[1]));
 assert.deepEqual(ranks,[1,2,3,4]);assert.match(html,/4 priority buyers/);
});


test('a stalled fit response body times out independently and aborts its request',async()=>{
  const context=loadDiscoveryRunner();let requestSignal;
  await assert.rejects(context.__withDiscoveryDeadline(async signal=>{requestSignal=signal;return new Promise(()=>{});},undefined,12),error=>error.status===408&&error.code==='DISCOVERY_SEARCH_TIMEOUT');
  assert.equal(requestSignal.aborted,true);
});
test('failed company scrapes are attempted once per domain even when event searches retry',async()=>{
  let scrapes=0,searches=0;
  const context=loadDiscoveryRunner({requestTimeout:1000,fetchImpl:async(url)=>{
    if(url.includes('firecrawl-scrape')){scrapes++;return {ok:false,status:503,json:async()=>({})};}
    if(url.includes('firecrawl-search')){searches++;return {ok:false,status:503,json:async()=>({})};}
    throw new Error('Unexpected request');
  }});
  await assert.rejects(context.__firecrawlCompanySearch({id:'v1',kind:'verification',domain:'test.example',query:'site:test.example manufacturing'}));
  await assert.rejects(context.__firecrawlCompanySearch({id:'v2',kind:'verification',domain:'test.example',query:'site:test.example expansion'}));
  assert.equal(scrapes,1);assert.equal(searches,4);
});
test('domain lookup uses search snippets without scraping every search result',async()=>{
  let body;const context=loadDiscoveryRunner({requestTimeout:1000,fetchImpl:async(_,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({data:[{url:'https://northsteel.lv/',title:'North Steel official website',description:'North Steel manufactures industrial products in Latvia. '.repeat(4)}]})};}});
  const results=await context.__firecrawlCompanySearch({id:'r1',kind:'resolution',company:'North Steel',query:'"Buyer" official company website'});
  assert.equal(body.limit,3);assert.equal(body.scrapeOptions,undefined);assert.equal(results[0].verifiedAt,'');
});
test('purchasing-fit progress and failures survive rendering and reload without a false no-match',()=>{
  const context=loadDiscoveryRunner({renderNodes:true});
  context.__setDiscovery({status:'running'});context.__setDiscoveryProgress({phase:'buyer-fit',completed:1,total:3});context.__renderStatus();context.__renderDiscoveryFunnel();
  assert.match(context.__elements.get('company-discovery-status').textContent,/Checking purchasing fit · 1\/3/);
  assert.match(context.__elements.get('discovery-funnel').innerHTML,/Checking purchasing fit/);
  context.__setDiscovery({status:'error',searchFailures:[{phase:'buyer-fit',company:'Buyer',domain:'buyer.example',status:408,reason:'timeout'}]});context.__renderDiscoveryFunnel();
  assert.equal(context.__discoveryState().searchFailures[0].phase,'buyer-fit');assert.match(context.__elements.get('discovery-funnel').innerHTML,/Purchasing fit/);assert.match(context.__elements.get('discovery-funnel').innerHTML,/Recheck companies/);
});
test('assessment warnings retain exact causes and distinguish same-name company domains after reload',()=>{
 const ctx=loadDiscoveryRunner({renderNodes:true});ctx.__setDiscovery({status:'partial',searchFailures:[{phase:'buyer-fit',domain:'cars.example',company:'Example',code:'BUYER_FIT_EVIDENCE_REJECTED',detail:'The assessment did not contain a valid fit score.',status:422},{phase:'buyer-fit',domain:'trucks.example',company:'Example',code:'BUYER_FIT_EVIDENCE_REJECTED',detail:'The assessment did not select a confirmed offer.',status:422}]});ctx.__renderDiscoveryFunnel();
 const html=ctx.__elements.get('discovery-funnel').innerHTML;assert.match(html,/cars\.example/);assert.match(html,/trucks\.example/);assert.match(html,/valid fit score/);assert.match(html,/confirmed offer/);assert.match(html,/2 company assessments need attention/);assert.equal(ctx.__discoveryState().searchFailures[0].detail,'The assessment did not contain a valid fit score.');
});
test('an evidence abstention retry clears the technical warning while retaining review and qualified results',async()=>{
 const at=new Date().toISOString(),evidence=[{url:'https://northstar.com/about',verifiedAt:at,text:'Northstar manufactures industrial equipment in Latvia and supports the manufacturing sector.'}],ctx=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async()=>({ok:true,json:async()=>({text:JSON.stringify({companies:[{domain:'northstar.com',fit:null,evidenceStatus:'insufficient',relationship:'unverified',reason:'The supplied source does not describe production processes.'}]})})})});
 ctx.__setDiscovery({lastRunAt:at,status:'partial',potentialMatches:[{company:'Northstar',domain:'northstar.com',market:'Latvia',evidence,qualificationGaps:['Purchasing application unverified']}],selectedProspects:[{company:'Kept',domain:'kept.example',buyerSearchMode:'user_selected_target'}],searchFailures:[{phase:'buyer-fit',domain:'northstar.com',company:'Northstar',code:'BUYER_FIT_EVIDENCE_REJECTED',reason:'request_rejected',status:422}]});
 assert.equal(await ctx.__retryFailedDiscoveryChecks(),true);const state=ctx.__discoveryState();assert.equal(state.searchFailures.length,0);assert.equal(state.potentialMatches[0].buyerFitIssueCode,'insufficient_evidence');assert.equal(state.candidates.length,0);assert.equal(state.selectedProspects[0].domain,'kept.example');ctx.__renderDiscoveryFunnel();assert.match(ctx.__elements.get('discovery-funnel').innerHTML,/1 company needs more evidence/);assert.doesNotMatch(ctx.__elements.get('discovery-funnel').innerHTML,/provider check.*failed/);
 const saved=Discovery.normalizeDiscoveryState(JSON.parse(ctx.localStorage.getItem('leadintel_customer_v2_discovery')));assert.equal(saved.potentialMatches[0].buyerFitIssueCode,'insufficient_evidence');
});
test('full discovery retains the evidence-gap outcome through its fit cache and saved review list',async()=>{
 const at=new Date().toISOString(),company={company:'Northstar',domain:'northstar.com',market:'Latvia',evidence:[{url:'https://northstar.com/about',verifiedAt:at,text:'Northstar manufactures industrial equipment in Latvia for business customers.'}]};
 const ctx=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,scaleProductionRunTimeout:1000,fetchImpl:async(_url,options)=>JSON.parse(options.body).task==='buyer-fit'?{ok:true,json:async()=>({text:JSON.stringify({companies:[{domain:company.domain,fit:null,relationship:'unverified',evidenceStatus:'insufficient',reason:'Production process evidence is missing.'}]})})}:{ok:true,json:async()=>({data:[]})}});
 ctx.LeadIntelDiscovery={...Discovery,mergeCompanyCandidates:()=>[company],buildPotentialCompanyCandidates:()=>[company]};ctx.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({targetCount:1}));await ctx.__runDiscovery({autoPass:3});
 const state=ctx.__discoveryState();assert.equal(state.searchFailures.length,0);assert.equal(state.potentialMatches.find(c=>c.domain===company.domain)?.buyerFitIssueCode,'insufficient_evidence');assert.equal(state.candidates.length,0);assert.ok(['complete','no_results'].includes(state.status));
});

test('a qualified first pass checks purchasing fit before broadening and does not repeat completed fit batches',async()=>{
  let marketCalls=0,fitCalls=0,checkpoint;
  const text='North Steel manufactures industrial equipment in Latvia and purchases industrial automation for its production lines. The company operates a new factory with automated manufacturing equipment.';
  const date=new Date().toISOString().slice(0,10),verifiedAt=new Date().toISOString();
  const candidate={company:'North Steel',domain:'northsteel.lv',market:'Latvia',evidence:[{url:'https://northsteel.lv/products',text,verifiedAt},{url:'https://northsteel.lv/news/new-factory',text,date,verifiedAt},{url:'https://industrynews.lv/north-steel',text,date,verifiedAt}],matchedSignals:[{id:'expansion',name:'Expansion',matchedTerms:['new factory'],evidence:[{url:'https://northsteel.lv/news/new-factory'},{url:'https://industrynews.lv/north-steel'}]}]};
  const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:1000,fetchImpl:async(_,options)=>{
    const body=JSON.parse(options.body);
    if(body.task==='buyer-fit'){fitCalls++;return {ok:true,json:async()=>({text:JSON.stringify({companies:[{domain:candidate.domain,fit:100,purchase:'industrial automation',reason:'Production lines use purchased industrial automation.',buyerRole:'manufacturer',relevantSignalUrls:candidate.matchedSignals[0].evidence.map(e=>e.url),evidence:[{url:candidate.evidence[0].url,quote:text}]}]})})};}
    marketCalls++;return {ok:true,json:async()=>({data:[]})};
  }});
  context.LeadIntelQualificationSettings={get:()=>({researchPriority:'signals',minimumScore:80})};
  context.LeadIntelDiscovery={...Discovery,mergeCompanyCandidates:()=>[candidate],buildPotentialCompanyCandidates:()=>[],researchBuyerFit:(pool,profile,generate,options)=>Discovery.researchBuyerFit(pool,profile,generate,{...options,onProgress:progress=>{
    options.onProgress(progress);
    checkpoint=Discovery.recoverInterruptedDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')));
  }})};
  context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({targetCount:1}));
  await context.__runDiscovery({autoPass:3});
  const result=context.__discoveryState();
  assert.equal(result.funnel.qualifiedCompanies,1);assert.equal(result.funnel.adaptiveFollowUpSearches,0);assert.equal(fitCalls,1);assert.equal(marketCalls,6);
  assert.equal(checkpoint.status,'partial');
  assert.equal(checkpoint.latestRunCandidateCount,1);
  assert.equal(checkpoint.candidates[0]?.domain,candidate.domain,'a completed fit batch must survive closing the tab before the run finishes');
  assert.equal(checkpoint.retainedLastSuccessfulResults,false);
  assert.ok(checkpoint.lastRunAt);
  const restored=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')));
  assert.equal(restored.candidates[0].domain,candidate.domain);assert.ok(Discovery.verifiedBuyerFit(restored.candidates[0],{...JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state')).profile,...Targeting.profileFields(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state')))}));
});

test('five requested companies keep their different checked scores through rendering and reload',async()=>{
 const scores=[94,82,79,68,55,44],at=new Date().toISOString();
 const pool=scores.map((score,i)=>({company:`North${i}`,domain:`north${i}.lv`,market:'Latvia',evidence:[{url:`https://north${i}.lv/products`,verifiedAt:at,text:`North${i} manufactures industrial equipment in Latvia and purchases industrial automation for its production lines. Specialist partners provide engineering equipment for this manufacturing process.`},{url:`https://journal.lv/north${i}`,text:`North${i} operates industrial manufacturing facilities in Latvia and supplies business customers.`}]}));
 const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,scaleProductionRunTimeout:1000,fetchImpl:async(_,options)=>{
  const body=JSON.parse(options.body);
  if(body.task==='buyer-fit'){
   const companies=JSON.parse(body.prompt.split('. Companies: ')[1]);
   return {ok:true,json:async()=>({text:JSON.stringify({companies:companies.map(c=>({domain:c.domain,fit:scores[Number(c.domain.match(/north(\d+)/)[1])],offerId:'offer-0',reason:'Production uses purchased automation.',buyerRole:'manufacturer',evidence:[{sourceId:'source-0',quote:c.evidence[0].text}]}))})})};
  }
  return {ok:true,json:async()=>({data:[]})};
 }});
 context.LeadIntelDiscovery={...Discovery,mergeCompanyCandidates:()=>pool,buildPotentialCompanyCandidates:()=>[]};
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({targetCount:5,activeJourneyStage:4}));
 await context.__runDiscovery({autoPass:3});
 const state=context.__discoveryState();
 assert.equal(state.candidates.length,6,'all completed checks must be retained, including those beyond the display amount');
 assert.deepEqual(Array.from(state.candidates,c=>c.qualification.score),scores);
 assert.equal(state.candidates.filter(c=>c.qualification.automaticEligible).length,2);
 context.__setDiscovery({...state,status:'partial',latestRunCandidateCount:2});context.__renderStatus();
 assert.match(context.__elements.get('company-discovery-status').textContent,/6 checked companies/,'partial status must count the checked list instead of the last restored batch');
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')));
 assert.equal(restored.candidates.length,6);assert.equal(restored.candidates[5].qualification.score,44);
 context.__setDiscovery(state);
 context.__renderCandidates();
 const html=context.__elements.get('company-candidates').innerHTML;
 assert.equal((html.match(/<h4>/g)||[]).length,5,'the requested amount caps the visible ranked list while retaining other research');
 assert.match(html,/Manual review/);assert.match(html,/80\+ company score/);
 context.__renderPotentialMatches();assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/<strong>44<\/strong>/,'completed overflow remains available behind the disclosure');
});
test('saved checked low-score research returns to the ranked list without another provider call',()=>{
 let calls=0;const context=loadDiscoveryRunner({fetchImpl:()=>{calls++;throw new Error('No new research authorized by reopening');}});
 const main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
 const profile={...main.profile,...Targeting.profileFields(main),exclusions:main.answers.exclusions};
 const at=new Date().toISOString(),quote='North Steel manufactures equipment in Latvia and purchases industrial automation from specialist partners for use in its factory production lines.';
 const raw={company:'North Steel',domain:'northsteel.lv',market:'Latvia',evidence:[{url:'https://northsteel.lv/products',text:quote,verifiedAt:at},{url:'https://journal.lv/northsteel',text:'North Steel operates manufacturing facilities in Latvia and produces industrial equipment for international business customers.'}]};
 const [candidate]=Discovery.parseBuyerFit(JSON.stringify({companies:[{domain:raw.domain,fit:65,offerId:'offer-0',reason:'Production needs purchased equipment.',buyerRole:'manufacturer',evidence:[{sourceId:'source-0',quote}]}]}),[raw],profile);
 context.__setDiscovery({lastRunAt:at,potentialMatches:[{...candidate,qualificationGaps:['Buyer fit below the mandatory 50/70 minimum']}]});
 context.__syncStrategyFingerprint();
 assert.equal(context.__discoveryState().candidates.length,1);
 assert.equal(context.__discoveryState().candidates[0].qualification.score,65);
 assert.equal(context.__discoveryState().potentialMatches.length,0);assert.equal(calls,0);
 const saved=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')));
 assert.equal(saved.candidates[0].qualification.automaticEligible,false);
 context.__setDiscovery({lastRunAt:at,potentialMatches:[{...candidate,evidence:candidate.evidence.map(e=>({...e,verifiedAt:''})),qualificationGaps:['Refresh company verification']}]});
 context.__syncStrategyFingerprint();assert.equal(context.__discoveryState().candidates.length,0);
 const full=Array.from({length:50},(_,i)=>({...saved.candidates[0],company:`Retained ${i}`,domain:`retained${i}.lv`}));
 context.__setDiscovery({lastRunAt:at,candidates:full,potentialMatches:[{...candidate,qualificationGaps:['Buyer fit below the old minimum']}]});
 context.localStorage.setItem('leadintel_customer_v2_discovery',JSON.stringify(context.__discoveryState()));
 context.__syncStrategyFingerprint();
 assert.equal(context.__discoveryState().candidates.length,50);
 assert.equal(context.__discoveryState().potentialMatches[0]?.domain,candidate.domain,'checked overflow must remain in review rather than disappear at the shortlist cap');
 const overflow=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')||JSON.stringify(context.__discoveryState())));
 assert.ok(overflow.potentialMatches.some(c=>c.domain===candidate.domain));
});

test('zero-result search clearly retains selected companies for Buyers without claiming a new match',()=>{
 const context=loadDiscoveryRunner({renderNodes:true});
 context.__setDiscovery({status:'no_results',latestRunCandidateCount:0,funnel:{qualifiedCompanies:4},candidates:[],selectedProspects:[{company:'Saved Buyer',domain:'saved.example',website:'https://saved.example',buyerSearchMode:'user_selected_target'}],lastRunAt:'2026-10-13T00:00:00Z'});
 context.__renderCandidates();
 assert.match(context.__elements.get('company-candidates').innerHTML,/1 previously selected company remains available in Buyers/);
 assert.doesNotMatch(context.__elements.get('company-candidates').innerHTML,/found 4 new companies/);
 assert.equal(context.__discoveryState().selectedProspects.length,1);
});

test('finished shortfall does not promise a background search that is no longer active',()=>{
 const context=loadDiscoveryRunner({renderNodes:true});
 context.__setDiscovery({status:'partial',latestRunCandidateCount:1,candidates:[{company:'Buyer',domain:'buyer.example',website:'https://buyer.example',evidence:[],matchedSignals:[],fitReasons:[],buyerFit:{}}],lastRunAt:'2026-10-13T00:00:00Z'});
 context.LeadIntelDiscovery={...context.LeadIntelDiscovery,rankQualifiedCompanies:items=>items,companyQualificationPresentation:()=>({routeLabel:'Test',referenceScore:null,explanation:'Test'})};
 vm.runInNewContext('qualificationAssessment=()=>({eligible:true,score:80});discovery.candidates=[{company:"Buyer",domain:"buyer.example",website:"https://buyer.example",evidence:[],matchedSignals:[],fitReasons:[],buyerFit:{}}];',context);
 context.__renderCandidates();
 const html=context.__elements.get('company-candidates').innerHTML;
 assert.match(html,/This search has finished/);assert.doesNotMatch(html,/will continue broadening the search automatically/);
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({autonomousDiscovery:{active:true}}));
 context.__renderCandidates();
 assert.match(context.__elements.get('company-candidates').innerHTML,/is broadening the search automatically/);
});
test('campaign discovery discards async work when the account changes before evidence returns',async()=>{const b={session:{authenticated:true,user:{id:'u1'}},workspace:{id:'w1'}};let context,changed=false;context=loadDiscoveryRunner({requestTimeout:40,scaleProductionRunTimeout:1000,bridgeImpl:b,fetchImpl:async()=>{if(!changed){changed=true;b.workspace.id='w2';context.localStorage.setItem('leadintel_customer_v2_discovery',JSON.stringify({sentinel:'new-workspace'}));}return {ok:true,json:async()=>({success:true,data:[]})};}});await context.__runDiscovery({campaignPlan:{targetCount:1,researchDepth:'quick'},savingMode:true});assert.equal(changed,true);assert.equal(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')).sentinel,'new-workspace');});

test('purchasing-fit retry reuses saved evidence and retains the existing shortlist and Buyers selection',async()=>{
 const researchedAt=new Date().toISOString(),calls=[];
 const evidence=[{url:'https://northstar.com/about',verifiedAt:researchedAt,text:'Northstar manufactures industrial equipment in Latvia and uses industrial automation for its own manufacturing and production assembly operations.'},{url:'https://journal.example/northstar',text:'Northstar manufactures industrial equipment in Latvia for local and international business customers.'}];
 const ctx=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async(url,options)=>{
  calls.push(url);assert.match(url,/api\/ai\/generate/);assert.equal(JSON.parse(options.body).fallback_provider,'gemini');return {ok:true,json:async()=>({text:JSON.stringify({companies:[{domain:'northstar.com',fit:90,purchase:'industrial automation',reason:'Manufacturing assembly uses automation equipment.',buyerRole:'industrial manufacturer',evidence:[{url:evidence[0].url,quote:evidence[0].text}]}]})})};
 }});
 ctx.__setDiscovery({lastRunAt:researchedAt,status:'partial',potentialMatches:[{company:'Northstar',domain:'northstar.com',market:'Latvia',evidence,qualificationGaps:['Purchasing application unverified']}],selectedProspects:[{company:'Kept',domain:'kept.example',buyerSearchMode:'user_selected_target'}],searchFailures:[{phase:'buyer-fit',domain:'northstar.com',company:'Northstar',reason:'timeout',status:408}]});
 await ctx.__retryFailedDiscoveryChecks();
 const state=ctx.__discoveryState();assert.equal(calls.length,1);assert.equal(state.candidates.find(c=>c.domain==='northstar.com')?.qualification.eligible,true);assert.equal(state.searchFailures.length,0);assert.equal(state.selectedProspects[0].domain,'kept.example');
});
test('purchasing-fit retry reserves time for every bounded batch and single-company recovery',async()=>{
 const at=new Date().toISOString(),timers=[];
 const ctx=loadDiscoveryRunner({scaleProductionRunTimeout:0,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async()=>({ok:true,json:async()=>({text:'{"companies":[]}'})})});
 ctx.setTimeout=(fn,ms)=>{timers.push(ms);return setTimeout(fn,ms);};
 const companies=Array.from({length:10},(_,i)=>({company:`Company ${i}`,domain:`company${i}.com`,market:'Latvia',qualificationGaps:['Purchasing application unverified'],evidence:[{url:`https://company${i}.com/about`,verifiedAt:at,text:'We manufacture industrial equipment in Latvia using industrial automation.'}]}));
 ctx.__setDiscovery({status:'partial',lastRunAt:at,potentialMatches:companies,searchFailures:companies.map(c=>({phase:'buyer-fit',domain:c.domain,reason:'timeout'}))});
 await ctx.__retryFailedDiscoveryChecks();
 assert.ok(Math.max(...timers)>=3*3*47000,`three concurrency waves need one batch request plus two single-company recoveries each: ${JSON.stringify(timers)}`);
 assert.ok(timers.includes(47000)&&!timers.includes(40000),'each request permits the server primary and fallback envelope');
});
test('purchasing-fit recovery cannot apply an old workspace result after an account switch',async()=>{
 const bridge={session:{authenticated:true},workspace:{id:'old'}},at=new Date().toISOString();
 const ctx=loadDiscoveryRunner({renderNodes:true,bridgeImpl:bridge,fetchImpl:async()=>{bridge.workspace.id='new';return {ok:true,json:async()=>({text:'{"companies":[]}'})};}});
 ctx.__setDiscovery({status:'partial',lastRunAt:at,potentialMatches:[{company:'Northstar',domain:'northstar.com',market:'Latvia',evidence:[{url:'https://northstar.com/about',verifiedAt:at,text:'Northstar manufactures industrial equipment in Latvia with industrial automation.'}],qualificationGaps:['Purchasing application unverified']}],searchFailures:[{phase:'buyer-fit',domain:'northstar.com',reason:'timeout'}]});
 assert.equal(await ctx.__retryFailedDiscoveryChecks(),false);assert.equal(ctx.__discoveryState().candidates.length,0);assert.notEqual(ctx.__discoveryState().status,'running');
});


test('company feedback change handler saves a reversible preference without removing research or altering scores',()=>{
 const {JSDOM}=require('jsdom'),context=loadDiscoveryRunner({renderNodes:true});
 const candidate={company:'North Steel',domain:'northsteel.lv',market:'Latvia',buyerSearchMode:'user_selected_target',qualificationGaps:['Check evidence'],evidence:[{url:'https://northsteel.lv/',text:'North Steel operates manufacturing facilities in Latvia.'}],score:{total:68}};
 context.__setDiscovery({potentialMatches:[candidate]});
 context.__bindDiscovery();
 const html=context.__companySearchFeedbackHtml(candidate),document=new JSDOM(html).window.document;
 const select=document.querySelector('[data-company-search-feedback]');assert.ok(select,'feedback is a labeled control in the company card');
 select.value='competitor';context.__elements.get('discovery-potential-matches').listeners.change({target:select});
 const saved=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery'));
 assert.equal(saved.searchFeedback[0].decision,'competitor');assert.equal(saved.potentialMatches.length,1);
 context.__setDiscovery(saved);assert.equal(context.__discoveryState().searchFeedback[0].decision,'competitor');
 select.value='clear';context.__elements.get('discovery-potential-matches').listeners.change({target:select});
 assert.equal(context.__discoveryState().searchFeedback.length,0);assert.equal(context.__discoveryState().potentialMatches.length,1);
});

test('the real search runner prioritizes names from buyer evidence before paid domain resolution',async()=>{
 const resolutions=[];
 const evidence='Steel Vendor supplies metal fabrication services. Insurance One operates regional sales teams and improves sales conversion.';
 const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:0,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body||'{}');
  if(body.task==='buyer-fit')return {ok:true,json:async()=>({text:weakBuyerFitResponse(body.prompt)})};
  const query=body.query||'';
  if(query.startsWith('"')){const name=query.split('"')[1];resolutions.push(name);return {ok:true,json:async()=>({data:[{url:`https://${name==='Insurance One'?'insuranceone':'steelvendor'}.lv/`,title:name+' official website',description:evidence}]})};}
  if(query.startsWith('site:'))return {ok:true,json:async()=>({data:[]})};
  if(String(url).includes('firecrawl-scrape'))return {ok:true,json:async()=>({data:{markdown:evidence,metadata:{sourceURL:body.url}}})};
  return {ok:true,json:async()=>({data:[{url:'https://journal.lv/company-updates',title:'Company updates',description:evidence,markdown:evidence}]})};
 }});
 const main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
 main.profile.idealCustomer='Insurance companies with regional sales teams';main.profile.customerPainPoints='sales conversion';
 main.answers.ideal_customer=main.profile.idealCustomer;main.targetingConfirmation=Targeting.confirm(main);main.market.strategyApproval=StrategyIntegrity.approval(main);
 context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
 await context.__runDiscovery({autoPass:3});
 assert.equal(resolutions[0],'Insurance One');
});

test('an interrupted purchasing-fit wave retains every official evidence record for retry after reload',async()=>{
 const context=loadDiscoveryRunner({requestTimeout:10,fetchImpl:async()=>({ok:true,json:async()=>({data:[]})})});
 const at=new Date().toISOString(),rows=['Completed Buyer','Pending Buyer'].map((company,i)=>({company,domain:`buyer${i}.lv`,market:'Latvia',evidence:[{url:`https://buyer${i}.lv/about`,verifiedAt:at,text:`${company} operates equipment production facilities in Latvia and integrates industrial automation supplied by specialist partners.`}]}));
 context.LeadIntelDiscovery={...Discovery,mergeCompanyCandidates:()=>rows,buildPotentialCompanyCandidates:()=>[],researchBuyerFit:async(pool,profile,generate,{signal,onProgress})=>{
   onProgress({completed:1,total:2,candidates:[{...pool[0],buyerFitIssue:'Purchasing application requires review'}]});
   await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));throw signal.reason;
 }};
 await context.__runDiscovery({autoPass:3});
 const saved=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery'));
 const restored=Discovery.recoverInterruptedDiscoveryState(saved);
 assert.notEqual(restored.status,'running');
 assert.deepEqual(restored.potentialMatches.map(c=>c.domain).sort(),['buyer0.lv','buyer1.lv']);
 assert.equal(restored.potentialMatches[0].evidence[0].text,rows[0].evidence[0].text);
 assert.match(restored.potentialMatches[0].buyerFitIssue,/requires review/);
 assert.equal(restored.candidates.length,0,'pending evidence must not claim qualification');
});

test('one failed purchasing assessment does not block healthy adaptive discovery',async()=>{
 const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:0,fetchImpl:async()=>({ok:true,json:async()=>({data:[]})})});
 const candidate={company:'North Steel',domain:'northsteel.lv',market:'Latvia',evidence:[{url:'https://northsteel.lv/',text:'North Steel operates an industrial equipment manufacturing business in Latvia.'}]};
 let fail=true;
 context.LeadIntelDiscovery={...Discovery,mergeCompanyCandidates:()=>[candidate],buildPotentialCompanyCandidates:()=>[],researchBuyerFit:async(pool,profile,generate,options)=>{if(fail){fail=false;options.onFailure(new Error('Provider timeout'),pool);}return pool.map(c=>({...c,buyerFitIssue:'Purchasing fit request timed out'}));}};
 await context.__runDiscovery({autoPass:3});
 assert.ok(context.__discoveryState().funnel.adaptiveFollowUpSearches>0,'an incomplete sibling is a gap, not a global research veto');
 assert.ok(context.__discoveryState().searchFailures.some(x=>x.phase==='buyer-fit'));
});


test('discovery reuses deferred extracted names before paying for another market search',async()=>{
 const actions=[],names=['First Buyer','Second Buyer','Third Buyer','Fourth Buyer'];
 const text=names.map(name=>name+' operates an insurance business in Latvia.').join(' ');
 const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:0,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body||'{}'),query=body.query||'';
  if(String(url).includes('firecrawl-scrape'))return {ok:true,json:async()=>({data:{markdown:text,metadata:{sourceURL:body.url}}})};
  if(query.startsWith('"')){const name=query.split('"')[1];if(!query.includes('-site:'))actions.push('resolve:'+name);return {ok:true,json:async()=>({data:[{url:'https://'+name.toLowerCase().replace(/ /g,'')+'.lv/',title:name,description:text}]})};}
  if(query.startsWith('site:'))return {ok:true,json:async()=>({data:[]})};
  actions.push('market');return {ok:true,json:async()=>({data:[{url:'https://journal.lv/buyers',title:'Insurance buyers',description:text,markdown:text}]})};
 }});
 context.LeadIntelDiscovery={...Discovery,mergeCompanyCandidates:()=>[],buildPotentialCompanyCandidates:()=>[]};
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({targetCount:1,targetMode:'custom'}));
 await context.__runDiscovery({autoPass:3});
 const fourth=actions.indexOf('resolve:Fourth Buyer');assert.ok(fourth>0,'the retained fourth name is eventually researched');
 assert.equal(actions.slice(0,fourth).filter(x=>x==='market').length,6,'no extra market queries before the deferred name');
 assert.equal(actions.filter(x=>x==='resolve:First Buyer').length,1,'earlier identities are not resolved again');
});


test('search preferences remain manageable and reversible after clearing the result list',()=>{
 const {JSDOM}=require('jsdom'),context=loadDiscoveryRunner({renderNodes:true});context.document.body.classList={remove(){}};
 const candidate={company:'Rejected Buyer',domain:'rejected.lv',qualificationGaps:['Needs more evidence'],evidence:[{url:'https://rejected.lv/',text:'Rejected Buyer operates an insurance business in Latvia.'}]};
 context.__setDiscovery({potentialMatches:[candidate]});
 const select=new JSDOM(context.__companySearchFeedbackHtml(candidate)).window.document.querySelector('select');
 select.value='poor_fit';assert.equal(context.__updateCompanySearchFeedback(select),true);
 assert.equal(context.__clearCompanySearchResults(),true);
 assert.equal(context.__discoveryState().searchFeedback.length,1,'clearing search results does not erase learned preferences');
 context.__renderSearchPreferences();
 const node=context.__elements.get('company-search-preferences');assert.match(node.innerHTML,/Rejected Buyer/);
 const clear=new JSDOM(node.innerHTML).window.document.querySelector('select');clear.value='clear';
 assert.equal(context.__updateCompanySearchFeedback(clear),true,'undo works without a current company card');
 assert.equal(context.__discoveryState().searchFeedback.length,0);
});

test('changing the seller offer while discovery is in flight discards stale results',async()=>{
 let release,started;const began=new Promise(resolve=>{started=resolve;}),pending=new Promise(resolve=>{release=resolve;});
 const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:0,fetchImpl:async()=>{started();await pending;return {ok:true,json:async()=>({data:[]})};}});
 const running=context.__runDiscovery({autoPass:3});await began;
 const main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));main.profile.priorityOffers='Office furniture';main.answers.priority_offers='Office furniture';main.targetingConfirmation=Targeting.confirm(main);context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));release();
 assert.equal(await running,false,'an obsolete purchasing context cannot publish results');
 assert.notEqual(context.__discoveryState().status,'running','the same workspace can retry under its new offer');
 assert.equal(context.__discoveryState().lastRunAt,'');
});

test('a confirmed operational buyer profile without buying signals retains evidence and blocks new Strategy research',async()=>{
 let calls=0;const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:0,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({data:[]})};}});
 const main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));main.market.signals=[];main.referenceCustomers={rows:[]};main.targetCompanies=[];context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
 const before=JSON.stringify(context.__discoveryState());assert.equal(await context.__runDiscovery({autoPass:3}),false);assert.equal(calls,0);assert.equal(JSON.stringify(context.__discoveryState()),before);
});

function companyShortlistDisplayFixture({amount=5,scores=[55,94,44,79,90,68,82],review=true}={}){
 const {JSDOM}=require('jsdom');let providerCalls=0;
 const context=loadDiscoveryRunner({renderNodes:true,fetchImpl:async()=>{providerCalls++;throw new Error('Displaying retained companies must not spend research credits');}});
 const main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
 const profile={...main.profile,...Targeting.profileFields(main),exclusions:main.answers.exclusions};
 const at=new Date().toISOString();
 const candidates=scores.map((fit,index)=>{
  const domain=`ranked${index}.lv`,company=`Ranked${index}`;
  const quote=`${company} manufactures industrial equipment in Latvia and purchases industrial automation from specialist partners for use in its production assembly lines.`;
  const evidence=[{url:`https://${domain}/products`,verifiedAt:at,text:quote},{url:`https://journal.lv/ranked${index}`,text:`${company} operates manufacturing facilities in Latvia and supplies industrial equipment to business customers.`}];
  const candidate=Discovery.parseBuyerFit(JSON.stringify({companies:[{domain,fit,offerId:'offer-0',reason:'Production uses purchased automation equipment.',buyerRole:'industrial manufacturer',evidence:[{sourceId:'source-0',quote}]}]}),[{company,domain,website:`https://${domain}/`,market:'Latvia',evidence}],profile)[0];
  const qualification=Discovery.assessCompanyQualification(candidate,profile,main.market,{researchedAt:at});assert.equal(qualification.eligible,true,JSON.stringify(qualification));
  return {...candidate,qualified:true,marketVerified:true,buyerVerified:true,qualification};
 });
 context.__setDiscovery({status:'complete',lastRunAt:at,candidates,potentialMatches:review?[{company:'Unfinished Research',domain:'unfinished.lv',website:'https://unfinished.lv/',market:'Latvia',evidence:[{url:'https://unfinished.lv/about',text:'Unfinished Research operates a company in Latvia.'}],qualificationGaps:['Purchasing fit unverified']}]:[]});
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({targetCount:amount}));
 const dom=new JSDOM(`<section id="company-candidates"></section><section id="discovery-potential-matches"></section><select id="discovery-target-count"><option value="5">5</option><option value="10">10</option><option value="custom">Custom</option></select>`);
 context.document.body=dom.window.document.body;
 for(const node of dom.window.document.querySelectorAll('[id]'))context.__elements.set(node.id,node);
 const control=dom.window.document.getElementById('discovery-target-count');control.value=String(amount);
 const render=()=>{context.__renderCandidates();context.__renderPotentialMatches();};
 return {context,dom,candidates,control,render,providerCalls:()=>providerCalls};
}
test('five requested companies show the highest five scores while all other research is collapsed and retained',()=>{
 const {context,dom,render,providerCalls}=companyShortlistDisplayFixture();
 const before=JSON.stringify(context.__discoveryState());render();
 const primary=dom.window.document.getElementById('company-candidates'),others=dom.window.document.getElementById('discovery-potential-matches');
 assert.deepEqual([...primary.querySelectorAll('.company-total strong')].map(n=>Number(n.textContent)),[94,90,82,79,68]);
 assert.equal(primary.querySelectorAll('[data-action="select-qualified-buyers"]:not([disabled])').length,5);
 const disclosure=others.querySelector('details.company-other-results');assert.ok(disclosure,'additional checked companies must remain accessible');
 assert.equal(disclosure.open,false);assert.match(disclosure.querySelector('summary').textContent,/Show other companies.*3/);
 assert.deepEqual([...others.querySelectorAll('.company-total strong')].map(n=>Number(n.textContent)),[55,44]);
 assert.match(others.textContent,/Unfinished Research/);assert.equal(others.querySelector('[data-review-action="buyers"]').textContent,'Move to Buyers');
 disclosure.querySelector('summary').click();assert.equal(disclosure.open,true);render();
 assert.equal(others.querySelector('details.company-other-results').open,true,'rerendering must not close an opened disclosure');
 others.querySelector('details.company-other-results > summary').click();assert.equal(others.querySelector('details.company-other-results').open,false);
 assert.equal(JSON.stringify(context.__discoveryState()),before,'hiding and showing results must preserve all evidence, scores and selections');assert.equal(providerCalls(),0);
 const saved=Discovery.normalizeDiscoveryState(JSON.parse(before));context.__setDiscovery(saved);render();
 assert.equal(primary.querySelectorAll('.company-card').length,5);assert.equal(others.querySelectorAll('.company-card').length,2);
});
test('changing the requested amount repartitions saved companies immediately without a new search',()=>{
 const {context,dom,control,render,providerCalls}=companyShortlistDisplayFixture({scores:[94,90,86,82,79,75,68,64,60,55,49,44],review:false});render();context.__bindDiscovery();
 control.value='10';control.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.equal(dom.window.document.querySelectorAll('#company-candidates .company-card').length,10);
 assert.equal(dom.window.document.querySelectorAll('#discovery-potential-matches .company-card').length,2);
 assert.equal(context.__discoveryState().candidates.length,12);assert.equal(providerCalls(),0);
});
test('an additional checked company retains its original index when selected for Buyers',async()=>{
 const {context,dom,render,candidates,providerCalls}=companyShortlistDisplayFixture();render();context.__bindDiscovery();
 const disclosure=dom.window.document.querySelector('details.company-other-results');assert.ok(disclosure);disclosure.querySelector('summary').click();
 const button=disclosure.querySelector('[data-action="select-qualified-buyers"]');assert.ok(button);
 assert.equal(button.dataset.companyIndex,'0','the sixth ranked company is the first stored company');button.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(context.__discoveryState().selectedProspects.length,1);assert.equal(context.__discoveryState().selectedProspects[0].domain,candidates[0].domain);
 const persisted=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')));
 assert.equal(persisted.selectedProspects[0].domain,candidates[0].domain);assert.equal(persisted.candidates.length,7);assert.equal(providerCalls(),0);
});
test('Research review starts collapsed even when no company has completed the checks',()=>{
 const {dom,render}=companyShortlistDisplayFixture({scores:[]});render();
 const disclosure=dom.window.document.querySelector('#discovery-potential-matches details');assert.ok(disclosure);assert.equal(disclosure.open,false);
 assert.equal(dom.window.document.querySelectorAll('#company-candidates .company-card').length,0);assert.match(disclosure.textContent,/Unfinished Research/);
});
test('a shortfall shows only completed companies and hides an empty additional-results control',()=>{
 const {dom,render}=companyShortlistDisplayFixture({scores:[94,79,55],review:false});render();
 assert.equal(dom.window.document.querySelectorAll('#company-candidates .company-card').length,3);assert.match(dom.window.document.getElementById('company-candidates').textContent,/3 of 5 checked companies available/);
 assert.equal(dom.window.document.getElementById('discovery-potential-matches').hidden,true);
});
test('additional results deduplicate checked identities and retain companies awaiting recheck',()=>{
 const {context,dom,render}=companyShortlistDisplayFixture();const state=context.__discoveryState();
 const pending={...state.candidates[2],needsRecheck:true};
 context.__setDiscovery({...state,candidates:state.candidates.map((row,i)=>i===2?pending:row),potentialMatches:[...state.potentialMatches,{...state.candidates[1],qualificationGaps:['Earlier incomplete check']}]});render();
 const primary=dom.window.document.getElementById('company-candidates'),others=dom.window.document.getElementById('discovery-potential-matches');
 assert.equal(primary.querySelectorAll('.company-card').length,5);assert.equal(others.querySelectorAll('.company-card').length,1);
 const pendingRow=[...others.querySelectorAll('.research-check-row')].find(n=>n.textContent.includes(pending.company));assert.ok(pendingRow,'retained stale evidence must remain available for recheck');
 assert.match(pendingRow.textContent,/recheck/i);assert.equal(others.querySelectorAll('.research-check-row').length,2,'an already checked company must not appear a second time in review');
 assert.equal(context.__discoveryState().candidates.length,7);
});
test('Remove and Clear review work for retained recheck rows while preserving checked cards and Buyers',()=>{
 const {context,dom,render,providerCalls}=companyShortlistDisplayFixture();const state=context.__discoveryState();
 context.__setDiscovery({...state,candidates:state.candidates.map((row,i)=>i===2?{...row,needsRecheck:true}:row),selectedProspects:[{company:'Saved',domain:'saved.lv',buyerSearchMode:'user_selected_target'}]});render();context.__bindDiscovery();
 let disclosure=dom.window.document.querySelector('details.company-other-results');disclosure.querySelector('summary').click();
 const remove=disclosure.querySelector('[data-review-action="remove"][data-review-key="ranked2.lv"]');assert.ok(remove);remove.click();
 assert.equal(context.__discoveryState().candidates.length,6,'Remove must remove the stale review row from current research');
 assert.ok(!context.__discoveryState().candidates.some(c=>c.domain==='ranked2.lv'));
 const retained=context.__discoveryState();context.__setDiscovery({...retained,candidates:retained.candidates.map((row,i)=>i===0?{...row,needsRecheck:true}:row)});render();
 disclosure=dom.window.document.querySelector('details.company-other-results');if(!disclosure.open)disclosure.querySelector('summary').click();disclosure.querySelector('[data-review-action="clear"]').click();
 assert.equal(context.__discoveryState().candidates.length,5);assert.equal(context.__discoveryState().potentialMatches.length,0);assert.equal(context.__discoveryState().selectedProspects[0].domain,'saved.lv');assert.equal(providerCalls(),0);
});
async function runCheckedOverflowResearch({campaign=false,compareReferences=false}={}){
 const {candidates}=companyShortlistDisplayFixture({scores:Array.from({length:12},(_,i)=>95-i),review:false});const similarityRequests=[];
 const context=loadDiscoveryRunner({requestTimeout:1000,scaleProductionRunTimeout:1000,bridgeImpl:{session:{authenticated:false},workspace:{id:'workspace'}},fetchImpl:async(_url,options)=>{
  const body=JSON.parse(options.body);
  if(body.task==='buyer-fit')return {ok:true,json:async()=>({text:weakBuyerFitResponse(body.prompt)})};
  return {ok:true,json:async()=>({data:[]})};
 }});
 const Lookalike=require('../lookalike-discovery.js');
 context.LeadIntelDiscovery={...Discovery,mergeCompanyCandidates:()=>candidates,buildPotentialCompanyCandidates:()=>[],researchEvidenceSimilarity:args=>Lookalike.researchEvidenceSimilarity({...args,fetchImpl:async(_url,options)=>{similarityRequests.push(JSON.parse(options.body));return {ok:true,json:async()=>({text:JSON.stringify({matches:[]})})};}})};
 if(compareReferences)context.LeadIntelReferenceCustomers={getActiveReferenceModel:()=>({active:true,dna:{referenceProfiles:[{rowId:'reference',companyName:'Reference',dimensions:[{key:'industry',values:['industrial equipment']}]}]}})};
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({targetCount:5}));const plan=campaign?{targetCount:5}:null;
 await context.__runDiscovery({autoPass:3,...(plan?{campaignPlan:plan}:{})});
 return {context,plan,similarityRequests};
}
test('retained company overflow cannot expand a campaign beyond its requested company count',async()=>{
 const {context,plan}=await runCheckedOverflowResearch({campaign:true});
 assert.equal(context.__discoveryState().candidates.length,12,'all completed checks remain available manually');
 assert.equal(plan.results.length,5,'campaign CRM handoff is limited to the requested five companies');
 assert.deepEqual(Array.from(plan.results,c=>c.domain),Array.from(context.__discoveryState().candidates.slice(0,5),c=>c.domain));
});
test('retaining checked overflow does not add paid reference-similarity comparison batches',async()=>{
 const {context,similarityRequests}=await runCheckedOverflowResearch({compareReferences:true});
 assert.equal(context.__discoveryState().candidates.length,12);
 assert.equal(similarityRequests.length,1,'five requested checked candidates use one existing eight-company AI batch');
 assert.equal(JSON.parse(similarityRequests[0].prompt.split('. Prospects: ')[1]).length,5);
});

function pendingCompanyBatchFixture({count=12,amount=5,successful=false,waitFor=null,bridgeImpl=null,onFetch=null,providerStatus=null}={}){
 const calls=[];const at=new Date().toISOString();
 const evidenceFor=(i,independent=false)=>({url:independent?`https://industry.lv/pending${i}`:`https://pending${i}.lv/products`,title:`Pending${i} industrial equipment`,verifiedAt:independent?'':at,text:`Pending${i} manufactures industrial equipment in Latvia and purchases industrial automation from specialist partners for use in its production and assembly facilities. Its engineering team designs and manufactures machines for business customers.`});
 const context=loadDiscoveryRunner({renderNodes:true,requestTimeout:1000,scaleProductionRunTimeout:100,bridgeImpl,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});onFetch?.(context,url,body);if(waitFor)await waitFor;
  if(providerStatus)return {ok:false,status:providerStatus,json:async()=>({error:'Provider unavailable'})};
  if(!successful)return {ok:true,json:async()=>({data:[]})};
  if(body.task==='buyer-fit'){
   const rows=JSON.parse(body.prompt.split('. Companies: ')[1]);
   return {ok:true,json:async()=>({text:JSON.stringify({companies:rows.map(row=>({domain:row.domain,fit:[65,95,78,84,53][Number(row.domain.match(/pending(\d+)/)?.[1]||0)%5],offerId:'offer-0',reason:'Production uses purchased industrial automation.',buyerRole:'industrial manufacturer',evidence:[{sourceId:'source-0',quote:row.evidence[0].text}]}))})})};
  }
  const i=Number(String(body.query||body.url||'').match(/pending(\d+)/i)?.[1]||0),independent=String(body.query||'').includes('-site:');
  const evidence=evidenceFor(i,independent);
  return {ok:true,json:async()=>body.url?({data:{markdown:evidence.text,metadata:{sourceURL:body.url}}}):({data:[{...evidence,description:evidence.text}]})};
 }});
 const rows=Array.from({length:count},(_,i)=>({company:`Pending${i}`,domain:`pending${i}.lv`,website:`https://pending${i}.lv/`,market:'Latvia',evidence:[evidenceFor(i),evidenceFor(i,true)],qualificationGaps:['Purchasing-fit assessment incomplete']}));
 context.__setDiscovery({status:'partial',lastRunAt:at,potentialMatches:rows,selectedProspects:[{company:'Saved Buyer',domain:'savedbuyer.lv',buyerSearchMode:'user_selected_target',people:[{name:'Saved Person'}]}]});
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({targetCount:amount}));
 const {JSDOM}=require('jsdom'),dom=new JSDOM(`<section id="company-review-batch"></section><section id="company-candidates"></section><section id="discovery-potential-matches"></section><select id="discovery-target-count"><option value="5">5</option><option value="10">10</option><option value="custom">Custom</option></select>`);
 context.document.body=dom.window.document.body;
 for(const node of dom.window.document.querySelectorAll('[id]'))context.__elements.set(node.id,node);
 dom.window.document.getElementById('discovery-target-count').value=[5,10].includes(amount)?String(amount):'custom';
 if(![5,10].includes(amount)){context.document.getElementById('discovery-target-custom').value=String(amount);}
 const render=()=>{assert.equal(typeof context.renderCompanyReviewBatch,'function');context.renderCompanyReviewBatch();};
 const review=options=>{assert.equal(typeof context.reviewNextCompanyBatch,'function');return context.reviewNextCompanyBatch(options);};
 const plan=()=>{assert.equal(typeof context.companyReviewBatchPlan,'function');return context.companyReviewBatchPlan();};
 return {context,dom,calls,rows,render,review,plan};
}
test('the visible batch-review control explains the pending count and selected batch size',()=>{
 const {context,dom,render,calls}=pendingCompanyBatchFixture();render();
 const panel=dom.window.document.getElementById('company-review-batch');assert.equal(panel.hidden,false);assert.match(panel.textContent,/12 companies.*review/i);
 assert.equal(panel.querySelector('button').textContent,'Review next 5 companies');assert.equal(panel.querySelector('button').disabled,false);assert.equal(calls.length,0);
 context.document.getElementById('discovery-target-count').value='10';render();assert.equal(panel.querySelector('button').textContent,'Review next 10 companies');
});
test('a normal company search with pending companies and no previous review batch can render and start providers',async()=>{
 const {context,calls,render,dom}=pendingCompanyBatchFixture();
 context.__setDiscovery({...context.__discoveryState(),status:'running'});
 assert.doesNotThrow(render);
 assert.equal(dom.window.document.querySelector('#company-review-batch button').disabled,true);
 context.__setDiscovery({...context.__discoveryState(),status:'partial'});
 await context.__runDiscovery();
 assert.ok(calls.some(call=>call.body.query),'ordinary discovery must reach its first provider query');
});
test('successive clicks rotate through incomplete companies and keep the queue after reload',async()=>{
 const {context,review,plan}=pendingCompanyBatchFixture();
 assert.deepEqual(Array.from(plan().domains),Array.from({length:5},(_,i)=>`pending${i}.lv`));await review();
 assert.deepEqual(Array.from(plan().domains),Array.from({length:5},(_,i)=>`pending${i+5}.lv`));
 const saved=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery'));context.__setDiscovery(Discovery.normalizeDiscoveryState(saved));
 await review();assert.deepEqual(Array.from(plan().domains),['pending10.lv','pending11.lv','pending0.lv','pending1.lv','pending2.lv']);
 assert.equal(context.__discoveryState().potentialMatches.length,12);assert.equal(context.__discoveryState().selectedProspects[0].people[0].name,'Saved Person');
});
test('reviewing a saved batch updates real scores, reranks the shortlist and preserves other research',async()=>{
 const {context,dom,calls,render,review}=pendingCompanyBatchFixture({successful:true});render();context.__bindDiscovery();
 await review();context.__renderCandidates();render();
 const state=context.__discoveryState();assert.equal(state.candidates.length,5);assert.deepEqual(Array.from(state.candidates,c=>c.qualification.score),[95,84,78,65,53]);assert.equal(state.potentialMatches.length,7);
 assert.deepEqual([...dom.window.document.querySelectorAll('#company-candidates .company-total strong')].map(n=>Number(n.textContent)),[95,84,78,65,53]);
 assert.equal(dom.window.document.querySelector('#company-review-batch button').textContent,'Review next 5 companies');
 assert.match(dom.window.document.getElementById('company-review-batch').textContent,/5.*finished/i);assert.equal(state.selectedProspects[0].domain,'savedbuyer.lv');
 const searched=new Set(calls.filter(c=>c.body.query).flatMap(c=>c.body.query.match(/pending\d+/gi)||[]).map(x=>x.toLowerCase()));assert.deepEqual([...searched].sort(),['pending0','pending1','pending2','pending3','pending4']);
 assert.ok(calls.every(c=>!c.body.query||/pending\d+/i.test(c.body.query)),'batch review must not open broad market discovery');
});
test('batch review prevents overlapping clicks and exposes a running state',async()=>{
 let release;const waitFor=new Promise(resolve=>release=resolve);const {context,dom,render,review}=pendingCompanyBatchFixture({count:3,waitFor});render();
 const running=review();render();assert.equal(context.__discoveryState().status,'running');assert.equal(dom.window.document.querySelector('#company-review-batch button').disabled,true);
 assert.equal(await review(),false);release();await running;render();assert.equal(dom.window.document.querySelector('#company-review-batch button').disabled,false);
});
test('a rejected profile gate does not advance the pending-review queue',async()=>{
 const {context,calls,review,plan}=pendingCompanyBatchFixture();const main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));delete main.targetingConfirmation;context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
 context.document.createElement=tag=>new (require('jsdom').JSDOM)().window.document.createElement(tag);
 const before=Array.from(plan().domains);assert.equal(await review(),false);assert.equal(calls.length,0);assert.deepEqual(Array.from(plan().domains),before);assert.equal(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta')).companyReviewQueue,undefined);
});

test('canceled batch reviews preserve work and resume unfinished companies first',async()=>{
 let release,actions;const waitFor=new Promise(resolve=>release=resolve);const {context,review,plan,dom}=pendingCompanyBatchFixture({waitFor});
 context.LeadIntelTaskCentre={start(){},registerActions(_id,value){actions=value;},update(){},get(){return {status:'canceled'};},fail(){},complete(){}};
 const running=review();assert.ok(actions);actions.cancel();release();await running;
 assert.deepEqual(Array.from(plan().domains),Array.from({length:5},(_,i)=>`pending${i}.lv`));assert.equal(context.__discoveryState().potentialMatches.length,12);
 assert.match(dom.window.document.getElementById('company-review-batch').textContent,/canceled.*0 finished; 5 still need evidence/i);
});
test('an interrupted reload resumes the unfinished reserved batch',async()=>{
 let release;const waitFor=new Promise(resolve=>release=resolve);const {context,review,plan,render,dom}=pendingCompanyBatchFixture({waitFor});
 const running=review(),interrupted=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta'));release();await running;
 context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify(interrupted));context.__setDiscovery({...context.__discoveryState(),status:'partial'});render();
 assert.deepEqual(Array.from(plan().domains),Array.from({length:5},(_,i)=>`pending${i}.lv`));assert.match(dom.window.document.getElementById('company-review-batch').textContent,/interrupted.*continue/i);
});
test('batch selection reaches retained companies beyond the existing thirty-company recheck cap',async()=>{
 const {context,review,plan,render,dom}=pendingCompanyBatchFixture({count:35,amount:50});render();
 assert.equal(plan().domains.length,30);assert.equal(dom.window.document.querySelector('button').textContent,'Review next 30 companies');await review();
 assert.deepEqual(Array.from(plan().domains).slice(0,5),Array.from({length:5},(_,i)=>`pending${i+30}.lv`));
 assert.deepEqual(Array.from(context.__existingCompanyResearchTargets(undefined,['pending34.lv']),c=>c.domain),['pending34.lv']);
});
test('a changed offer resets review ordering and cannot inherit another offer attempts',async()=>{
 const {context,review,plan}=pendingCompanyBatchFixture();await review();assert.equal(plan().domains[0],'pending5.lv');
 const main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));main.answers.priority_offers='factory maintenance';main.targetingConfirmation=Targeting.confirm(main);context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
 assert.equal(plan().domains[0],'pending0.lv');
});
test('workspace switches during review preserve the destination workspace state and metadata',async()=>{
 const bridge={workspace:{id:'workspace-a'},session:{authenticated:false,user:{id:'user-a'}}};let changed=false;
 const {context,review}=pendingCompanyBatchFixture({bridgeImpl:bridge,onFetch(ctx){if(changed)return;changed=true;bridge.workspace.id='workspace-b';ctx.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({sentinel:'workspace-b'}));ctx.localStorage.setItem('leadintel_customer_v2_discovery',JSON.stringify({sentinel:'workspace-b'}));}});
 assert.equal(await review(),false);assert.equal(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta')).sentinel,'workspace-b');assert.equal(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta')).companyReviewQueue,undefined);assert.equal(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')).sentinel,'workspace-b');
});
test('changing strategy while a batch starts cannot reserve attempts for the old strategy',async()=>{
 let changed=false;const {context,review}=pendingCompanyBatchFixture({onFetch(ctx){if(changed)return;changed=true;const main=JSON.parse(ctx.localStorage.getItem('leadintel_customer_v2_state'));main.market.signals=[{id:'new',name:'New projects',active:true,keywords:['project']}];ctx.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));}});
 assert.equal(await review(),false);assert.equal(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta')).companyReviewQueue,undefined);
});
test('removing review results during a batch cannot erase or reintroduce in-flight work',async()=>{
 let release;const waitFor=new Promise(resolve=>release=resolve);const {context,review}=pendingCompanyBatchFixture({waitFor});const running=review();
 assert.equal(context.removeResearchReviewCompany('pending0.lv'),false);assert.equal(context.clearResearchReview(),false);assert.equal(context.__discoveryState().potentialMatches.length,12);release();await running;
});

test('the batch button dispatches saved-company research and does not start on render',async()=>{
 let release;const waitFor=new Promise(resolve=>release=resolve);const {context,dom,calls,render}=pendingCompanyBatchFixture({waitFor});render();context.__bindDiscovery();assert.equal(calls.length,0);
 dom.window.document.querySelector('#company-review-batch button').click();assert.equal(context.__discoveryState().status,'running');assert.equal(dom.window.document.querySelector('#company-review-batch button').disabled,true);release();
 for(let i=0;i<100&&!JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta')).companyReviewQueue?.lastBatch?.finishedAt;i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.ok(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta')).companyReviewQueue.lastBatch.finishedAt);assert.equal(dom.window.document.querySelector('#company-review-batch button').disabled,false);
});
test('finishing the saved queue shows completion and clear results removes its history',async()=>{
 const {context,dom,review,plan,render}=pendingCompanyBatchFixture({count:5,successful:true});await review();render();assert.equal(plan().pendingCount,0);assert.equal(dom.window.document.querySelector('#company-review-batch button').disabled,true);assert.match(dom.window.document.getElementById('company-review-batch').textContent,/All saved companies reviewed/);
 assert.equal(await review(),false);context.__clearCompanySearchResults();render();assert.equal(dom.window.document.getElementById('company-review-batch').hidden,true);assert.equal(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta')).companyReviewQueue,undefined);
});
test('batch review excludes verified seller identities while retaining uncertain company scores',()=>{
 const {context,rows,plan}=pendingCompanyBatchFixture();context.__setDiscovery({...context.__discoveryState(),potentialMatches:[{...rows[0],company:'Acme',domain:'acme.example',website:'https://acme.example/'},...rows.slice(1)]});
 assert.equal(plan().pendingCount,11);assert.equal(plan().domains.includes('acme.example'),false);assert.equal(plan().domains[0],'pending1.lv');
});

test('the visible failed-check retry keeps the original saved batch instead of opening broad discovery',async()=>{
 const {context,review,calls}=pendingCompanyBatchFixture({count:7,providerStatus:402});await review();assert.ok(context.__discoveryState().searchFailures.some(f=>f.phase==='searching'));calls.length=0;
 await context.__retryFailedDiscoveryChecks();const meta=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery_meta'));
 assert.equal(meta.lastCompanyRun.scope,'recheck');assert.equal(meta.lastCompanyRun.requestedCount,5);assert.ok(calls.some(c=>c.body.query));
 assert.ok(calls.every(c=>!c.body.query||/pending[0-4]/i.test(c.body.query)),'retry must keep the same five saved company identities');
});
test('batch execution reviews untouched companies before older retries at queue wraparound',async()=>{
 const {context,review,plan,calls}=pendingCompanyBatchFixture();await review();await review();
 const expected=Array.from(plan().domains);assert.deepEqual(expected,['pending10.lv','pending11.lv','pending0.lv','pending1.lv','pending2.lv']);
 assert.deepEqual(Array.from(context.__existingCompanyResearchTargets(undefined,expected),c=>c.domain),expected);
 calls.length=0;await review();const initial=calls.filter(c=>c.body.query?.startsWith('"Pending')).slice(0,5).map(c=>`pending${c.body.query.match(/Pending(\d+)/)[1]}.lv`);assert.deepEqual(initial,expected);
});

test('manual public contact research confirms sourced work emails in CRM without paid providers',async()=>{
 const sourceUrl='https://example.com/team',calls=[];
 const bridgeImpl={session:{authenticated:true},workspace:{id:'w1'},listCrmCompanies:async()=>({ok:true,companies:[{id:'c1',normalized_domain:'example.com'}]}),saveCrmContacts:async()=>({ok:true}),saveCrmCompany:async()=>({ok:true})};
 const context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl,fetchImpl:async(url,options)=>{
  calls.push(String(url));
  if(String(url).includes('/confirm-public-email'))return {ok:true,json:async()=>({contact:{id:'confirmed-anna',name:'Anna Buyer',work_email:'anna.buyer@example.com',email_status:'public_confirmed',verification_provider:'Public source',public_email_url:sourceUrl,verified_at:new Date().toISOString()}})};
  if(String(url).includes('/contact-evidence-review'))return {ok:true,json:async()=>({status:'complete',conflicts:[]})};
  if(/firecrawl(?:-scrape|\/scrape)/.test(String(url)))return {ok:true,json:async()=>({data:{markdown:'Anna Buyer, Procurement Director, anna.buyer@example.com',metadata:{sourceURL:sourceUrl}}})};
  if(/firecrawl(?:-search|\/search)/.test(String(url)))return {ok:true,json:async()=>({data:[{url:sourceUrl,markdown:'Anna Buyer, Procurement Director, anna.buyer@example.com'}]})};
  return {ok:true,json:async()=>({data:[]})};
 }});
 context.LeadIntelCrm=require('../crm-engine.js');context.LeadIntelContactPolicy=require('../contact-confirmation-policy.js');context.__setBuyerConfirmationPolicy();
 context.__setCrmCompanies([{id:'c1',normalized_domain:'example.com'}]);
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:'Procurement Director',people:[{id:'anna',name:'Anna Buyer',title:'Procurement Director',organization:'Example',publicNameUrl:sourceUrl,linkedin_url:'https://linkedin.com/in/anna-buyer'}]}]});
 await context.__findPublicProspectContacts('example.com');
 const person=context.__discoveryState().selectedProspects[0].people[0];
 assert.equal(calls.filter(url=>url.includes('/confirm-public-email')).length,1,'public research must finish the free source confirmation');
 assert.equal(person.publicEmailSourceCheck.status,'confirmed');assert.equal(person.contactVerification.status,'public_confirmed');
 assert.equal(calls.some(url=>/hunter|enrich|additional-contact-services/.test(url)),false,'research never spends optional enrichment credits');
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery'))).selectedProspects[0].people[0];
 assert.equal(restored.publicEmailSourceCheck.status,'confirmed');
});

test('automatic public source confirmation keeps failed checks pending and never falls through to paid lookup',async()=>{
 const calls=[],context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async(url)=>{calls.push(String(url));return {ok:false,status:503,json:async()=>({error:'Official source unavailable'})};}});
 context.LeadIntelContactPolicy=require('../contact-confirmation-policy.js');context.__setBuyerConfirmationPolicy();context.__setCrmCompanies([{id:'c1',normalized_domain:'example.com'}]);
 const person={id:'anna',name:'Anna Buyer',title:'Procurement Director',organization:'Example',publicName:'Anna Buyer',publicNameUrl:'https://example.com/team',publicEmail:'anna.buyer@example.com',publicEmailUrl:'https://example.com/team'};
 const candidate={company:'Example',domain:'example.com',buyerRoles:'Procurement Director',people:[person]};
 await context.confirmResearchedPublicEmails(candidate,new AbortController().signal);
 assert.equal(person.contactVerification.status,'error');assert.equal(person.publicEmailSourceCheck,undefined);assert.match(person.contactVerification.issues[0],/unavailable/);
 assert.equal(calls.filter(url=>url.includes('/confirm-public-email')).length,1);assert.equal(calls.some(url=>/hunter|enrich|additional-contact-services/.test(url)),false);
});

test('finishing an old workspace research pass cannot confirm a buyer in the new workspace',async()=>{
 const calls=[],context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'new-workspace'}},fetchImpl:async url=>{calls.push(String(url));return {ok:false,status:503,json:async()=>({error:'Source unavailable'})};}});
 context.LeadIntelContactPolicy=require('../contact-confirmation-policy.js');context.__setCrmCompanies([{id:'c1',normalized_domain:'example.com'}]);
 const candidate={company:'Example',domain:'example.com',buyerRoles:'Procurement Director',people:[{id:'anna',name:'Anna Buyer',title:'Procurement Director',organization:'Example',publicName:'Anna Buyer',publicNameUrl:'https://example.com/team',publicEmail:'anna.buyer@example.com',publicEmailUrl:'https://example.com/team'}]};
 await context.confirmResearchedPublicEmails(candidate,new AbortController().signal,'old-workspace');
 assert.equal(calls.some(url=>url.includes('/confirm-public-email')),false);
 assert.equal(candidate.people[0].contactVerification,undefined);
});

test('cached official identities reread their shared source once and confirm explicitly published addresses',async()=>{
 const calls=[],url='https://example.com/purchasing';
 const context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async(path,options)=>{
  calls.push(String(path));
  if(String(path).includes('/confirm-public-email')){const body=JSON.parse(options.body);return {ok:true,json:async()=>({contact:{id:body.person_id,name:body.name,work_email:body.email,email_status:'public_confirmed',verification_provider:'Public source',public_email_url:url,verified_at:new Date().toISOString()}})};}
  return {ok:true,json:async()=>({data:{markdown:'## Anna Buyer\nProcurement\nanna.buyer(at)example(dot)com\n\n## Eva Buyer\nProcurement\neva.buyer(at)example(dot)com',metadata:{sourceURL:url}}})};
 }});
 context.LeadIntelContactPolicy=require('../contact-confirmation-policy.js');context.__setCrmCompanies([{id:'c1',normalized_domain:'example.com'}]);
 const candidate={company:'Example',domain:'example.com',buyerRoles:'Procurement Director',people:['Anna Buyer','Eva Buyer'].map((name,i)=>({id:String(i),name,title:'Procurement Director',organization:'Example',publicNameUrl:url}))};
 await context.confirmResearchedPublicEmails(candidate,new AbortController().signal);
 assert.deepEqual(Array.from(candidate.people,p=>p.publicEmail),['anna.buyer@example.com','eva.buyer@example.com']);
 assert.equal(calls.filter(path=>path.includes('/firecrawl/scrape')).length,1);
 assert.equal(calls.filter(path=>path.includes('/confirm-public-email')).length,2);
 assert.ok(candidate.people.every(p=>p.publicEmailSourceCheck.status==='confirmed'));
});


test('the Buyers page keeps four existing cards without a separate published-contact card section',()=>{
 const {JSDOM}=require('jsdom'),context=loadDiscoveryRunner({renderNodes:true});
 const people=['CEO','COO','Procurement Director','Plant Manager'].map((title,i)=>({id:'buyer'+i,name:'Priority Buyer'+i,title,organization:'Northstar',publicNameUrl:'https://northstar.com/team/'+i,identityEvidenceDate:new Date().toISOString()}));
 const companyContacts=[{id:'staff',name:'Other Staff',title:'Administration',organization:'Northstar',publicEmail:'staff@northstar.com',publicEmailUrl:'https://northstar.com/team',sourceUrl:'https://northstar.com/team'}];
 const candidate={company:'Northstar',domain:'northstar.com',buyerRoles:['Procurement Director','Plant Manager'],people,peopleStatus:'complete',buyerDiscovery:{companyContacts}};
 const html=context.__renderSelectedProspects([candidate]),dom=new JSDOM(html);
 assert.equal(dom.window.document.querySelectorAll('.published-company-contacts').length,0);
 assert.equal(dom.window.document.querySelectorAll('.selected-prospect-person').length,4);
 assert.equal(dom.window.document.querySelectorAll('[data-prospect-enrich-email]').length,4);
 for(const button of dom.window.document.querySelectorAll('[data-prospect-enrich-email]'))assert.equal(button.textContent,'E-mail');
 assert.equal(candidate.buyerDiscovery.companyContacts[0].publicEmail,'staff@northstar.com');dom.window.close();
});

test('rendering the buyer cards calculates the shared full quality report once per company',()=>{
 const context=loadDiscoveryRunner({renderNodes:true});let assessments=0;
 context.LeadIntelDiscovery={...Discovery,buyerQualityAssessment:(...args)=>{assessments++;return Discovery.buyerQualityAssessment(...args);}};
 const people=['CEO','COO','Procurement Director','Plant Manager'].map((title,i)=>({id:'q'+i,name:'Quality Person'+i,title,organization:'Example',publicNameUrl:'https://example.com/team',identityEvidenceDate:new Date().toISOString(),emailResearch:{status:'complete',searches:4,failed:0,checkedAt:new Date().toISOString()}}));
 context.__renderSelectedProspects([{company:'Example',domain:'example.com',people,buyerRoles:people.map(p=>p.title)}]);
 assert.equal(assessments,1);
});


test('seller changes during dossier research discard late contact results and clear loading',async()=>{
 let release,body,searches=0;
 const context=loadDiscoveryRunner({requestTimeout:1000,bridgeImpl:{session:{authenticated:true},workspace:{id:'w1'}},fetchImpl:async(url,options)=>{
  if(String(url).includes('/company-dossier')){body=JSON.parse(options.body);return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>require('../company-dossier.js').reconcile([{provider:'openai',webSearch:true,status:'complete',people:[],facts:[],channels:[]},{provider:'gemini',webSearch:true,status:'complete',people:[],facts:[],channels:[]}],body)});});}
  searches++;throw Error('Contact search must not start for stale context');
 }});
 context.LeadIntelCompanyDossierUi={...require('../company-dossier-ui.js'),render:()=>''};
 context.__setDiscovery({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director'],people:[{id:'a',name:'Alex Smith',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team'}]}]});
 const work=context.__findPublicProspectContacts('example.com');
 for(let i=0;i<20&&!release;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(release);const main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));main.profile.priorityOffers='Different confirmed offer';context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));release();await work;
 const candidate=context.__discoveryState().selectedProspects[0];assert.equal(searches,0);assert.equal(candidate.buyerDiscovery?.companyDossier,null);assert.equal(candidate.publicContactStatus,'error');
});
