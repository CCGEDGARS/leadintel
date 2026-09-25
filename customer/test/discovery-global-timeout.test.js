const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Discovery = require('../discovery-engine.js');

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
    .replace('globalThis.__runDiscovery = runCompanyDiscovery;', 'globalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__retryFailedDiscoveryChecks = retryFailedDiscoveryChecks;\nglobalThis.__findPotentialDecisionMakers = findPotentialDecisionMakers;\nglobalThis.__savePotentialProspect = savePotentialProspect;\nglobalThis.__addSelectedProspectToPipeline = addSelectedProspectToPipeline;\nglobalThis.__setCrmCompanies = companies => { crmCompanies = companies; };\nglobalThis.__renderPipeline = renderPipeline;\nglobalThis.__firecrawlCompanySearch = firecrawlCompanySearch;\nglobalThis.__discoveryRunTimeoutMs = discoveryRunTimeoutMs;\nglobalThis.__renderDiscoveryFunnel = renderDiscoveryFunnel;\nglobalThis.__renderPotentialMatches = renderPotentialMatches;');
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
  const storage = new Map([['leadintel_customer_v2_state', JSON.stringify(mainState)]]);
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
    LeadIntelDiscovery: Discovery,
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
  vm.runInNewContext(source, context, { filename: 'discovery-ui.js' });
  context.__elements = elements;
  return context;
}

test('a permanently pending provider cannot leave Company Discovery running', async () => {
  const context = loadDiscoveryRunner();
  const completed = await Promise.race([
    context.__runDiscovery().then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 60))
  ]);
  assert.equal(completed, true);
  assert.notEqual(context.__discoveryState().status, 'running');
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
          url: `https://${domain}/news/new-factory`,
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
  assert.equal(requestCounts.market_search,6,'a full target does not trigger adaptive searches');
  assert.ok(requestCounts.resolution > 4, 'the pipeline should have enough time to process multiple company resolutions');
  assert.ok(requestCounts.verification > 4, 'the pipeline should have enough time to verify multiple company websites');
  assert.notEqual(context.__discoveryState().status, 'error');
});

test('the run deadline covers the worst-case bounded search stages at each supported target size', () => {
  const context=loadDiscoveryRunner({requestTimeout:25,scaleProductionRunTimeout:1000});
  assert.equal(context.__discoveryRunTimeoutMs(10,4),658);
  assert.equal(context.__discoveryRunTimeoutMs(25,8),683);
  assert.equal(context.__discoveryRunTimeoutMs(50,10),708);
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
        url:'https://northsteel.lv/news/new-factory',title:'North Steel opens a new factory',
        description:'North Steel plans a new factory in Latvia, expands production capacity and invests in industrial automation.',
        markdown:'North Steel plans a new factory in Latvia, expands production capacity and invests in industrial automation.'
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
        markdown:'North Steel plans a new factory in Latvia, expands production capacity and invests in industrial automation.'
      }]})};
    }
  });

  await context.__runDiscovery();

  const result=context.__discoveryState();
  assert.equal(initialResults,6);
  assert.equal(followUpResults,4,'the second pass has a strict four-search cap');
  assert.equal(result.status,'complete');
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].domain,'northsteel.lv');
  assert.equal(result.funnel.marketSearchesCompleted,10);
  assert.equal(result.funnel.marketSearchesTotal,10);
  assert.equal(result.funnel.evidencePages,3,'repeated URLs count once in the funnel');
  assert.equal(result.funnel.companiesIdentified,1);
  assert.equal(result.funnel.officialDomainsResolved,1);
  assert.equal(result.funnel.companySitesChecked,1);
  assert.equal(result.funnel.qualifiedCompanies,1);
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
  assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/Ranked companies to review/i);
  assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/buying signal unconfirmed/i);
  assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/Target market evidence is missing/);
  assert.doesNotMatch(context.__elements.get('discovery-potential-matches').innerHTML,/Save to CRM|Add to Pipeline/);
});

test('only fit-and-market verified potential companies offer a clearly flagged buyer search',()=>{
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
  assert.equal((html.match(/data-action="find-potential-buyers"/g)||[]).length,1);
  assert.equal((html.match(/data-action="save-potential-prospect"/g)||[]).length,1);
  assert.match(html,/Find buyers/);
  assert.match(html,/No active buying signal was confirmed/);
  assert.match(html,/outside the qualified opportunity list and Pipeline/);
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
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Add to Pipeline · signal unconfirmed/);
  assert.equal(context.__elements.get('discovery-pipeline-count').textContent,'1');
  assert.match(context.__elements.get('discovery-selection-breakdown').textContent,/0 in Pipeline · 1 prospect/);
  assert.equal(await context.__addSelectedProspectToPipeline('northstar.com'),true);
  assert.deepEqual(additions,[{id:'crm-1',stage:'Discovered'}]);
  const state=context.__discoveryState();
  assert.equal(state.pipeline.length,1);
  assert.equal(state.pipeline[0].qualified,false);
  assert.equal(state.pipeline[0].matchedSignals.length,0);
  assert.equal(state.pipeline[0].score.total,undefined);
  context.__renderPipeline();
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/Buying signal unconfirmed · manually added/);
  assert.match(context.__elements.get('customer-pipeline').innerHTML,/pipeline-score">—</);
  assert.match(context.__elements.get('discovery-selection-breakdown').textContent,/1 in Pipeline · 0 prospects/);
});

test('a user-selected fit-and-market verified potential match can display Apollo decision-makers without CRM promotion',async()=>{
  let crmSaves=0;
  const context=loadDiscoveryRunner({
    renderNodes:true,
    requestTimeout:1000,
    scaleProductionRunTimeout:1000,
    bridgeImpl:{session:{authenticated:true},workspace:{id:'workspace-1'},searchApolloPeople:async()=>({ok:true,people:[{id:'p1',name:'Pat Example',title:'Chief Operating Officer',linkedin_url:'https://www.linkedin.com/in/pat-example'}]}),saveCrmCompany:async()=>{crmSaves+=1;return {ok:true};}},
    fetchImpl:async()=>({ok:true,json:async()=>({success:true,data:[]})})
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
        url:'https://northstar.com/news/new-factory',title:'Northstar expands its Latvian production site',
        description:'Northstar is a Latvian industrial manufacturer investing in automation and expanding production capacity at a new factory.',
        markdown:'Northstar is a Latvian industrial manufacturer investing in automation and expanding production capacity at a new factory.'
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
  assert.equal(requests,1,`the failed website check alone should be retried: ${JSON.stringify(context.__discoveryState().searchFailures)}`);
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
  assert.match(context.__elements.get('company-discovery-status').textContent,/scoring has been improved/i);
  assert.match(context.__elements.get('company-candidates').innerHTML,/refresh saved results before acting/i);
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
        ?{url:'https://northstar.com/news/new-factory',title:'Northstar invests in a new factory',description:'Northstar invests in a new factory in Latvia for industrial automation.'}
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
  assert.equal(requests.length,4,'only one official-domain lookup and one website check should call Firecrawl and OpenAI');
  assert.ok(requests.every(item=>!item.query.includes('discover-')));
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
          url:'https://buyer.lv/news/new-factory',title:'Buyer opens a new factory',
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
  assert.equal(context.__discoveryState().candidates.length,1);
  assert.equal(context.__discoveryState().candidates[0].domain,'buyer.lv');
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
