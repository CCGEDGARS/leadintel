const {weakBuyerFitResponse}=require('./helpers/buyer-fit-fixtures.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Discovery = require('../discovery-engine.js');
const Targeting = require('../targeting-policy.js');
const StrategyIntegrity = require('../strategy-integrity.js');

const uiSource = fs.readFileSync(path.join(__dirname, '..', 'discovery-ui.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ---------- engine: brand keys, resolution dedupe, verification exclusions, cost model ----------

test('brand variants share one mention key while distinct brands stay apart', () => {
  const key = Discovery.companyMentionKey;
  assert.equal(key('Nasdaq, Inc.'), 'nasdaq');
  assert.equal(key('NASDAQ Inc'), 'nasdaq');
  assert.equal(key('Nasdaq'), 'nasdaq');
  assert.equal(key('The Western Union Company'), key('Western Union'));
  assert.equal(key('Thermo Fisher Scientific Inc.'), 'thermo fisher scientific');
  assert.equal(key('Arijus UAB'), key('UAB Arijus'));
  assert.equal(key('Nortal AS'), key('Nortal A/S'));
  assert.notEqual(key('Nasdaq Baltic'), key('Nasdaq'));
  assert.equal(key('CC Group'), 'cc group');
  assert.equal(key('Company'), 'company');
});

test('resolution queries are built once per brand, so variants do not cost extra Firecrawl searches', () => {
  const mentions = [
    { company: 'Nasdaq, Inc.', market: 'Estonia', sourceUrl: 'https://news.example/a' },
    { company: 'NASDAQ Inc', market: 'Estonia', sourceUrl: 'https://news.example/b' },
    { company: 'Nasdaq', market: 'Estonia', sourceUrl: 'https://news.example/c' },
    { company: 'Nasdaq Baltic', market: 'Estonia', sourceUrl: 'https://news.example/d' },
    { company: 'Thermo Fisher Scientific Inc.', market: 'Estonia', sourceUrl: 'https://news.example/e' },
    { company: 'Thermo Fisher Scientific', market: 'Estonia', sourceUrl: 'https://news.example/f' }
  ];
  const queries = Discovery.buildCompanyResolutionQueries(mentions, { website: 'https://acme.example/' }, 30);
  assert.deepEqual(queries.map(item => Discovery.companyMentionKey(item.company)), ['nasdaq', 'nasdaq baltic', 'thermo fisher scientific']);
  assert.equal(queries.length, 3, 'six mentions, three paid resolution searches');
});

test('text extraction and AI extraction collapse brand variants to one mention', () => {
  const evidence = [
    { url: 'https://news.example/one', market: 'Latvia', description: 'Nasdaq, Inc. plans a new data centre in Riga. NASDAQ Inc expands its Baltic team. Nasdaq Baltic opens a new office.' }
  ];
  const text = Discovery.extractCompanyMentions(evidence, 10).map(item => Discovery.companyMentionKey(item.company));
  assert.deepEqual(text, ['nasdaq', 'nasdaq baltic']);
  const ai = Discovery.parseCompanyExtraction(JSON.stringify({ companies: [
    { company: 'Nasdaq, Inc.', sourceUrl: 'https://news.example/one' },
    { company: 'NASDAQ Inc', sourceUrl: 'https://news.example/one' },
    { company: 'Nasdaq Baltic', sourceUrl: 'https://news.example/one' }
  ] }), evidence, 10);
  assert.deepEqual(ai.map(item => Discovery.companyMentionKey(item.company)), ['nasdaq', 'nasdaq baltic']);
});

test('verification queries skip domains that were already verified in this run', () => {
  const market = { signals: [{ id: 'expansion', name: 'Expansion', active: true, weight: 9, keywords: 'new factory; expansion' }] };
  const resolved = [
    { domain: 'northsteel.lv', url: 'https://northsteel.lv/', company: 'North Steel', market: 'Latvia' },
    { domain: 'careers.northsteel.lv', url: 'https://careers.northsteel.lv/', company: 'North Steel', market: 'Latvia' },
    { domain: 'polar.lv', url: 'https://polar.lv/', company: 'Polar Engineering', market: 'Latvia' }
  ];
  const all = Discovery.buildCandidateVerificationQueries(resolved, { website: 'https://acme.example/' }, market, 30, { includeIndependent: false });
  assert.deepEqual(all.map(item => item.domain), ['northsteel.lv', 'polar.lv'], 'support hosts fold into the apex before any paid check');
  const rest = Discovery.buildCandidateVerificationQueries(resolved, { website: 'https://acme.example/' }, market, 30, { includeIndependent: false, excludeDomains: ['northsteel.lv'] });
  assert.deepEqual(rest.map(item => item.domain), ['polar.lv']);
});

test('the Firecrawl cost model bounds every request size and is what the budget uses', () => {
  const five = Discovery.estimateDiscoveryCalls({ targetCount: 5 });
  assert.equal(five.stages.market, 8);
  assert.equal(five.stages.resolution, 15);
  assert.equal(five.stages.verification, 30);
  assert.ok(five.stages.followUp > 0, 'a small request still has a bounded follow-up wave');
  assert.equal(five.total, five.searches + five.pages);
  assert.equal(five.cap, Math.ceil(five.total / 10) * 10);
  for (const targetCount of [1, 5, 10, 20, 25, 50]) {
    const estimate = Discovery.estimateDiscoveryCalls({ targetCount });
    assert.ok(estimate.cap >= estimate.total && estimate.cap <= 200, `target ${targetCount} stays within 200 calls per request`);
    assert.equal(Discovery.discoveryCallBudget({ targetCount }), estimate.cap);
  }
  const saving = Discovery.estimateDiscoveryCalls({ targetCount: 5, savingMode: true });
  assert.deepEqual([saving.searches, saving.pages, saving.cap], [10, 3, 13]);
  const targets = Discovery.estimateDiscoveryCalls({ targetCount: 5, targetOnly: true, targetPoolCount: 3 });
  assert.deepEqual([targets.searches, targets.pages, targets.cap], [9, 9, 20]);
  const recheck = Discovery.estimateDiscoveryCalls({ targetCount: 5, recheckOnly: true, targetPoolCount: 12 });
  assert.equal(recheck.cap, 80);
});

test('the discovery funnel keeps budget counters through normalisation', () => {
  const state = Discovery.normalizeDiscoveryState({ funnel: { firecrawlSearchCalls: 7, firecrawlPageReads: 5, firecrawlCallLimit: 190, budgetSkippedChecks: 3 } });
  assert.equal(state.funnel.firecrawlSearchCalls, 7);
  assert.equal(state.funnel.firecrawlPageReads, 5);
  assert.equal(state.funnel.firecrawlCallLimit, 190);
  assert.equal(state.funnel.budgetSkippedChecks, 3);
  assert.equal(Discovery.DEFAULT_DISCOVERY_STATE.funnel.firecrawlCallLimit, 0);
});

// ---------- discovery-ui: the budget stops paid calls and never turns into a failure ----------

const companyNames = ['North Steel', 'Svea Machinery', 'Nordic Foundry', 'Polar Engineering', 'Baltic Mining', 'Kiruna Metals', 'Stockholm Equipment', 'Vasa Industrial', 'Gothenburg Systems', 'Sundsvall Works'];
const slugOf = company => company.toLowerCase().replace(/[^a-z]/g, '');
const signalText = company => `${company} plans a new factory and expands production capacity in Latvia with new industrial automation.`;

function loadRunner({ engine = Discovery, targetCompanies = [], targetCount = 10 } = {}) {
  let source = uiSource;
  const runTimeout = source.match(/const DISCOVERY_RUN_TIMEOUT_MIN_MS=(\d+);/);
  const runMargin = source.match(/const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=(\d+);/);
  const extractionTimeout = source.match(/const COMPANY_EXTRACTION_TIMEOUT_MS=(\d+);/);
  source = source
    .replace('const DISCOVERY_REQUEST_TIMEOUT_MS=25000;', 'const DISCOVERY_REQUEST_TIMEOUT_MS=1000;')
    .replace(runTimeout[0], 'const DISCOVERY_RUN_TIMEOUT_MIN_MS=4000;')
    .replace(runMargin[0], 'const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=500;')
    .replace(extractionTimeout[0], 'const COMPANY_EXTRACTION_TIMEOUT_MS=1000;')
    .replace(/\ninitDiscoveryWhenReady\(\);\s*$/, '\ndiscovery=LeadIntelDiscovery.normalizeDiscoveryState({});\nglobalThis.__runDiscovery=runCompanyDiscovery;\nglobalThis.__discoveryState=()=>discovery;\nglobalThis.__loadMeta=loadMeta;\n');
  assert.ok(source.includes('globalThis.__runDiscovery=runCompanyDiscovery'), 'test hook attached');
  const mainState = {
    website: 'https://acme.example/',
    profile: { website: 'https://acme.example/', targetMarkets: 'Latvia', priorityOffers: 'industrial automation', idealCustomer: 'manufacturers', decisionMakers: 'COO; Procurement Director; Plant Manager' },
    market: { signals: [{ id: 'expansion', name: 'Expansion', active: true, weight: 9, keywords: 'new factory; expansion' }], opportunities: [{ market: 'Latvia', active: true, score: { total: 80 } }] },
    targetMarkets: ['Latvia'],
    targetCompanies
  };
  mainState.answers = { priority_offers: mainState.profile.priorityOffers, ideal_customer: mainState.profile.idealCustomer, buyer_roles: mainState.profile.decisionMakers, exclusions: 'No specific exclusions' };
  mainState.targetingConfirmation = Targeting.confirm(mainState);
  mainState.approved=true;mainState.market.strategyApproved=true;mainState.market.icps=[{id:'icp-core',type:'core',active:true}];mainState.market.strategyApproval=StrategyIntegrity.approval(mainState);
  const storage = new Map([
    ['leadintel_customer_v2_state', JSON.stringify(mainState)],
    ['leadintel_customer_v2_discovery_meta', JSON.stringify({ activeJourneyStage: 5, targetCount, targetMode: 'custom' })]
  ]);
  const calls = { search: 0, scrape: 0, other: 0 };
  let marketSearchIndex = 0;
  const fetchImpl = async (url, options) => {
    const target = String(url);
    const body = JSON.parse(options?.body || '{}');
    if (target.includes('/api/integrations/services/contact-policy')) return { ok: true, json: async () => ({ confirmationLevel: 'provider_verified' }) };
    if (target.includes('/api/ai/generate')) { calls.other += 1; return { ok: true, json: async () => ({ text: weakBuyerFitResponse(body.prompt) }) }; }
    if (target.includes('/firecrawl-scrape')) {
      calls.scrape += 1;
      return { ok: true, json: async () => ({ data: { markdown: 'Official company website. We operate an industrial manufacturing business in Latvia with production facilities, engineering capabilities and a management team planning a new factory.', links: [], metadata: { sourceURL: body.url, title: 'Official site' } } }) };
    }
    if (target.includes('/firecrawl-search')) {
      calls.search += 1;
      const query = String(body.query || '');
      if (query.startsWith('site:')) {
        const domain = query.match(/^site:([^ ]+)/)[1];
        const company = companyNames.find(name => slugOf(name) === domain.split('.')[0]) || 'North Steel';
        return { ok: true, json: async () => ({ success: true, data: [{ date: new Date().toISOString().slice(0, 10), url: `https://${domain}/news/new-factory`, title: `${company} opens a new factory in Latvia`, description: signalText(company), markdown: signalText(company) }] }) };
      }
      if (query.startsWith('"') && query.includes('-site:')) return { ok: true, json: async () => ({ success: true, data: [] }) };
      const resolution = query.match(/^"([^"]+)"/);
      if (resolution) {
        const company = resolution[1];
        return { ok: true, json: async () => ({ success: true, data: [{ url: `https://${slugOf(company)}.lv/`, title: `${company} official website`, description: 'Industrial manufacturing company investing in industrial automation in Latvia.' }] }) };
      }
      const start = (marketSearchIndex++ % 2) * 5;
      return { ok: true, json: async () => ({ success: true, data: companyNames.slice(start, start + 5).map((company, index) => ({ url: `https://industrynews${start + index}.example/articles/${index}`, title: `${company} plans a new factory`, description: signalText(company), markdown: signalText(company) })) }) };
    }
    calls.other += 1;
    return { ok: true, json: async () => ({}) };
  };
  const context = {
    console: { ...console, error() {} },
    AbortController, DOMException, URL, URLSearchParams, TextEncoder, TextDecoder,
    dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
    LeadIntelDiscovery: engine,
    LeadIntelStrategyIntegrity: StrategyIntegrity,
    LeadIntelTargeting: Targeting,
    LeadIntelServerBridge: null,
    fetch: fetchImpl,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ dataset: {}, addEventListener() {} }), head: { appendChild() {} }, body: { appendChild() {} } },
    navigator: { languages: [] },
    // The automatic broadening pass is scheduled with an 80 ms timer; tests observe one request at a time.
    setTimeout: (fn, ms, ...args) => ms === 80 ? 0 : setTimeout(fn, ms, ...args),
    clearTimeout,
    CustomEvent: class CustomEvent {}
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'first-party-research.js'), 'utf8'), context);
  vm.runInNewContext(source, context, { filename: 'discovery-ui.js' });
  return { context, calls };
}

