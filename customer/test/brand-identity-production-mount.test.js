'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Profile = require('../profile-engine.js');
const BrandIdentityUI = require('../brand-identity-ui.js');

test('production Brand Identity mount supplies a fresh public-only evidence snapshot', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const evidenceFunction = app.match(/function brandIdentityPublicEvidence\(\)\{[\s\S]*?\n\}/);
  const mountFunction = app.match(/function initBrandIdentity\(\)\{[\s\S]*?\n\}/);
  assert.ok(evidenceFunction, 'brandIdentityPublicEvidence should be present');
  assert.ok(mountFunction, 'initBrandIdentity should be present');

  const state = {
    website: 'https://acme.example/',
    brandIdentity: {status: 'draft'},
    profile: {
      companyName: 'Acme Evidence Ltd',
      phone: '+371 20 000 000',
      primaryColor: '#123456',
      privateNotes: 'must not leave state'
    },
    scrapedSources: [{
      url: 'https://acme.example/', status: 'ready', title: 'Acme', text: 'Public copy',
      logoUrl: 'https://acme.example/logo.png', internalToken: 'must not leave state',
      metadata: {logoUrl: 'https://acme.example/logo.png', secret: 'must not leave state'}
    }],
    additionalLinks: ['https://www.linkedin.com/company/acme', 'javascript:alert(1)'],
    websiteActivation: {logoUrl: 'https://acme.example/mark.png', accessToken: 'must not leave state'}
  };
  const context = {
    __state: state,
    __mountOptions: null,
    URL,
    LeadIntelBrandIdentityUI: {
      mount(options) { context.__mountOptions = options; return {sync() {}}; }
    },
    LeadIntelBrandIdentity: {normalize(value) { return value; }}
  };
  context.globalThis = context;
  vm.runInNewContext(
    `let state=globalThis.__state; let brandIdentityUI=null;\n${evidenceFunction[0]}\n${mountFunction[0]}\ninitBrandIdentity();`,
    context,
    {filename: 'app.js'}
  );

  assert.equal(typeof context.__mountOptions.getPublicEvidence, 'function');
  const first = context.__mountOptions.getPublicEvidence();
  assert.deepEqual(JSON.parse(JSON.stringify(first)), {
    profile: {companyName: 'Acme Evidence Ltd', phone: '+371 20 000 000', primaryColor: '#123456'},
    scrapedSources: [{
      url: 'https://acme.example/', status: 'ready', title: 'Acme', text: 'Public copy',
      logoUrl: 'https://acme.example/logo.png', metadata: {logoUrl: 'https://acme.example/logo.png'}
    }],
    additionalLinks: ['https://www.linkedin.com/company/acme'],
    websiteActivation: {logoUrl: 'https://acme.example/mark.png'}
  });
  first.profile.companyName = 'Mutated';
  assert.equal(context.__mountOptions.getPublicEvidence().profile.companyName, 'Acme Evidence Ltd');
  assert.equal(state.profile.companyName, 'Acme Evidence Ltd');
});

test('normal Firecrawl scrape branding survives saved state and becomes verified extraction suggestions', async () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const scrapeFunction = app.match(/async function scrapeSource\(url,type\)\{[\s\S]*?\n\}/);
  const evidenceFunction = app.match(/function brandIdentityPublicEvidence\(\)\{[\s\S]*?\n\}/);
  const mountFunction = app.match(/function initBrandIdentity\(\)\{[\s\S]*?\n\}/);
  assert.ok(scrapeFunction && evidenceFunction && mountFunction);

  const context = {
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async () => ({
      ok: true,
      async json() {
        return {
          data: {
            markdown: 'Acme manufactures industrial equipment for European buyers.',
            metadata: {
              title: 'Acme Industrial',
              logoUrl: 'data:image/png;base64,AAAA',
              ogImage: 'https://acme.example/assets/logo.png',
              primaryColor: 'red',
              themeColor: '#12Ab34',
              arbitraryPrivateMetadata: 'must not be persisted'
            }
          }
        };
      }
    })
  };
  context.globalThis = context;
  vm.runInNewContext(
    `const FIRECRAWL_PROXY='https://proxy.example'; const ANALYSIS_SOURCE_TIMEOUT_MS=25000;\n${scrapeFunction[0]}\nglobalThis.__scrapeSource=scrapeSource;`,
    context,
    {filename: 'app.js'}
  );
  const scraped = await context.__scrapeSource('https://acme.example/', 'website');
  assert.deepEqual(JSON.parse(JSON.stringify(scraped)), {
    type: 'website',
    url: 'https://acme.example/',
    title: 'Acme Industrial',
    text: 'Acme manufactures industrial equipment for European buyers.',
    status: 'ready',
    logoUrl: 'https://acme.example/assets/logo.png',
    primaryColor: '#12ab34'
  });
  assert.doesNotMatch(JSON.stringify(scraped), /data:image|arbitraryPrivateMetadata/);

  const base = Profile.normalizeSavedState({
    step: 3,
    website: 'https://acme.example/',
    targetMarkets: ['Latvia'],
    additionalLinks: [],
    documents: [],
    answers: {},
    scrapedSources: [scraped],
    profile: null,
    approved: false
  });
  const built = Profile.buildCompanyIntelligenceProfile(base);
  const saved = Profile.normalizeSavedState({...base, profile: built});
  assert.equal(saved.scrapedSources[0].logoUrl, 'https://acme.example/assets/logo.png');
  assert.equal(saved.scrapedSources[0].primaryColor, '#12ab34');
  assert.equal(saved.profile.logoUrl, 'https://acme.example/assets/logo.png');
  assert.equal(saved.profile.primaryColor, '#12ab34');

  context.__state = saved;
  context.__mountOptions = null;
  context.LeadIntelBrandIdentityUI = {mount(options) { context.__mountOptions = options; return {sync() {}}; }};
  context.LeadIntelBrandIdentity = {normalize(value) { return value; }};
  vm.runInNewContext(
    `let state=globalThis.__state; let brandIdentityUI=null;\n${evidenceFunction[0]}\n${mountFunction[0]}\ninitBrandIdentity();`,
    context,
    {filename: 'app.js'}
  );
  const suggestions = await BrandIdentityUI.extractWebsiteSuggestions(
    saved.website,
    context.__mountOptions.getPublicEvidence()
  );
  assert.equal(suggestions.logoUrl, 'https://acme.example/assets/logo.png');
  assert.equal(suggestions.primaryColor, '#12ab34');
});
