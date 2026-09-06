const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../profile-engine.js');

const APPROVED_MISSION = 'Find qualified B2B opportunities, connect with decision-makers, and close more deals through evidence-backed commercial intelligence.';

const answers = {
  priority_offers: 'Industrial steel structures; custom fabrication',
  ideal_customer: 'Manufacturers with 50-500 employees in Northern Europe',
  lookalike_customers: 'ABB; Valmet',
  buyer_roles: 'Procurement Director; Production Director; CEO',
  growth_markets: 'Industrial manufacturing; logistics centres',
  differentiation: 'Fast engineering, custom production, reliable delivery',
  buying_triggers: 'New factory; capacity expansion; equipment modernization',
  exclusions: 'Projects below EUR 20,000; private consumers',
  opportunity_value: 'EUR 50,000-250,000',
  success_outcome: 'Build a EUR 2M qualified pipeline in 12 months'
};

const targetMarkets = ['Nordics', 'Germany'];

const websiteSources = [{
  type: 'website',
  url: 'https://example.com',
  title: 'Example Industrial — Steel Structures',
  text: 'Example Industrial designs and manufactures steel structures for factories, logistics centres and energy projects. We export to Latvia, Estonia and Lithuania. ISO certified. Engineering and installation services are available.'
}];

test('normalizes URLs and adds https when missing', () => {
  assert.equal(engine.normalizeUrl('example.com/about'), 'https://example.com/about');
  assert.equal(engine.normalizeUrl('https://example.com/'), 'https://example.com/');
  assert.equal(engine.normalizeUrl('javascript:alert(1)'), '');
});

test('website and at least one target market are required before customer modules unlock', () => {
  const ready = {website: 'example.com', targetMarkets:['Sweden'], answers: {}};
  assert.equal(engine.canBuildProfile(ready), true);
  for(let step=1; step<=7; step++) assert.equal(engine.canAccessModule(ready, step), true);
  assert.equal(engine.canBuildProfile({website:'example.com',targetMarkets:[]}), false);
  assert.equal(engine.canBuildProfile({website:'',targetMarkets:['Sweden']}), false);
  const empty = {website: '', targetMarkets:[], answers: {}};
  assert.equal(engine.canAccessModule(empty, 1), true);
  for(let step=2; step<=7; step++) assert.equal(engine.canAccessModule(empty, step), false);
});

test('normalizes manual target markets and expands supported region presets for research', () => {
  assert.deepEqual(engine.normalizeTargetMarkets([' Sweden ', 'Nordics', 'sweden', 'DACH', '']), ['Sweden','Nordics','DACH']);
  assert.deepEqual(engine.expandTargetMarkets(['Nordics','DACH']), ['Sweden','Finland','Norway','Denmark','Iceland','Germany','Austria','Switzerland']);
});

test('saved state preserves an unlocked module position through Step 7', () => {
  const state=engine.normalizeSavedState({step:7,website:'example.com',targetMarkets:['Sweden']});
  assert.equal(state.step, 7);
  assert.deepEqual(state.targetMarkets,['Sweden']);
});

test('legacy saved geography is migrated into the new mandatory target market state', () => {
  const state=engine.normalizeSavedState({website:'example.com',answers:{growth_markets:'Sweden; Finland'}});
  assert.deepEqual(state.targetMarkets,['Sweden','Finland']);
  assert.equal(engine.canBuildProfile(state),true);
});

test('calculates a high completeness score when mandatory context and strategic intake are complete', () => {
  const score = engine.calculateCompleteness({ website: 'https://example.com', targetMarkets, additionalLinks: ['https://example.com/cases'], documents: [{name:'catalog.pdf', text:'catalog'}], answers });
  assert.equal(score, 100);
});

test('keeps mandatory target markets authoritative while preserving optional segment focus', () => {
  const profile = engine.buildCompanyIntelligenceProfile({ website: 'https://example.com', targetMarkets, additionalLinks: [], documents: [], answers, scrapedSources: websiteSources });
  assert.equal(profile.priorityOffers, answers.priority_offers);
  assert.equal(profile.targetMarkets, 'Nordics; Germany');
  assert.equal(profile.marketFocus, answers.growth_markets);
  assert.deepEqual(profile.researchMarkets,['Sweden','Finland','Norway','Denmark','Iceland','Germany']);
});

