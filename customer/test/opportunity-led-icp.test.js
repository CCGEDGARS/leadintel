const test=require('node:test');
const assert=require('node:assert/strict');
const Market=require('../market-engine.js');
const Opportunity=require('../opportunity-led-icp.js');

const profile={
  priorityOffers:'sales training; AI sales systems',
  idealCustomer:'B2B companies with active sales teams',
  lookalikeCustomers:'Mercedes; Toyota; Apple; IKEA',
  decisionMakers:'CEO; Founder; Sales Director',
  currentMarkets:['Latvia'],
  targetMarkets:'Latvia',
  buyingTriggers:'sales transformation; AI adoption; expansion',
  exclusions:'consumer-only businesses',
  opportunityValue:'€20,000+ annual potential'
};

test('opportunity-led extension adds a fourth ICP and completes the desktop 2x2 strategy set',()=>{
  const api=Opportunity.install(Market);
  const icps=api.buildIcpCandidates(profile,'en');
  assert.deepEqual(icps.map(item=>item.type),['core','lookalike','trigger-led','opportunity-led']);
  assert.equal(icps.length,4);
  const opportunity=icps[3];
  assert.equal(opportunity.id,'icp-opportunity-led');
  assert.equal(opportunity.name,'Opportunity-led ICP');
  assert.match(opportunity.description,/specific commercial opportunity/i);
  assert.match(opportunity.rationale,/market evidence/i);
  assert.equal(opportunity.active,false);
  assert.equal(opportunity.opportunityDataAvailable,false);
});

test('opportunity-led cannot activate without a selected evidence-backed market opportunity',()=>{
  assert.equal(Opportunity.hasVerifiedOpportunity([]),false);
  assert.equal(Opportunity.hasVerifiedOpportunity([{active:true,profileOnly:true,evidence:[]}]),false);
  assert.equal(Opportunity.hasVerifiedOpportunity([{active:false,profileOnly:false,evidence:[{url:'https://example.com'}]}]),false);
  assert.equal(Opportunity.hasVerifiedOpportunity([{active:true,profileOnly:false,evidence:[{url:'https://example.com'}]}]),true);
});

test('localization removes stale activation until real opportunity evidence exists',()=>{
  const api=Opportunity.install(Market);
  const stale={...Opportunity.buildOpportunityIcp(profile,'en'),active:true};
  const unavailable=api.localizeGeneratedState({icps:[stale],opportunities:[]},profile,'en').icps.find(item=>item.type==='opportunity-led');
  assert.equal(unavailable.active,false);
  assert.equal(unavailable.opportunityDataAvailable,false);
  const available=api.localizeGeneratedState({icps:[stale],opportunities:[{id:'opp-latvia',market:'Latvia',active:true,profileOnly:false,evidence:[{url:'https://example.com'}]}]},profile,'en').icps.find(item=>item.type==='opportunity-led');
  assert.equal(available.active,true);
  assert.equal(available.opportunityDataAvailable,true);
});

test('opportunity-led ICP has native Latvian copy',()=>{
  const api=Opportunity.install(Market);
  const opportunity=api.buildIcpCandidates(profile,'lv').find(item=>item.type==='opportunity-led');
  assert.equal(opportunity.name,'Iespēju vadīts profils');
  assert.match(opportunity.description,/konkrētu komerciālu iespēju/i);
  assert.match(opportunity.rationale,/tirgus dati|uzņēmuma attīstība/i);
});

test('four ICPs survive normalization, reload and language localization',()=>{
  const api=Opportunity.install(Market);
  const seeded=api.buildIcpCandidates(profile,'en');
  const normalized=api.normalizeMarketState({icps:seeded});
  assert.equal(normalized.icps.length,4);
  assert.equal(normalized.icps.at(-1).type,'opportunity-led');
  const localized=api.localizeGeneratedState(normalized,profile,'lv');
  assert.equal(localized.icps.length,4);
  assert.equal(localized.icps.at(-1).name,'Iespēju vadīts profils');
});

test('opportunity-led remains available even when no lookalike anchors exist',()=>{
  const api=Opportunity.install(Market);
  const icps=api.buildIcpCandidates({...profile,lookalikeCustomers:''},'en');
  assert.deepEqual(icps.map(item=>item.type),['core','trigger-led','opportunity-led']);
});
