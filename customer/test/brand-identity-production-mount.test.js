'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Profile = require('../profile-engine.js');
const BrandIdentityUI = require('../brand-identity-ui.js');

function senderMigrationFixture(saved, {ready=true}={}) {
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  let raw=typeof saved==='string'?saved:JSON.stringify(saved),writes=0;
  const state={profile:{companyName:'Unpersisted profile'},market:{researchSourceTypes:['news']},brandIdentity:{senderName:'Stale sender'}};
  const context={state,window:{LeadIntelAccountCache:{},LeadIntelServerBridge:{ready},dispatchEvent(){}},CustomEvent:class{},STORAGE_KEY:'main',brandIdentityUI:null,
    localStorage:{getItem:()=>raw,setItem:(key,value)=>{raw=value;writes++;}},
    LeadIntelBrandIdentityUI:{mount:()=>({sync(){}})},LeadIntelBrandIdentity:require('../brand-identity.js'),LeadIntelSenderIdentityLocation:require('../sender-identity-location.js'),
    brandIdentityPublicEvidence(){},updateCompleteness(){},updateNavigationAvailability(){},showToast(){},saveState(){throw Error('Migration must not save unrelated application state');}};
  vm.runInNewContext(app.match(/function initBrandIdentity\(\)\{[\s\S]*?\n\}/)[0]+'\ninitBrandIdentity();',context);
  return {initialize:essentials=>context.LeadIntelSenderIdentity.initialize(essentials),state,read:()=>raw,writes:()=>writes};
}

test('late sender migration owns only sender fields and preserves the latest saved strategy',()=>{
  const saved={website:'https://saved.example',profile:{companyName:'Saved company'},market:{icps:[{id:'retained'}]},answers:{buyer_roles:'Buyer'},brandIdentity:{companyDisplayName:'Latest company',phone:'+371 20000000'}};
  const h=senderMigrationFixture(saved);h.initialize({sender:'Robin Lane',company:'Old company',senderRole:'Owner'});
  const result=JSON.parse(h.read()),{brandIdentity,senderIdentityVersion,...other}=result;
  assert.deepEqual(other,Object.fromEntries(Object.entries(saved).filter(([key])=>key!=='brandIdentity')));
  assert.equal(brandIdentity.senderName,'Robin Lane');assert.equal(brandIdentity.companyDisplayName,'Latest company');assert.equal(brandIdentity.phone,saved.brandIdentity.phone);assert.equal(senderIdentityVersion,1);
  assert.equal(h.state.profile.companyName,'Unpersisted profile');assert.equal(h.state.senderIdentityVersion,1);
  h.initialize({sender:'Different sender'});assert.equal(h.writes(),1,'migration is durable and runs only once');
});

test('sender migration waits for account readiness and never replaces invalid or already migrated storage',()=>{
  for(const [saved,ready] of [[{},false],['{invalid',true],['[]',true],[{senderIdentityVersion:1,brandIdentity:{senderName:''}},true]]){
    const h=senderMigrationFixture(saved,{ready}),before=h.read();h.initialize({sender:'Old sender'});assert.equal(h.read(),before);assert.equal(h.writes(),0);
  }
});

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
  assert.ok(Number.isFinite(Date.parse(scraped.extractedAt)), 'a successful scrape records its actual read time');
  assert.deepEqual(JSON.parse(JSON.stringify(scraped)), {
    type: 'website',
    url: 'https://acme.example/',
    title: 'Acme Industrial',
    text: 'Acme manufactures industrial equipment for European buyers.',
    status: 'ready',
    extracted: true,
    sourceRead: true,
    evidenceKind: 'page_read',
    extractedAt: scraped.extractedAt,
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
  assert.equal(saved.scrapedSources[0].sourceRead, true);
  assert.equal(saved.scrapedSources[0].extracted, true);
  assert.equal(saved.scrapedSources[0].evidenceKind, 'page_read');
  assert.equal(saved.scrapedSources[0].extractedAt, scraped.extractedAt);
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