test('uses the approved LeadIntel commercial mission copy', () => {
  const profile = engine.buildCompanyIntelligenceProfile({ website: 'https://example.com', targetMarkets, additionalLinks: [], documents: [], answers, scrapedSources: websiteSources });
  assert.equal(profile.mission, APPROVED_MISSION);
});

test('migrates a saved legacy profile to the approved LeadIntel mission without deleting profile data', () => {
  const state = engine.normalizeSavedState({
    website: 'https://example.com',
    targetMarkets:['Sweden'],
    approved: true,
    profile: {
      companyName: 'Example Industrial',
      mission: 'Find and prioritize manufacturers in Sweden that have evidence-backed reasons to buy.',
      priorityOffers: 'Industrial steel structures'
    }
  });
  assert.equal(state.profile.mission, APPROVED_MISSION);
  assert.equal(state.profile.companyName, 'Example Industrial');
  assert.equal(state.profile.priorityOffers, 'Industrial steel structures');
  assert.equal(state.approved, true);
});

test('infers current market footprint without confusing it with selected target markets', () => {
  const profile = engine.buildCompanyIntelligenceProfile({ website: 'https://example.com', targetMarkets, additionalLinks: [], documents: [], answers, scrapedSources: websiteSources });
  assert.deepEqual(profile.currentMarkets, ['Latvia', 'Estonia', 'Lithuania']);
  assert.equal(profile.targetMarkets, 'Nordics; Germany');
});

test('recommends signals from declared buying triggers', () => {
  const profile = engine.buildCompanyIntelligenceProfile({ website: 'https://example.com', targetMarkets, additionalLinks: [], documents: [], answers, scrapedSources: websiteSources });
  const names = profile.recommendedSignals.map(item => item.name);
  assert.ok(names.includes('Facility expansion or new site'));
  assert.ok(names.includes('Capital investment or modernization'));
  assert.ok(profile.recommendedSignals.every(item => ['High','Medium','Low'].includes(item.priority)));
});

test('includes extracted document text as evidence', () => {
  const profile = engine.buildCompanyIntelligenceProfile({
    website: 'https://example.com', targetMarkets, additionalLinks: [], answers,
    documents: [{name:'catalog.pdf', text:'Specialized robotic welding and CE-certified production for offshore structures.'}],
    scrapedSources: websiteSources
  });
  assert.ok(profile.sourceSummary.documents === 1);
  assert.match(profile.evidenceDigest, /robotic welding/i);
});

test('reports material information gaps instead of inventing answers', () => {
  const partial = {...answers, opportunity_value: '', buyer_roles: ''};
  const profile = engine.buildCompanyIntelligenceProfile({ website:'https://example.com', targetMarkets, additionalLinks:[], documents:[], answers:partial, scrapedSources: websiteSources });
  assert.ok(profile.informationGaps.some(x => /commercial value/i.test(x)));
  assert.ok(profile.informationGaps.some(x => /decision-maker/i.test(x)));
});

test('saved state normalization removes unknown fields and unsafe URLs', () => {
  const state = engine.normalizeSavedState({website:'javascript:evil()', targetMarkets:[' Sweden ','SWEDEN','Nordics'], additionalLinks:['example.com','javascript:x'], answers:{priority_offers:'A'}, rogue:'x'});
  assert.equal(state.website, '');
  assert.deepEqual(state.targetMarkets,['Sweden','Nordics']);
  assert.deepEqual(state.additionalLinks, ['https://example.com/']);
  assert.equal(state.answers.priority_offers, 'A');
  assert.equal(state.rogue, undefined);
});

