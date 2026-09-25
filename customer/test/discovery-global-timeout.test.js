const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Discovery = require('../discovery-engine.js');

function loadDiscoveryRunner({ renderFails = false, renderNodes = false, fetchImpl = () => new Promise(() => {}), requestTimeout = 1, scaleProductionRunTimeout = 15000, researchMode = 'deep' } = {}) {
  let source = fs.readFileSync(path.join(__dirname, '..', 'discovery-ui.js'), 'utf8');
  const runTimeout = source.match(/const DISCOVERY_RUN_TIMEOUT_MIN_MS=(\d+);/);
  const runMargin = source.match(/const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=(\d+);/);
  const testRunTimeout = scaleProductionRunTimeout
    ? Math.ceil(Number(runTimeout?.[1] || 0) / scaleProductionRunTimeout)
    : 8;
  const testRunMargin = scaleProductionRunTimeout
    ? Math.ceil(Number(runMargin?.[1] || 0) / scaleProductionRunTimeout)
    : 2;
  source = source
    .replace('const DISCOVERY_REQUEST_TIMEOUT_MS=25000;', `const DISCOVERY_REQUEST_TIMEOUT_MS=${requestTimeout};`)
    .replace(runTimeout?.[0], `const DISCOVERY_RUN_TIMEOUT_MIN_MS=${testRunTimeout};`)
    .replace(runMargin?.[0], `const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=${testRunMargin};`)
    .replace(/\ninitDiscoveryWhenReady\(\);\s*$/, '\ndiscovery=LeadIntelDiscovery.normalizeDiscoveryState({});\nglobalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__discoveryState = () => discovery;\nglobalThis.__setDiscovery = value => { discovery = LeadIntelDiscovery.normalizeDiscoveryState({...value,qualityVersion:value.qualityVersion??LeadIntelDiscovery.DISCOVERY_QUALITY_VERSION}); };\nglobalThis.__renderStatus = renderStatus;\nglobalThis.__renderCandidates = renderCandidates;\n')
    .replace('globalThis.__runDiscovery = runCompanyDiscovery;', 'globalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__firecrawlCompanySearch = firecrawlCompanySearch;\nglobalThis.__discoveryRunTimeoutMs = discoveryRunTimeoutMs;\nglobalThis.__renderDiscoveryFunnel = renderDiscoveryFunnel;\nglobalThis.__renderPotentialMatches = renderPotentialMatches;');
  const mainState = {
    website: 'https://acme.example/',
    profile: {
      website: 'https://acme.example/',
      targetMarkets: 'Latvia',
      priorityOffers: 'industrial automation',
      idealCustomer: 'manufacturers'
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
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, remove() {}, insertAdjacentHTML() {}
    });
    return elements.get(id);
  };
  const context = {
    console: { ...console, error() {} },
    AbortController,
    DOMException,
    LeadIntelDiscovery: Discovery,
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
  assert.equal(requestCounts.market_search,4,'a full target does not trigger adaptive searches');
  assert.ok(requestCounts.resolution > 4, 'the pipeline should have enough time to process multiple company resolutions');
  assert.ok(requestCounts.verification > 4, 'the pipeline should have enough time to verify multiple company websites');
  assert.notEqual(context.__discoveryState().status, 'error');
});

test('the run deadline covers the worst-case bounded search stages at each supported target size', () => {
  const context=loadDiscoveryRunner({requestTimeout:25,scaleProductionRunTimeout:1000});
  assert.equal(context.__discoveryRunTimeoutMs(10,4),370);
  assert.equal(context.__discoveryRunTimeoutMs(25,8),395);
  assert.equal(context.__discoveryRunTimeoutMs(50,10),420);
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
      if(marketRequests<=4){initialResults+=1;return {ok:true,json:async()=>({success:true,data:[]})};}
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
  assert.equal(initialResults,4);
  assert.equal(followUpResults,4,'the second pass has a strict four-search cap');
  assert.equal(result.status,'complete');
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].domain,'northsteel.lv');
  assert.equal(result.funnel.marketSearchesCompleted,8);
  assert.equal(result.funnel.marketSearchesTotal,8);
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
  assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/Potential matches/i);
  assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/not qualified/i);
  assert.match(context.__elements.get('discovery-potential-matches').innerHTML,/Target market evidence is missing/);
  assert.doesNotMatch(context.__elements.get('discovery-potential-matches').innerHTML,/Save to CRM|Add to Pipeline/);
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
  assert.equal(requests,4,'provider errors must not trigger additional billed searches');
});

test('a rendering failure cannot leave Company Discovery running', async () => {
  const context = loadDiscoveryRunner({ renderFails: true });
  await assert.doesNotReject(context.__runDiscovery());
  assert.equal(context.__discoveryState().status, 'error');
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
    limit: 5,
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
