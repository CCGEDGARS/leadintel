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

function managedAsset(id = 'p'.repeat(43)) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) id = String(id || 'x').replace(/[^A-Za-z0-9_-]/g, 'x').slice(0, 1).repeat(43);
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
  const modelScript = html.indexOf('brand-identity.js?v=20260916-brand-timestamp-v1');
  const profileScript = html.indexOf('profile-engine.js?v=20260916-commercial-brief-v1');
  const uiScript = html.indexOf('brand-identity-ui.js?v=20260916-browser-logo-copy-v2');
  const appScript = html.indexOf('app.js?v=20260917-journey-v1');

  assert.ok(websitePanel >= 0 && websitePanel < identityModule && identityModule < targetMarket);
  assert.match(html, /Add your logo and sender details so outreach emails look consistent and personal\./);
  assert.match(html, /id="brand-identity-toggle"[^>]*aria-expanded="false"/);
  assert.match(html, /id="brand-identity-body"[^>]*hidden/);
  assert.match(html, /id="brand-identity-status"[^>]*>Not configured</);
  assert.match(html, /id="brand-identity-toggle"[^>]*>[\s\S]*Set up email identity/);
  assert.match(html, /brand-identity\.css\?v=20260916-brand-image-state-v1/);
  assert.ok(profileScript >= 0 && profileScript < modelScript && modelScript < uiScript && uiScript < appScript);
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

test('default extraction uses verified public evidence, rejects non-HTTPS, and returns no fabricated suggestions', async () => {
  const UI = require('../brand-identity-ui.js');
  await assert.rejects(
    UI.extractWebsiteSuggestions('http://acme.example/', {}),
    /valid HTTPS company website/i
  );
  assert.deepEqual(
    await UI.extractWebsiteSuggestions('https://acme.example/', {scrapedSources: []}),
    {}
  );

  const suggestions = await UI.extractWebsiteSuggestions('https://acme.example/', {
    profile: {companyName: 'Acme Evidence Ltd'},
    scrapedSources: [{
      type: 'website',
      status: 'ready',
      url: 'https://acme.example/',
      text: 'Contact our team on +371 20 000 000.',
      logoUrl: 'https://acme.example/assets/logo.png'
    }],
    additionalLinks: ['https://www.linkedin.com/company/acme-evidence']
  });
  assert.deepEqual(suggestions, {
    companyDisplayName: 'Acme Evidence Ltd',
    website: 'https://acme.example/',
    phone: '+371 20 000 000',
    linkedinUrl: 'https://www.linkedin.com/company/acme-evidence',
    logoUrl: 'https://acme.example/assets/logo.png'
  });
});

