'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function readyIdentity(overrides = {}) {
  return {
    status: 'ready',
    revision: 3,
    companyDisplayName: 'Acme Manufacturing',
    senderName: 'Alex Morgan',
    senderTitle: 'Commercial Director',
    website: 'https://acme.example/',
    phone: '+371 20 000 000',
    linkedinUrl: 'https://www.linkedin.com/company/acme',
    primaryColor: '#0f6557',
    signatureText: 'Kind regards,',
    legalFooter: '',
    postalAddress: 'Riga, Latvia',
    options: {includeLogo: true, includeHeadshot: false, includeBanner: false},
    assets: {logo: null, headshot: null, banner: null},
    updatedAt: '2026-09-15T12:00:00.000Z',
    ...overrides
  };
}

function managedAsset(id = 'logo_previous') {
  return {
    id,
    url: `/api/customer/brand-assets/${id}`,
    mimeType: 'image/png',
    width: 280,
    height: 96,
    altText: 'Acme logo',
    updatedAt: '2026-09-15T12:00:00.000Z'
  };
}

test('Brand & Email Identity is collapsed immediately after Main company website with versioned dependencies', () => {
  const websitePanel = html.indexOf('<h3>Main company website</h3>');
  const identityModule = html.indexOf('id="brand-identity"');
  const targetMarket = html.indexOf('id="target-market-selector"');
  const modelScript = html.indexOf('brand-identity.js?v=20260915-brand-identity-v1');
  const uiScript = html.indexOf('brand-identity-ui.js?v=20260915-brand-identity-v1');
  const appScript = html.indexOf('app.js?v=20260915-brand-identity-v1');

  assert.ok(websitePanel >= 0 && websitePanel < identityModule && identityModule < targetMarket);
  assert.match(html, /Add your logo and sender details so outreach emails look consistent and personal\./);
  assert.match(html, /id="brand-identity-toggle"[^>]*aria-expanded="false"/);
  assert.match(html, /id="brand-identity-body"[^>]*hidden/);
  assert.match(html, /id="brand-identity-status"[^>]*>Not configured</);
  assert.match(html, /id="brand-identity-toggle"[^>]*>[\s\S]*Set up email identity/);
  assert.match(html, /brand-identity\.css\?v=20260915-brand-identity-v1/);
  assert.ok(modelScript >= 0 && modelScript < uiScript && uiScript < appScript);
});

test('expanded markup keeps every identity and asset control visibly labelled', () => {
  const labels = [
    ['brand-company-name', 'Company display name'],
    ['brand-sender-name', 'Sender name'],
    ['brand-sender-title', 'Sender job title'],
    ['brand-website', 'Company website'],
    ['brand-phone', 'Phone number'],
    ['brand-linkedin', 'LinkedIn URL'],
    ['brand-primary-color', 'Primary brand colour'],
    ['brand-primary-color-hex', 'Primary colour hex value'],
    ['brand-signature', 'Plain-text signature'],
    ['brand-legal-footer', 'Legal or footer text'],
    ['brand-postal-address', 'Postal address'],
    ['brand-logo-input', 'Logo'],
    ['brand-headshot-input', 'Sender headshot'],
    ['brand-banner-input', 'Promotional banner']
  ];

  for (const [id, copy] of labels) {
    assert.match(html, new RegExp(`<label[^>]*for="${id}"[^>]*>[\\s\\S]*?${copy}`));
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="brand-include-banner"[^>]*type="checkbox"(?![^>]*checked)/);
  assert.match(html, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /Extract from website/);
  assert.match(html, /Preview email/);
  assert.match(html, /Save brand identity/);
});

test('controller reports Not configured, Draft, and Ready without affecting Step 1 eligibility', () => {
  const UI = require('../brand-identity-ui.js');
  const empty = UI.createController();
  const draft = UI.createController({identity: {senderName: 'Alex'}});
  const ready = UI.createController({identity: readyIdentity()});

  assert.equal(empty.statusText(), 'Not configured');
  assert.equal(empty.ctaText(), 'Set up email identity');
  assert.equal(draft.statusText(), 'Draft');
  assert.equal(draft.ctaText(), 'Edit identity');
  assert.equal(ready.statusText(), 'Ready');
  assert.equal(ready.isStepOneBlocking(), false);
});

test('controller owns collapsed state and exposes deterministic toggle behavior', () => {
  const UI = require('../brand-identity-ui.js');
  const controller = UI.createController();

  assert.equal(controller.isExpanded(), false);
  assert.equal(controller.toggleExpanded(), true);
  assert.equal(controller.isExpanded(), true);
  assert.equal(controller.toggleExpanded(), false);
});