test('a company search stops at its Firecrawl budget without failing and reports what was skipped', async () => {
  const budget = 12;
  const { context, calls } = loadRunner({ engine: { ...Discovery, discoveryCallBudget: () => budget } });
  const started = Date.now();
  await context.__runDiscovery();
  const state = context.__discoveryState();
  assert.equal(calls.search + calls.scrape, budget, 'exactly the budgeted number of Firecrawl calls were made');
  assert.equal(state.funnel.firecrawlSearchCalls + state.funnel.firecrawlPageReads, budget);
  assert.equal(state.funnel.firecrawlCallLimit, budget);
  assert.ok(state.funnel.budgetSkippedChecks > 0, 'remaining checks were skipped rather than attempted');
  assert.notEqual(state.status, 'error');
  assert.notEqual(state.status, 'running');
  assert.equal(state.searchFailures.length, 0, 'budget skips are not provider failures');
  const meta = context.__loadMeta();
  assert.equal(meta.autonomousDiscovery.active, false);
  assert.equal(meta.autonomousDiscovery.budgetReached, true, 'automatic broadening does not start a second paid pass');
  assert.equal(meta.autonomousDiscovery.callsUsed, budget);
  assert.ok(Date.now() - started < 3000, 'the capped run finishes quickly');
});

test('a target-only research run stays under its own budget and reports usage honestly', async () => {
  const targetCompanies = [
    { companyName: 'North Steel', website: 'https://northsteel.lv/', domain: 'northsteel.lv' },
    { companyName: 'Polar Engineering', website: 'https://polarengineering.lv/', domain: 'polarengineering.lv' }
  ];
  const { context, calls } = loadRunner({ targetCompanies });
  await context.__runDiscovery({ targetOnly: true });
  const state = context.__discoveryState();
  const expected = Discovery.discoveryCallBudget({ targetCount: 10, targetOnly: true, targetPoolCount: 2 });
  assert.equal(state.funnel.firecrawlCallLimit, expected);
  assert.equal(state.funnel.firecrawlSearchCalls, calls.search);
  assert.equal(state.funnel.firecrawlPageReads, calls.scrape);
  assert.ok(calls.search + calls.scrape <= expected, 'usage never exceeds the budget shown to the customer');
  assert.ok(calls.scrape > 0, 'website page reads are counted as Firecrawl calls');
  assert.equal(state.funnel.budgetSkippedChecks, 0);
  assert.notEqual(state.status, 'error');
});