test('logo evidence remains a suggestion until explicit secure copy into managed storage', async () => {
  const UI = require('../brand-identity-ui.js');
  const calls = [];
  const managed = managedAsset('approved_logo');
  const controller = UI.createController({
    website: () => 'https://acme.example/',
    publicEvidence: () => ({
      profile: {companyName: 'Acme'},
      scrapedSources: [{
        type: 'website', status: 'ready', url: 'https://acme.example/', text: 'Acme',
        logoUrl: 'https://acme.example/logo.png'
      }]
    }),
    assetAdapter: {
      upload: async () => managed,
      import: async (kind, url) => { calls.push([kind, url]); return managed; },
      delete: async () => {}
    }
  });

  const suggestions = await controller.extractFromWebsite();
  assert.equal(suggestions.logoUrl, 'https://acme.example/logo.png');
  assert.equal(controller.identity().assets.logo, null);
  assert.deepEqual(calls, []);

  controller.applySuggestion('logoUrl');
  assert.equal(controller.identity().assets.logo, null);
  await controller.applyLogoSuggestion();
  assert.deepEqual(calls, [['logo', 'https://acme.example/logo.png']]);
  assert.equal(controller.identity().assets.logo.id, managed.id);
  assert.equal(controller.suggestions().logoUrl, 'https://acme.example/logo.png');

  const source = fs.readFileSync(path.join(ROOT, 'brand-identity-ui.js'), 'utf8');
  assert.match(source, /data-brand-logo-copy/);
  assert.match(source, /data-brand-logo-download/);
  assert.match(source, /Copy this same-site image into secure LeadIntel storage/);
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
    url: `https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/${next.id}`
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

test('file selection uses focusable buttons and complete field error and tab semantics', () => {
  const UIModel = require('../brand-identity.js');
  const ids = {
    companyDisplayName: 'brand-company-name', senderName: 'brand-sender-name',
    senderTitle: 'brand-sender-title', website: 'brand-website', phone: 'brand-phone',
    linkedinUrl: 'brand-linkedin', primaryColor: 'brand-primary-color-hex',
    signatureText: 'brand-signature', legalFooter: 'brand-legal-footer', postalAddress: 'brand-postal-address'
  };
  for (const [field, id] of Object.entries(ids)) {
    assert.match(html, new RegExp(`id="${id}"[^>]*maxlength="${UIModel.FIELD_LIMITS[field]}"[^>]*aria-describedby="${id}-error"[^>]*aria-invalid="false"`));
    assert.match(html, new RegExp(`id="${id}-error"[^>]*data-brand-error="${field}"[^>]*aria-live="polite"`));
  }
  for (const kind of ['logo', 'headshot', 'banner']) {
    assert.match(html, new RegExp(`<button[^>]*data-brand-file-trigger="${kind}"[^>]*aria-controls="brand-${kind}-input"[^>]*>Upload or replace</button>`));
    assert.match(html, new RegExp(`id="brand-${kind}-current"[^>]*role="status"[^>]*aria-live="polite"`));
    assert.doesNotMatch(html, new RegExp(`<label[^>]*for="brand-${kind}-input"[^>]*class="secondary-btn"`));
  }
  assert.match(html, /role="tablist"[^>]*aria-orientation="horizontal"/);
  for (const tab of ['desktop', 'mobile', 'plain']) {
    assert.match(html, new RegExp(`id="brand-preview-tab-${tab}"[^>]*role="tab"[^>]*aria-controls="brand-preview-frame"`));
  }
  assert.match(html, /id="brand-preview-frame"[^>]*role="tabpanel"[^>]*aria-labelledby="brand-preview-tab-desktop"/);
});

test('UI source hides stale preview, marks invalid fields, announces and focuses the first error', () => {
  const source = fs.readFileSync(path.join(ROOT, 'brand-identity-ui.js'), 'utf8');
  assert.match(source, /function hidePreview\(/);
  assert.match(source, /panel\.hidden\s*=\s*true/);
  assert.match(source, /setAttribute\('aria-invalid',\s*'true'\)/);
  assert.match(source, /firstInvalid.*\.focus\(\)/s);
  assert.match(source, /data-brand-file-trigger.*addEventListener\('click'/s);
  assert.match(source, /aria-labelledby.*brand-preview-tab-/s);
  assert.match(source, /No verified suggestions available yet/);
  assert.match(source, />Apply</);
  assert.match(source, /brand-action-error/);
});


test('managed image load failures become explicit accessible states and successful replacement clears them', () => {
  const source = fs.readFileSync(path.join(ROOT, 'brand-identity-ui.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'brand-identity.css'), 'utf8');

  assert.match(source, /ASSET_LABELS\s*=\s*Object\.freeze\(\{logo:\s*'Logo',\s*headshot:\s*'Headshot',\s*banner:\s*'Banner'\}\)/);
  assert.match(source, /\$\{label\} image unavailable\. Upload or replace it\./);
  assert.match(source, /addEventListener\('error',[\s\S]*renderAssetLoadState/);
  assert.match(source, /addEventListener\('load',[\s\S]*renderAssetLoadState/);
  assert.match(source, /function attachPreviewImageStatus\(/);
  assert.match(source, /Preview image unavailable/);
  assert.match(source, /output\.removeAttribute\('data-load-error'\)/);
  assert.match(css, /\.brand-asset-current\[data-load-error="true"\]/);
  assert.match(css, /\.brand-preview-image-status/);
});
