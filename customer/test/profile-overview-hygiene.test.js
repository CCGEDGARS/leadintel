const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../profile-engine.js');

const noisyEvidence = '![Hero](https://images.squarespace-cdn.com/content/v1/example/hero.png) (https://images.squarespace-cdn.com/content/v1/example/Screenshot.png) Example Advisory provides advanced B2B sales training, coaching and AI assistants for sales teams. Its programs help companies improve sales conversion and manager effectiveness.';
const erconNavigationContamination = 'Ercon Home About us Manufacturing Serial production Projects manufacturing Engineering Workforce Solutions Quality Gallery Contacts en lv Your partner in Industry solutions . ERCON is a Latvian company with international experience ERCON is an international company specializing in manufacturing, project development, and installation services.';

test('company overview removes a concatenated navigation menu and repeated company intro', () => {
  const state=engine.buildCompanyIntelligenceProfile({
    website:'https://ercon.lv/',
    targetMarkets:['Latvia'],
    scrapedSources:[{type:'website',url:'https://ercon.lv/',title:'ERCON',text:erconNavigationContamination,status:'ready'}]
  });
  assert.equal(state.companyOverview,'ERCON is an international company specializing in manufacturing, project development, and installation services.');
  assert.doesNotMatch(state.companyOverview,/Home|About us|Gallery|international company with international experience/i);
});

test('saved overview containing a concatenated navigation menu is regenerated', () => {
  const state=engine.normalizeSavedState({
    website:'https://ercon.lv/',
    targetMarkets:['Latvia'],
    scrapedSources:[{type:'website',url:'https://ercon.lv/',title:'ERCON',text:erconNavigationContamination,status:'ready'}],
    profile:{companyName:'ERCON',companyOverview:erconNavigationContamination,evidenceDigest:'Clean evidence summary.'}
  });
  assert.equal(state.profile.companyOverview,'ERCON is an international company specializing in manufacturing, project development, and installation services.');
});

test('saved polluted company overview is regenerated from clean persisted evidence on load', () => {
  const state=engine.normalizeSavedState({
    website:'https://example.com/',
    targetMarkets:['Latvia'],
    scrapedSources:[{type:'website',url:'https://example.com/',title:'Example Advisory',text:noisyEvidence,status:'ready'}],
    profile:{
      companyName:'Example Advisory',
      companyOverview:'(https://images.squarespace-cdn.com/content/v1/example/Screenshot.png) TOOLS AND STRATEGIES Unlock Your Sales Potential!',
      evidenceDigest:'https://images.squarespace-cdn.com/content/v1/example/hero.png',
      mission:'legacy mission'
    }
  });
  assert.doesNotMatch(state.profile.companyOverview,/https?:\/\/|squarespace-cdn|\.png/i);
  assert.doesNotMatch(state.profile.evidenceDigest,/https?:\/\/|squarespace-cdn|\.png/i);
  assert.match(state.profile.companyOverview,/provides advanced B2B sales training, coaching and AI assistants/i);
});

test('saved legitimate human-edited company overview is preserved', () => {
  const edited='Example Advisory is a specialist B2B sales training company serving leadership and commercial teams across Europe.';
  const state=engine.normalizeSavedState({
    website:'https://example.com/',
    targetMarkets:['Latvia'],
    scrapedSources:[{type:'website',url:'https://example.com/',title:'Example Advisory',text:noisyEvidence,status:'ready'}],
    profile:{companyName:'Example Advisory',companyOverview:edited,evidenceDigest:'Clean evidence summary.',mission:'legacy mission'}
  });
  assert.equal(state.profile.companyOverview,edited);
});
