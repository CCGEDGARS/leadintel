const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Discovery = require('../discovery-engine.js');

function loadDiscoveryRunner({ renderFails = false, fetchImpl = () => new Promise(() => {}), requestTimeout = 1 } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'discovery-ui.js'), 'utf8')
    .replace('const DISCOVERY_REQUEST_TIMEOUT_MS=25000;', `const DISCOVERY_REQUEST_TIMEOUT_MS=${requestTimeout};`)
    .replace('const DISCOVERY_RUN_TIMEOUT_MS=DISCOVERY_REQUEST_TIMEOUT_MS*2+2000;', 'const DISCOVERY_RUN_TIMEOUT_MS=8;')
    .replace(/\ninitDiscoveryWhenReady\(\);\s*$/, '\ndiscovery=LeadIntelDiscovery.normalizeDiscoveryState({});\nglobalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__discoveryState = () => discovery;\n')
    .replace('globalThis.__runDiscovery = runCompanyDiscovery;', 'globalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__firecrawlCompanySearch = firecrawlCompanySearch;');
  const mainState = {
    website: 'https://acme.example/',
    profile: {
      website: 'https://acme.example/',
      targetMarkets: 'Latvia',
      priorityOffers: 'industrial automation',
      idealCustomer: 'manufacturers'
    },
    market: {
      signals: [{ id: 'expansion', name: 'Expansion', active: true, weight: 9, keywords: 'new factory; expansion' }],
      opportunities: [{ market: 'Latvia', active: true, score: { total: 80 } }]
    }
  };
  const storage = new Map([['leadintel_customer_v2_state', JSON.stringify(mainState)]]);
  const context = {
    console: { ...console, error() {} },
    AbortController,
    LeadIntelDiscovery: Discovery,
    fetch: fetchImpl,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document: { getElementById: id => renderFails && id === 'discovery-status' ? { textContent: '' } : null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ dataset: {}, addEventListener() {} }), head: { appendChild() {} }, body: { appendChild() {} } },
    navigator: { languages: [] },
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {}
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: 'discovery-ui.js' });
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

test('the overall guard allows both the discovery and verification request windows', () => {
  const source=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');
  assert.match(source,/DISCOVERY_RUN_TIMEOUT_MS=DISCOVERY_REQUEST_TIMEOUT_MS\*2\+2000/);
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
          description:'The Latvian manufacturer is expanding production capacity.',
          markdown:'Buyer is opening a new factory in Latvia and expanding production capacity.'
        }:{
          url:'https://buyer.lv/',title:'Buyer',description:'Latvian industrial company.'
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
        url:`https://buyer${index}.lv/`,title:`Buyer ${index}`,description:'Latvian industrial company.'
      }));
      return {ok:true,json:async()=>({success:true,data})};
    }
  });

  await context.__runDiscovery();

  assert.ok(maximum<=4,`expected at most four concurrent provider requests, observed ${maximum}`);
});
