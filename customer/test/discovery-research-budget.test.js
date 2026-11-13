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

function loadRunner({ engine = Discovery, targetCompanies = [], targetCount = 10, pendingCompanies = [], fitResponse = weakBuyerFitResponse, verificationMarkdown = '' } = {}) {
  let source = uiSource;
  const runTimeout = source.match(/const DISCOVERY_RUN_TIMEOUT_MIN_MS=(\d+);/);
  const runMargin = source.match(/const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=(\d+);/);
  const extractionTimeout = source.match(/const COMPANY_EXTRACTION_TIMEOUT_MS=(\d+);/);
  source = source
    .replace('const DISCOVERY_REQUEST_TIMEOUT_MS=25000;', 'const DISCOVERY_REQUEST_TIMEOUT_MS=1000;')
    .replace(runTimeout[0], 'const DISCOVERY_RUN_TIMEOUT_MIN_MS=4000;')
    .replace(runMargin[0], 'const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=500;')
    .replace(extractionTimeout[0], 'const COMPANY_EXTRACTION_TIMEOUT_MS=1000;')
    .replace(/\ninitDiscoveryWhenReady\(\);\s*$/, '\ndiscovery=LeadIntelDiscovery.normalizeDiscoveryState({});\nglobalThis.__runDiscovery=runCompanyDiscovery;\nglobalThis.__discoveryState=()=>discovery;\nglobalThis.__loadMeta=loadMeta;\nglobalThis.__verifyCompany=firecrawlCompanySearch;\nglobalThis.__startBudget=startDiscoveryBudget;globalThis.__fetchDiscoveryResource=fetchDiscoveryResource;\n');
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
  const calls = { search: 0, scrape: 0, other: 0, queries: [] };
  let marketSearchIndex = 0;
  const fetchImpl = async (url, options) => {
    const target = String(url);
    const body = JSON.parse(options?.body || '{}');
    if (target.includes('/api/integrations/services/contact-policy')) return { ok: true, json: async () => ({ confirmationLevel: 'provider_verified' }) };
    if (target.includes('/api/ai/generate')) { calls.other += 1; return { ok: true, json: async () => ({ text: fitResponse(body.prompt) }) }; }
    if (target.includes('/firecrawl-scrape')) {
      calls.scrape += 1;
      return { ok: true, json: async () => ({ data: { markdown: 'Official company website. We operate an industrial manufacturing business in Latvia with production facilities, engineering capabilities and a management team planning a new factory.', links: [], metadata: { sourceURL: body.url, title: 'Official site' } } }) };
    }
    if (target.includes('/firecrawl-search')) {
      calls.search += 1;
      const query = String(body.query || '');
      calls.queries.push(query);
      if (query.startsWith('site:')) {
        const domain = query.match(/^site:([^ ]+)/)[1];
        const company = companyNames.find(name => slugOf(name) === domain.split('.')[0]) || 'North Steel';
        return { ok: true, json: async () => ({ success: true, data: [{ date: new Date().toISOString().slice(0, 10), url: `https://${domain}/news/new-factory`, title: `${company} opens a new factory in Latvia`, description: signalText(company), markdown: verificationMarkdown||signalText(company) }] }) };
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
    LeadIntelCompanySearchProgress: require('../company-search-progress.js'),
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
  context.__discoveryState().potentialMatches = pendingCompanies;
  return { context, calls };
}

test('saved unfinished companies are verified before buying another broad market search', async () => {
  const {context,calls}=loadRunner({engine:{...Discovery,discoveryCallBudget:()=>12},targetCount:5,pendingCompanies:[{company:'Queued Manufacturing',domain:'queued.lv',website:'https://queued.lv/',market:'Latvia',evidence:[],qualificationGaps:['Verify target-market presence']}]});
  await context.__runDiscovery();
  assert.match(calls.queries[0],/queued\.lv/,'the known evidence gap is researched before another market wave');
  assert.ok(calls.search+calls.scrape<=12,'prioritized review draws from the original request budget');
  assert.notEqual(context.__discoveryState().status,'running');
});
test('a queue from a different seller-offer context cannot be researched as the current request',async()=>{
 const {context,calls}=loadRunner({engine:{...Discovery,discoveryCallBudget:()=>12},targetCount:5,pendingCompanies:[{company:'Other Seller Target',domain:'other-seller-target.lv',market:'Latvia',searchContextKey:'different-seller-offer-context',evidence:[]}]});
 await context.__runDiscovery();assert.doesNotMatch(calls.queries[0],/other-seller-target/);assert.ok(calls.search+calls.scrape<=12);
});
test('a later search advances unfinished review instead of repeatedly spending on the first stalled companies',async()=>{
 const pendingCompanies=Array.from({length:8},(_,i)=>({company:`Queued Manufacturing ${i}`,domain:`queued${i}.lv`,market:'Latvia',evidence:[],qualificationGaps:['Verify readable operating evidence']}));
 const {context,calls}=loadRunner({engine:{...Discovery,discoveryCallBudget:()=>12},targetCount:5,pendingCompanies});
 await context.__runDiscovery();const first=calls.queries[0],boundary=calls.queries.length;
 await context.__runDiscovery();assert.notEqual(calls.queries[boundary],first,'the saved review attempt order must give untouched companies their turn');
 assert.ok(calls.search+calls.scrape<=24,'two deliberate requests each retain their 12-call cap');
});

test('a verified saved company can satisfy the target without opening another market wave',async()=>{
 const fitResponse=prompt=>JSON.stringify({companies:JSON.parse(prompt.split('. Companies: ')[1]).map(c=>({domain:c.domain,fit:85,relationship:'buyer',offerId:'offer-0',reason:'Industrial facilities are a specific application for the approved automation offer.',buyerRole:'industrial manufacturer',evidence:[{sourceId:c.evidence[0].sourceId,quoteId:c.evidence[0].quoteOptions.find(q=>q.quote.includes('Latvia')).quoteId}]}))});
 const {context,calls}=loadRunner({targetCount:1,pendingCompanies:[{company:'Queued Manufacturing',domain:'queuedmanufacturing.lv',website:'https://queuedmanufacturing.lv/',market:'Latvia',evidence:[]}],fitResponse});
 await context.__runDiscovery();const d=context.__discoveryState();
 assert.equal(d.candidates.length,1,JSON.stringify({requested:context.__loadMeta().lastCompanyRun.requestedCount,pending:d.potentialMatches.map(c=>({domain:c.domain,gaps:c.qualification?.gaps,issue:c.buyerFitIssue})),domains:d.candidates.map(c=>c.domain)}));assert.equal(d.candidates[0].domain,'queuedmanufacturing.lv');assert.equal(d.candidates[0].qualification.score,85);
 assert.ok(calls.queries.every(q=>q.includes('queuedmanufacturing.lv')||q.includes('Queued Manufacturing')),'a completed target must not trigger unrelated searches');
 assert.ok(d.candidates[0].evidence.some(e=>e.verifiedAt),'readable evidence and freshness survive the queued handoff');
 assert.equal(d.status,'complete');assert.equal(context.__loadMeta().autonomousDiscovery.exhausted,false);
});

test('fresh saved operating evidence is reassessed under current targeting before any paid website request',async()=>{
 const text='Queued Manufacturing operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.';
 const fitResponse=prompt=>JSON.stringify({companies:JSON.parse(prompt.split('. Companies: ')[1]).map(c=>({domain:c.domain,fit:85,relationship:'buyer',offerId:'offer-0',reason:'Production operations are a specific application for the confirmed automation offer.',buyerRole:'industrial manufacturer',evidence:[{sourceId:c.evidence[0].sourceId,quoteId:c.evidence[0].quoteOptions[0].quoteId}]}))});
 const pending={company:'Queued Manufacturing',domain:'queuedmanufacturing.lv',market:'Latvia',evidence:[{url:'https://queuedmanufacturing.lv/operations',text,sourceRead:true,verifiedAt:new Date().toISOString()}],buyerFit:{version:2,fit:85,context:'older-targeting-context'}};
 const {context,calls}=loadRunner({targetCount:1,pendingCompanies:[pending],fitResponse});await context.__runDiscovery();
 assert.equal(context.__discoveryState().candidates[0]?.domain,'queuedmanufacturing.lv');assert.equal(calls.search+calls.scrape,0,'existing fresh evidence must reach the AI reassessment before a new paid web check');assert.equal(calls.other,1);
});
test('a readable official search page avoids a redundant homepage crawl and is reused within the request',async()=>{
 const verificationMarkdown='North Steel manufactures industrial equipment and operates production facilities in Latvia. Our engineering teams use industrial automation systems and manufacturing machinery to coordinate the production of equipment for business customers.';
 const {context,calls}=loadRunner({verificationMarkdown});context.__startBudget(20);
 const query={kind:'verification',verificationFocus:'operations',domain:'northsteel.lv',company:'North Steel',market:'Latvia',query:'site:northsteel.lv operations Latvia'};
 const [first,second]=await Promise.all([context.__verifyCompany(query,new AbortController().signal),context.__verifyCompany(query,new AbortController().signal)]);
 assert.equal(calls.scrape,0,'a supplied readable official operating page already satisfies the page-read step');assert.equal(calls.search,1,'the same successful query is not repurchased');assert.ok(first.some(e=>e.sourceRead&&e.verifiedAt));assert.equal(second[0].verifiedAt,first[0].verifiedAt,'reuse must not invent a later source-read timestamp');
 const audit=Discovery.companyResearchAuditSummary(context.__discoveryState().researchAudit);assert.equal(audit.searches,1);assert.equal(audit.pageReads,0);assert.equal(audit.reused,1);
});
test('discovery finishes small verified-fit batches and stops acquisition once five strong companies exist',async()=>{
 const fitResponse=prompt=>JSON.stringify({companies:JSON.parse(prompt.split('. Companies: ')[1]).map(c=>({domain:c.domain,fit:85,relationship:'buyer',offerId:'offer-0',reason:'Manufacturing operations use the confirmed automation offer.',buyerRole:'industrial manufacturer',evidence:[{sourceId:c.evidence[0].sourceId,quoteId:c.evidence[0].quoteOptions.find(q=>q.quote.includes('Latvia')).quoteId}]}))});
 const {context,calls}=loadRunner({targetCount:5,fitResponse});await context.__runDiscovery();
 assert.ok(context.__discoveryState().candidates.filter(c=>c.qualification?.score>=80).length>=5);
 assert.ok(calls.queries.filter(q=>q.startsWith('site:')).length<=8,'two four-company batches are sufficient; later websites must not be purchased first');
 assert.ok(calls.search+calls.scrape<=50,'a controlled five-strong-fit case must finish far below the 200-call cap');
});

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
  assert.match(uiSource, /Research budget: up to \$\{boundedDiscoveryCallLimit\(estimate\.cap\)\} Firecrawl calls/);
  assert.match(uiSource, /if\(followUpQueries\.length&&!discoveryBudgetExhausted\(\)\)/);
  assert.match(uiSource, /autoPass<MAX_AUTONOMOUS_DISCOVERY_PASSES&&budgetAllowsPass/);
  assert.doesNotMatch(uiSource, /Saving Mode search limit reached/);
  assert.match(uiSource, /research-budget=20261019-v1/);
  assert.match(indexHtml, /discovery-engine\.js\?v=[^"]*research-budget=20261019-v1/);
  assert.match(indexHtml, /discovery-ui\.js\?v=[^"]*research-budget=20261019-v1/);
});

test('timed-out work cannot poison a later retry cache or mutate a replacement request ledger',async()=>{
 const {context}=loadRunner();context.__startBudget(20);let finish,calls=0;
 context.fetch=()=>{calls++;if(calls===1)return new Promise(resolve=>{finish=resolve;});return Promise.resolve({ok:true,json:async()=>({data:[]})});};
 const abort=new AbortController(),init={method:'POST',body:JSON.stringify({query:'same source'}),signal:abort.signal};
 const first=context.__fetchDiscoveryResource('https://provider.example/search',init,{signal:abort.signal}).catch(error=>error);
 abort.abort();await context.__fetchDiscoveryResource('https://provider.example/search',{...init,signal:new AbortController().signal},{signal:new AbortController().signal});assert.equal(calls,2,'an aborted in-flight request must not absorb a new bounded retry');
 context.__startBudget(20);const ledger=JSON.stringify(context.__discoveryState().researchAudit);finish({ok:true,json:async()=>({data:[]})});await first;assert.equal(JSON.stringify(context.__discoveryState().researchAudit),ledger,'a late response cannot cross the request boundary');
});

test('an unavailable AI assessment does not repurchase already fresh operating evidence',async()=>{
 const text='Queued Manufacturing operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.';
 const pending={company:'Queued Manufacturing',domain:'queuedmanufacturing.lv',market:'Latvia',evidence:[{url:'https://queuedmanufacturing.lv/operations',text,sourceRead:true,verifiedAt:new Date().toISOString()}],buyerFit:{version:2,fit:85,context:'older-targeting-context'}};
 const {context,calls}=loadRunner({targetCount:1,pendingCompanies:[pending],fitResponse:()=>{throw new Error('AI temporarily unavailable');}});await context.__runDiscovery();
 assert.equal(calls.search+calls.scrape,0,'an AI availability gap cannot be fixed with another web purchase');assert.ok(context.__discoveryState().searchFailures.some(row=>row.phase==='buyer-fit'));assert.equal(context.__discoveryState().candidates.length,0);
});

test('the saved web cap bounds actual provider requests and its persisted receipts',async()=>{
 const {context,calls}=loadRunner({targetCount:5});const key='leadintel_customer_v2_discovery_meta',meta=JSON.parse(context.localStorage.getItem(key));context.localStorage.setItem(key,JSON.stringify({...meta,webCallCap:7}));await context.__runDiscovery();
 const state=context.__discoveryState(),audit=Discovery.companyResearchAuditSummary(state.researchAudit);assert.equal(calls.search+calls.scrape,7);assert.equal(audit.requests,7);assert.equal(state.funnel.firecrawlCallLimit,7);assert.ok(state.researchAudit.completedAt);
});

test('saved-company review resolves confirmed headcount using targeted evidence and preserves its qualified result',async()=>{
 const fitResponse=prompt=>JSON.stringify({companies:JSON.parse(prompt.split('. Companies: ')[1]).map(c=>({domain:c.domain,fit:85,relationship:'buyer',offerId:'offer-0',reason:'Industrial production operations use the confirmed automation offer.',buyerRole:'industrial manufacturer',evidence:[{sourceId:c.evidence[0].sourceId,quoteId:c.evidence[0].quoteOptions.find(q=>q.quote.includes('Latvia')).quoteId}]}))});
 const {context,calls}=loadRunner({targetCount:1,pendingCompanies:[{company:'Queued Manufacturing',domain:'queuedmanufacturing.lv',market:'Latvia',evidence:[]}],verificationMarkdown:'Queued Manufacturing operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery across our industrial facilities. We employ 120 people.',fitResponse});
 const key='leadintel_customer_v2_state',main=JSON.parse(context.localStorage.getItem(key));main.answers.exclusions='companies with less than 30 people';main.profile.exclusions='ISO 9001 certification required';main.targetingConfirmation=Targeting.confirm(main);main.market.strategyApproval=StrategyIntegrity.approval(main);context.localStorage.setItem(key,JSON.stringify(main));
 await context.__runDiscovery();const d=context.__discoveryState();assert.equal(d.candidates[0]?.domain,'queuedmanufacturing.lv');assert.equal(d.candidates[0].qualification.score,85);assert.ok(calls.queries[0].includes('employees'));assert.ok(calls.search+calls.scrape<20);assert.equal(d.potentialMatches.some(c=>c.domain==='queuedmanufacturing.lv'),false);assert.equal(context.__loadMeta().autonomousDiscovery.goalCount,1);
 const restored=Discovery.normalizeDiscoveryState(JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery')));assert.equal(restored.candidates[0].domain,'queuedmanufacturing.lv');assert.ok(restored.candidates[0].evidence.some(e=>e.text.includes('120 people')));
});
