const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ux=require('../market-research-ux.js');

const profile={
  targetMarkets:'Latvia',
  priorityOffers:'Sales training; AI integration',
  idealCustomer:'B2B sales teams',
  marketFocus:'sales performance'
};
const marketState={signals:[{name:'New Sales Director',active:true,keywords:'sales director appointment'}]};

test('idle market research labels contain no Review prefix and each has distinct readable copy',()=>{
  assert.equal(ux.MODE_COPY.quick.label,'Market Scan');
  assert.equal(ux.MODE_COPY.deep.label,'Market Research');
  assert.equal(ux.MODE_COPY.intelligence.label,'Market Intelligence');
  assert.match(ux.MODE_COPY.quick.description,/Fast validation/i);
  assert.match(ux.MODE_COPY.deep.description,/Deeper research/i);
  assert.match(ux.MODE_COPY.intelligence.description,/Comprehensive investigation/i);
  assert.ok(Object.values(ux.MODE_COPY).every(item=>!/^Review\b/i.test(item.label)));
  assert.equal(ux.MODE_COPY.deep.badge,'Recommended');
  assert.equal(ux.MODE_COPY.quick.action,undefined);
  assert.equal(ux.MODE_COPY.deep.action,undefined);
  assert.equal(ux.MODE_COPY.intelligence.action,undefined);
});

test('source discovery policy differs by research depth',()=>{
  assert.deepEqual(ux.sourceDiscoveryPolicy('quick'),{mode:'automatic',maxSites:0,grouped:false});
  assert.deepEqual(ux.sourceDiscoveryPolicy('deep'),{mode:'discover-before-run',maxSites:8,grouped:false});
  assert.deepEqual(ux.sourceDiscoveryPolicy('intelligence'),{mode:'discover-before-run',maxSites:15,grouped:true});
});

test('source discovery is built from market and company context rather than a country source catalog',()=>{
  const queries=ux.buildSourceDiscoveryQueries(profile,marketState,'deep');
  assert.ok(queries.length>=3);
  assert.ok(queries.every(q=>/Latvia/i.test(q)));
  assert.ok(queries.some(q=>/hiring|leadership|sales director/i.test(q)));
  assert.ok(queries.every(q=>!/^https?:\/\/(?:www\.)?(?:lsm|db)\.lv/i.test(q)));
});

test('quick mode performs no specific-site discovery',()=>{
  assert.deepEqual(ux.buildSourceDiscoveryQueries(profile,marketState,'quick'),[]);
});

test('discovered sources are canonicalized to site origins, deduplicated and capped',()=>{
  const payloads=[{results:[
    {url:'https://example.com/news/a',title:'A',description:'growth'},
    {url:'https://example.com/news/b',title:'B',description:'leadership'},
    {url:'https://jobs.example.org/role',title:'Jobs',description:'hiring'}
  ]}];
  const deep=ux.normalizeDiscoveredSources(payloads,'deep');
  assert.equal(deep.length,2);
  assert.equal(deep[0].url,'https://example.com/');
  assert.ok(deep.every(item=>item.url.startsWith('https://')));
});

test('source intelligence classification supports the required map groups',()=>{
  assert.equal(ux.classifySource('https://www.cv.lv/','CV.lv','jobs vacancies'),'hiring');
  assert.equal(ux.classifySource('https://info.ur.gov.lv/','Register','company registry'),'registries-data');
  assert.equal(ux.classifySource('https://example.com/','Industry Association','trade association'),'industry');
  assert.equal(ux.classifySource('https://tech.example.com/','CRM AI','technology transformation'),'technology');
});

test('profile-only market view hides score and separates geography, focus and customers',()=>{
  const view=ux.marketCardView({market:'Latvia',profileOnly:true,score:{total:0}},profile);
  assert.equal(view.market,'Latvia');
  assert.equal(view.showScore,false);
  assert.match(view.commercialFocus,/Sales training/);
  assert.match(view.targetCustomers,/B2B sales teams/);
  assert.equal(view.status,'Not researched yet');
});

test('researched market view preserves score visibility',()=>{
  const view=ux.marketCardView({market:'Latvia',profileOnly:false,score:{total:76}},profile);
  assert.equal(view.showScore,true);
});

test('module exposes browser installer and source-card renderer for runtime integration',()=>{
  assert.equal(typeof ux.install,'function');
  assert.equal(typeof ux.renderDiscoveredSources,'function');
  const html=ux.renderDiscoveredSources([{url:'https://example.com/',name:'Example',reason:'Relevant market source',category:'news-media'}],'deep');
  assert.match(html,/data-suggested-source=/);
  assert.match(html,/https:\/\/example\.com\//);
});

test('new source discovery module contains no hardcoded LSM or Dienas Bizness recommendation catalog',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','market-research-ux.js'),'utf8');
  assert.doesNotMatch(source,/https?:\\?\/\\?\/(?:www\\?\.)?lsm\\?\.lv/i);
  assert.doesNotMatch(source,/https?:\\?\/\\?\/(?:www\\?\.)?db\\?\.lv/i);
});

test('evidence-view bootstrap loads the market research UX module',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','evidence-view.js'),'utf8');
  assert.match(source,/market-research-ux\.js\?v=20260913-strategy-flow-v1/);
});

test('research choice hierarchy is shipped through the CSP-approved static stylesheet',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','market.css'),'utf8');
  assert.match(html,/market\.css\?v=20260913-strategy-flow-v1/);
  assert.match(css,/\.research-actions \.research-mode-choice\[data-research-mode="deep"\]>button/);
  assert.match(css,/\.research-mode-choice\.is-selected>button/);
  assert.match(css,/\.research-mode-action/);
  assert.match(css,/#run-detailed-research/);
  assert.match(css,/\.research-mode-action\{display:none!important\}/);
  assert.match(css,/Simplified research choices: no gold/);
});

test('strategy flow runtime derives the active page step from saved research state',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','market-research-ux.js'),'utf8');
  assert.match(source,/function updateStrategyFlow/);
  assert.match(source,/data-strategy-flow-step/);
  assert.match(source,/market\.strategyApproved/);
});
