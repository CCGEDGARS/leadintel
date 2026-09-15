'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