// ---------- wiring: the estimate is visible before any paid call and the assets are re-fetched ----------

test('the Companies step shows the research budget next to the amount selector and refreshes assets', () => {
  assert.match(uiSource, /id="discovery-cost-estimate"/);
  assert.match(uiSource, /function renderDiscoveryEstimate\(\)/);
  assert.match(uiSource, /Research budget: up to \$\{estimate\.cap\} Firecrawl calls/);
  assert.match(uiSource, /if\(followUpQueries\.length&&!discoveryBudgetExhausted\(\)\)/);
  assert.match(uiSource, /autoPass<MAX_AUTONOMOUS_DISCOVERY_PASSES&&budgetAllowsPass/);
  assert.match(uiSource, /fetchImpl:async\(url,init\)=>\{throwIfDiscoveryRunAborted\(runSignal\);reserveFirecrawlCall\('page'\);return fetch\(url,init\);\}/);
  assert.doesNotMatch(uiSource, /Saving Mode search limit reached/);
  assert.match(uiSource, /research-budget=20261019-v1/);
  assert.match(indexHtml, /discovery-engine\.js\?v=[^"]*research-budget=20261019-v1/);
  assert.match(indexHtml, /discovery-ui\.js\?v=[^"]*research-budget=20261019-v1/);
});
