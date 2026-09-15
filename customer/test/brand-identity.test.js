'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BrandIdentity = require('../brand-identity.js');

const readyIdentity = {
  schemaVersion: 1,
  status: 'ready',
  revision: 7,
  companyDisplayName: 'Acme & Partners',
  senderName: 'Alex & Co',
  senderTitle: 'Sales <Lead>',
  website: 'https://acme.example/',
  phone: '+371 20 000 000',
  linkedinUrl: 'https://www.linkedin.com/company/acme',
  primaryColor: '#0f6557',
  signatureText: 'Regards & thanks,',
  legalFooter: 'Private & confidential',
  postalAddress: 'Riga <LV>',
  options: {
    includeLogo: true,
    includeHeadshot: false,
    includeBanner: false
  },
  assets: {
    logo: {
      id: 'logo_01',
      url: '/api/customer/brand-assets/logo_01',
      mimeType: 'image/png',
      width: 280,
      height: 96,
      altText: 'Acme "primary" logo',
      updatedAt: '2026-09-15T12:00:00.000Z'
    },
    headshot: null,
    banner: null
  },
  updatedAt: '2026-09-15T12:00:00.000Z'
};

test('normalize returns the literal version 1 identity state without retaining unknown data', () => {
  assert.deepEqual(BrandIdentity.normalize({trackingPixel: 'https://tracker.example/pixel'}), {
    schemaVersion: 1,
    status: 'draft',
    revision: 1,
    companyDisplayName: '',
    senderName: '',
    senderTitle: '',
    website: '',
    phone: '',
    linkedinUrl: '',
    primaryColor: '#0f6557',
    signatureText: '',
    legalFooter: '',
    postalAddress: '',
    options: {
      includeLogo: true,
      includeHeadshot: false,
      includeBanner: false
    },
    assets: {
      logo: null,
      headshot: null,
      banner: null
    },
    updatedAt: ''
  });
});

test('validate blocks a ready identity with missing sender fields or invalid optional contact values', () => {
  const result = BrandIdentity.validate({
    status: 'ready',
    companyDisplayName: ' ',
    senderName: '',
    website: 'http://example.com',
    linkedinUrl: 'https://example.com/not-linkedin',
    phone: 'call-me',
    primaryColor: '#fff'
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, {
    companyDisplayName: 'Company display name is required when identity is ready.',
    senderName: 'Sender name is required when identity is ready.',
    website: 'Website must be a valid HTTPS URL.',
    phone: 'Phone number is invalid.',
    linkedinUrl: 'LinkedIn URL must be a valid HTTPS linkedin.com URL.',
    primaryColor: 'Primary brand colour must be a six-digit hex value.'
  });
});

test('safeAssetReference keeps only approved metadata and rejects data, remote, and mismatched URLs', () => {
  const source = {
    id: 'logo_01',
    url: '/api/customer/brand-assets/logo_01',
    mimeType: 'image/png',
    width: 280,
    height: 96,
    altText: 'Acme logo',
    updatedAt: '2026-09-15T12:00:00.000Z',
    originalFilename: 'customer-name-logo.png',
    bytes: 'not allowed'
  };

  assert.deepEqual(BrandIdentity.safeAssetReference(source), {
    id: 'logo_01',
    url: '/api/customer/brand-assets/logo_01',
    mimeType: 'image/png',
    width: 280,
    height: 96,
    altText: 'Acme logo',
    updatedAt: '2026-09-15T12:00:00.000Z'
  });
  assert.equal(BrandIdentity.safeAssetReference({...source, url: 'data:image/png;base64,AAAA'}), null);
  assert.equal(BrandIdentity.safeAssetReference({...source, url: 'https://images.example/logo_01'}), null);
  assert.equal(BrandIdentity.safeAssetReference({...source, url: '/api/customer/brand-assets/different'}), null);
  assert.equal(BrandIdentity.safeAssetReference({...source, mimeType: 'image/svg+xml'}), null);
});

test('renderEmail escapes every HTML value while preserving an equivalent literal plain-text part', () => {
  const rendered = BrandIdentity.renderEmail({
    subject: 'A <safe> subject',
    bodyText: 'Hello <Jamie> & team,\n\nSee "Q4" plans.',
    brandSnapshot: readyIdentity,
    recipientContext: {name: '<ignored>'}
  });

  assert.equal(rendered.subject, 'A <safe> subject');
  assert.equal(rendered.textBody, [
    'Hello <Jamie> & team,',
    '',
    'See "Q4" plans.',
    '',
    'Regards & thanks,',
    'Alex & Co',
    'Sales <Lead>',
    'Acme & Partners',
    '+371 20 000 000',
    'https://acme.example/',
    'LinkedIn: https://www.linkedin.com/company/acme',
    'Riga <LV>',
    '',
    'Private & confidential'
  ].join('\n'));
  assert.match(rendered.htmlBody, /width="600"/);
  assert.match(rendered.htmlBody, /Hello &lt;Jamie&gt; &amp; team/);
  assert.match(rendered.htmlBody, /See &quot;Q4&quot; plans\./);
  assert.match(rendered.htmlBody, /Alex &amp; Co/);
  assert.match(rendered.htmlBody, /Sales &lt;Lead&gt;/);
  assert.match(rendered.htmlBody, /Riga &lt;LV&gt;/);
  assert.match(rendered.htmlBody, /alt="Acme &quot;primary&quot; logo"/);
  assert.match(rendered.htmlBody, /href="https:\/\/acme\.example\/"/);
  assert.doesNotMatch(rendered.htmlBody, /<Jamie>|<Lead>|<ignored>|recipientContext|<script/i);
});

test('renderEmail keeps legacy and draft messages plain text without changing their content', () => {
  const input = {
    subject: 'Legacy subject',
    bodyText: 'Legacy body\nwith exact spacing.  ',
    brandSnapshot: {status: 'draft', senderName: 'Draft sender'}
  };

  assert.deepEqual(BrandIdentity.renderEmail(input), {
    subject: 'Legacy subject',
    textBody: 'Legacy body\nwith exact spacing.  ',
    htmlBody: null
  });
});

test('snapshot is a deeply immutable copy that cannot change after source mutation', () => {
  const source = structuredClone(readyIdentity);
  const approved = BrandIdentity.snapshot(source);

  source.companyDisplayName = 'Changed company';
  source.options.includeLogo = false;
  source.assets.logo.altText = 'Changed logo';

  assert.equal(approved.companyDisplayName, 'Acme & Partners');
  assert.equal(approved.options.includeLogo, true);
  assert.equal(approved.assets.logo.altText, 'Acme "primary" logo');
  assert.equal(Object.isFrozen(approved), true);
  assert.equal(Object.isFrozen(approved.options), true);
  assert.equal(Object.isFrozen(approved.assets.logo), true);
  assert.throws(() => { approved.assets.logo.altText = 'Mutation'; }, TypeError);
  assert.throws(
    () => BrandIdentity.snapshot({...readyIdentity, senderName: ''}),
    /valid ready brand identity/
  );
});

test('module exposes the same API through the browser global', () => {
  const filename = path.join(__dirname, '..', 'brand-identity.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context = {globalThis: {}};
  vm.runInNewContext(source, context, {filename});

  assert.deepEqual(
    Object.keys(context.globalThis.LeadIntelBrandIdentity).sort(),
    ['normalize', 'renderEmail', 'safeAssetReference', 'snapshot', 'validate']
  );
});
