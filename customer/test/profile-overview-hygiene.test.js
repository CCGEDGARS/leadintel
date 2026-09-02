const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../profile-engine.js');

const noisyEvidence = '![Hero](https://images.squarespace-cdn.com/content/v1/example/hero.png) (https://images.squarespace-cdn.com/content/v1/example/Screenshot.png) Example Advisory provides advanced B2B sales training, coaching and AI assistants for sales teams. Its programs help companies improve sales conversion and manager effectiveness.';

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