const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../profile-engine.js');

const answers = {
  priority_offers: 'Industrial steel structures; custom fabrication',
  ideal_customer: 'Manufacturers with 50-500 employees in Northern Europe',
  lookalike_customers: 'ABB; Valmet',
  buyer_roles: 'Procurement Director; Production Director; CEO',
  growth_markets: 'Sweden; Finland; Germany',
  differentiation: 'Fast engineering, custom production, reliable delivery',
  buying_triggers: 'New factory; capacity expansion; equipment modernization',
  exclusions: 'Projects below EUR 20,000; private consumers',
  opportunity_value: 'EUR 50,000-250,000',
  success_outcome: 'Build a EUR 2M qualified pipeline in 12 months'
};

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

test('website alone unlocks every customer module after Step 1', () => {
  const websiteOnly = {website: 'example.com', answers: {}};
  assert.equal(engine.canBuildProfile(websiteOnly), true);
  for(let step=1; step<=7; step++) assert.equal(engine.canAccessModule(websiteOnly, step), true);
  const empty = {website: '', answers: {}};
  assert.equal(engine.canAccessModule(empty, 1), true);
  for(let step=2; step<=7; step++) assert.equal(engine.canAccessModule(empty, step), false);
});

test('saved state preserves an unlocked module position through Step 7', () => {
  assert.equal(engine.normalizeSavedState({step:7,website:'example.com'}).step, 7);
});

test('calculates a high completeness score when strategic intake is complete', () => {
  const score = engine.calculateCompleteness({ website: 'https://example.com', additionalLinks: ['https://example.com/cases'], documents: [{name:'catalog.pdf', text:'catalog'}], answers });
  assert.equal(score, 100);
});

test('keeps strategic user answers authoritative over website inference', () => {
  const profile = engine.buildCompanyIntelligenceProfile({ website: 'https://example.com', additionalLinks: [], documents: [], answers, scrapedSources: websiteSources });
  assert.equal(profile.priorityOffers, answers.priority_offers);
  assert.equal(profile.targetMarkets, answers.growth_markets);
});

test('uses the approved LeadIntel commercial mission copy', () => {
  const profile = engine.buildCompanyIntelligenceProfile({ website: 'https://example.com', additionalLinks: [], documents: [], answers, scrapedSources: websiteSources });
  assert.equal(profile.mission, 'Find qualified B2B opportunities, connect with decision-makers, and close more deals through evidence-backed commercial intelligence.');
});

test('infers current market footprint from source text without overriding target markets', () => {
  const profile = engine.buildCompanyIntelligenceProfile({ website: 'https://example.com', additionalLinks: [], documents: [], answers, scrapedSources: websiteSources });
  assert.deepEqual(profile.currentMarkets, ['Latvia', 'Estonia', 'Lithuania']);
  assert.equal(profile.targetMarkets, 'Sweden; Finland; Germany');
});

test('recommends signals from declared buying triggers', () => {
  const profile = engine.buildCompanyIntelligenceProfile({ website: 'https://example.com', additionalLinks: [], documents: [], answers, scrapedSources: websiteSources });
  const names = profile.recommendedSignals.map(item => item.name);
  assert.ok(names.includes('Facility expansion or new site'));
  assert.ok(names.includes('Capital investment or modernization'));
  assert.ok(profile.recommendedSignals.every(item => ['High','Medium','Low'].includes(item.priority)));
});

test('includes extracted document text as evidence', () => {
  const profile = engine.buildCompanyIntelligenceProfile({
    website: 'https://example.com', additionalLinks: [], answers,
    documents: [{name:'catalog.pdf', text:'Specialized robotic welding and CE-certified production for offshore structures.'}],
    scrapedSources: websiteSources
  });
  assert.ok(profile.sourceSummary.documents === 1);
  assert.match(profile.evidenceDigest, /robotic welding/i);
});

test('reports material information gaps instead of inventing answers', () => {
  const partial = {...answers, opportunity_value: '', buyer_roles: ''};
  const profile = engine.buildCompanyIntelligenceProfile({ website:'https://example.com', additionalLinks:[], documents:[], answers:partial, scrapedSources: websiteSources });
  assert.ok(profile.informationGaps.some(x => /commercial value/i.test(x)));
  assert.ok(profile.informationGaps.some(x => /decision-maker/i.test(x)));
});

test('saved state normalization removes unknown fields and unsafe URLs', () => {
  const state = engine.normalizeSavedState({website:'javascript:evil()', additionalLinks:['example.com','javascript:x'], answers:{priority_offers:'A'}, rogue:'x'});
  assert.equal(state.website, '');
  assert.deepEqual(state.additionalLinks, ['https://example.com/']);
  assert.equal(state.answers.priority_offers, 'A');
  assert.equal(state.rogue, undefined);
});