test('website extraction stores suggestions separately until a user applies one', async () => {
  const UI = require('../brand-identity-ui.js');
  const changes = [];
  const controller = UI.createController({
    identity: {senderName: 'Existing sender'},
    website: () => 'https://acme.example/',
    onChange: identity => changes.push(identity),
    extractSuggestions: async () => ({
      companyDisplayName: 'Acme Suggested',
      website: 'https://acme.example/',
      primaryColor: '#123456',
      logoUrl: 'https://acme.example/logo.png'
    })
  });

  const before = controller.identity();
  const suggestions = await controller.extractFromWebsite();

  assert.equal(suggestions.companyDisplayName, 'Acme Suggested');
  assert.deepEqual(controller.identity(), before);
  assert.equal(changes.length, 0);

  controller.applySuggestion('companyDisplayName');
  assert.equal(controller.identity().companyDisplayName, 'Acme Suggested');
  assert.equal(controller.identity().website, '');
  assert.equal(controller.statusText(), 'Draft');
  assert.equal(changes.length, 1);
});

test('failed asset replacement preserves the previous managed reference', async () => {
  const UI = require('../brand-identity-ui.js');
  const previous = managedAsset();
  const controller = UI.createController({
    identity: readyIdentity({assets: {logo: previous, headshot: null, banner: null}}),
    assetAdapter: {
      upload: async () => { throw new Error('Upload failed'); },
      import: async () => { throw new Error('Import failed'); },
      delete: async () => {}
    }
  });

  await assert.rejects(controller.replaceAsset('logo', {name: 'next.png'}), /Upload failed/);
  assert.equal(controller.identity().assets.logo.id, previous.id);
  assert.equal(controller.statusText(), 'Ready');
});

test('successful replacement persists approved metadata only, never image bytes or data URLs', async () => {
  const UI = require('../brand-identity-ui.js');
  const changes = [];
  const next = managedAsset('logo_next');
  const controller = UI.createController({
    identity: readyIdentity(),
    onChange: identity => changes.push(identity),
    assetAdapter: {
      upload: async () => ({...next, bytes: 'forbidden', dataUrl: 'data:image/png;base64,AAAA'}),
      import: async () => next,
      delete: async () => {}
    }
  });

  await controller.replaceAsset('logo', {name: 'next.png'});

  assert.deepEqual(controller.identity().assets.logo, {
    ...next,
    url: 'https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/logo_next'
  });
  assert.equal(controller.statusText(), 'Draft');
  assert.doesNotMatch(JSON.stringify(changes.at(-1)), /bytes|data:image|dataUrl/);
});

test('save returns field-keyed inline errors and activates only a valid identity', () => {
  const UI = require('../brand-identity-ui.js');
  const controller = UI.createController({
    identity: {
      companyDisplayName: '',
      senderName: '',
      website: 'http://unsafe.example',
      linkedinUrl: 'https://example.com/profile',
      phone: 'call me',
      primaryColor: '#fff'
    },
    now: () => '2026-09-15T21:00:00.000Z'
  });

  const invalid = controller.saveReady();
  assert.equal(invalid.valid, false);
  assert.deepEqual(Object.keys(invalid.errors).sort(), [
    'companyDisplayName',
    'linkedinUrl',
    'phone',
    'primaryColor',
    'senderName',
    'website'
  ]);
  assert.notEqual(controller.statusText(), 'Ready');

  controller.updateField('companyDisplayName', 'Acme');
  controller.updateField('senderName', 'Alex');
  controller.updateField('website', 'https://acme.example/');
  controller.updateField('linkedinUrl', '');
  controller.updateField('phone', '');
  controller.updateField('primaryColor', '#123456');
  const valid = controller.saveReady();

  assert.equal(valid.valid, true);
  assert.equal(controller.statusText(), 'Ready');
  assert.equal(controller.identity().revision, 2);
  assert.equal(controller.identity().updatedAt, '2026-09-15T21:00:00.000Z');
});

test('preview tabs support arrows, Home, and End and share rendered content', () => {
  const UI = require('../brand-identity-ui.js');
  const controller = UI.createController({identity: readyIdentity()});

  assert.equal(controller.activeTab(), 'desktop');
  assert.equal(controller.handleTabKey('ArrowRight'), 'mobile');
  assert.equal(controller.handleTabKey('ArrowRight'), 'plain');
  assert.equal(controller.handleTabKey('ArrowRight'), 'desktop');
  assert.equal(controller.handleTabKey('ArrowLeft'), 'plain');
  assert.equal(controller.handleTabKey('Home'), 'desktop');
  assert.equal(controller.handleTabKey('End'), 'plain');
  assert.equal(controller.handleTabKey('Space'), 'plain');

  const desktop = controller.preview('desktop');
  const mobile = controller.preview('mobile');
  const plain = controller.preview('plain');
  assert.equal(desktop.content, mobile.content);
  assert.match(desktop.content, /Acme Manufacturing/);
  assert.match(plain.content, /Alex Morgan/);
  assert.equal(desktop.viewport, 'desktop');
  assert.equal(mobile.viewport, 'mobile');
  assert.equal(plain.contentType, 'text/plain');
});

test('mobile stylesheet stacks controls and prevents preview page overflow', () => {
  const css = fs.readFileSync(path.join(ROOT, 'brand-identity.css'), 'utf8');

  assert.match(html, /class="brand-identity-fields"/);
  assert.match(html, /class="brand-preview-frame"/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /\.brand-identity-fields\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.brand-preview-frame\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto/s);
});