test('company evidence treats www and apex hostnames as the same verified website', () => {
  const profile=engine.buildCompanyIntelligenceProfile({
    website:'https://www.example.com/',
    targetMarkets:['Sweden'],
    answers,
    documents:[],
    scrapedSources:[{type:'website',url:'https://example.com/',title:'Example Industrial',text:'Verified apex-domain company evidence for Swedish manufacturers.'}]
  });
  assert.equal(profile.sourceSummary.website,1);
  assert.match(profile.evidenceDigest,/Verified apex-domain company evidence/i);
});

test('saved state preserves the standard 25-page research envelope', () => {
  const scrapedSources=Array.from({length:20},(_,i)=>({type:'link',url:`https://example.com/page-${i}`,title:`Page ${i}`,text:`Evidence ${i}`,status:'ready'}));
  const state=engine.normalizeSavedState({website:'https://example.com/',targetMarkets:['Sweden'],scrapedSources});
  assert.equal(state.scrapedSources.length,20);
});

test('company overview strips Squarespace image/CDN debris and prefers real business evidence', () => {
  const noisySource=[{
    type:'website',
    url:'https://example.com/',
    title:'Example Advisory — Sales Training',
    text:'![Adobe Express file](https://images.squarespace-cdn.com/content/v1/example/Adobe+Express+-+file.png) (https://images.squarespace-cdn.com/content/v1/example/Screenshot+2025-01-11.png) TOOLS AND STRATEGIES Unlock Your Sales Potential! YOUR DAILY Example Advisory provides advanced B2B sales training, coaching and AI assistants for sales teams. Its programs help companies improve sales conversion and manager effectiveness.'
  }];
  const profile=engine.buildCompanyIntelligenceProfile({website:'https://example.com/',targetMarkets:['Latvia'],answers,documents:[],scrapedSources:noisySource});
  assert.doesNotMatch(profile.companyOverview,/https?:\/\/|squarespace-cdn|\.png/i);
  assert.doesNotMatch(profile.evidenceDigest,/https?:\/\/|squarespace-cdn|\.png/i);
  assert.match(profile.companyOverview,/provides advanced B2B sales training, coaching and AI assistants/i);
});

test('a single AJ Produkti product snippet is labelled narrow product evidence, not company-wide evidence', () => {
  const productText='Instrumentu skapis SUPPLY. Izturīgs metāla skapis efektīvai instrumentu un detaļu uzglabāšanai.';
  const profile=engine.buildCompanyIntelligenceProfile({
    website:'https://www.ajprodukti.lv/',
    targetMarkets:['Latvia'],
    answers:{...answers,priority_offers:'Biroja mēbeles un darba vides aprīkojums'},
    documents:[],
    scrapedSources:[{type:'website',url:'https://www.ajprodukti.lv/',title:'Instrumentu skapis SUPPLY',text:productText,status:'ready'}]
  });
  assert.equal(profile.evidenceSources.length,1);
  assert.equal(profile.evidenceSources[0].scope,'product');
  assert.equal(profile.evidenceSources[0].scopeLabel,'Limited product evidence');
  assert.deepEqual(profile.evidenceSources[0].supports,['Priority offer']);
  assert.equal(profile.evidenceCoverage.level,'limited');
  assert.match(profile.evidenceCoverage.message,/does not support the complete company profile/i);
});

test('saved profiles receive structured evidence records during normalization', () => {
  const state=engine.normalizeSavedState({
    website:'https://www.ajprodukti.lv/',
    targetMarkets:['Latvia'],
    scrapedSources:[{type:'website',url:'https://www.ajprodukti.lv/',title:'Instrumentu skapis SUPPLY',text:'Instrumentu skapis SUPPLY. Izturīgs metāla skapis efektīvai instrumentu un detaļu uzglabāšanai.',status:'ready'}],
    profile:{companyName:'AJ Produkti',evidenceDigest:'Instrumentu skapis SUPPLY Izturīgs metāla skapis efektīvai instrumentu un detaļu uzglabāšanai.'}
  });
  assert.equal(state.profile.evidenceSources[0].scope,'product');
  assert.equal(state.profile.evidenceCoverage.level,'limited');
});
