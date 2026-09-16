'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BrandIdentity = require('../brand-identity.js');
const LOGO_ID = 'l'.repeat(43);
const HEADSHOT_ID = 'h'.repeat(43);
const BANNER_ID = 'b'.repeat(43);

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
      id: LOGO_ID,
      url: '/api/customer/brand-assets/' + LOGO_ID,
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

test('top-level updatedAt accepts only canonical ISO-8601 while legacy drafts migrate safely', () => {
  const legacyDraft = BrandIdentity.normalize({status: 'draft', senderName: 'Legacy sender'});
  assert.equal(legacyDraft.status, 'draft');
  assert.equal(legacyDraft.updatedAt, '');
  assert.equal(BrandIdentity.validate(legacyDraft).valid, true);

  for (const invalid of [
    'not-a-date',
    '2026-02-29T12:00:00.000Z',
    '2026-09-15T12:00:00+00:00',
    '2026-09-15'
  ]) {
    const normalized = BrandIdentity.normalize({...readyIdentity, updatedAt: invalid});
    assert.equal(normalized.updatedAt, '', invalid);
    const result = BrandIdentity.validate({...readyIdentity, updatedAt: invalid});
    assert.equal(result.valid, false, invalid);
    assert.equal(result.errors.updatedAt, 'Updated time must be a valid ISO-8601 timestamp.');
  }

  assert.equal(BrandIdentity.normalize(readyIdentity).updatedAt, '2026-09-15T12:00:00.000Z');
  assert.equal(BrandIdentity.validate(readyIdentity).valid, true);
});

test('validate blocks a ready identity with missing sender fields or invalid optional contact values', () => {
  const result = BrandIdentity.validate({
    status: 'ready',
    companyDisplayName: ' ',
    senderName: '',
    website: 'http://example.com',
    linkedinUrl: 'https://example.com/not-linkedin',
    phone: 'call-me',
    primaryColor: '#fff',
    updatedAt: '2026-09-15T12:00:00.000Z'
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

test('model rejects oversized payload fields and constrains restored values to published limits', () => {
  const limits = BrandIdentity.FIELD_LIMITS;
  assert.deepEqual(limits, {
    companyDisplayName: 160,
    senderName: 120,
    senderTitle: 160,
    website: 2048,
    phone: 32,
    linkedinUrl: 2048,
    primaryColor: 7,
    signatureText: 2000,
    legalFooter: 4000,
    postalAddress: 1000
  });

  const oversized = {...readyIdentity};
  for (const [field, limit] of Object.entries(limits)) oversized[field] = 'x'.repeat(limit + 4096);
  const result = BrandIdentity.validate(oversized);
  for (const [field, limit] of Object.entries(limits)) {
    assert.match(result.errors[field], new RegExp(`maximum is ${limit} characters`, 'i'), field);
  }

  const restored = BrandIdentity.normalize(oversized);
  for (const [field, limit] of Object.entries(limits)) {
    assert.equal(restored[field].length, limit, field);
  }
});

test('safeAssetReference keeps only approved metadata and rejects data, remote, and mismatched URLs', () => {
  const source = {
    id: LOGO_ID,
    url: '/api/customer/brand-assets/' + LOGO_ID,
    mimeType: 'image/png',
    width: 280,
    height: 96,
    altText: 'Acme logo',
    updatedAt: '2026-09-15T12:00:00.000Z',
    originalFilename: 'customer-name-logo.png',
    bytes: 'not allowed'
  };

  assert.deepEqual(BrandIdentity.safeAssetReference(source), {
    id: LOGO_ID,
    url: 'https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/' + LOGO_ID,
    mimeType: 'image/png',
    width: 280,
    height: 96,
    altText: 'Acme logo',
    updatedAt: '2026-09-15T12:00:00.000Z'
  });
  assert.equal(BrandIdentity.safeAssetReference({...source, url: 'data:image/png;base64,AAAA'}), null);
  assert.equal(BrandIdentity.safeAssetReference({...source, url: 'https://images.example/' + LOGO_ID}), null);
  assert.equal(BrandIdentity.safeAssetReference({...source, url: '/api/customer/brand-assets/different'}), null);
  assert.equal(BrandIdentity.safeAssetReference({...source, mimeType: 'image/svg+xml'}), null);
});

test('managed asset routes become absolute allowlisted LeadIntel API URLs in delivered HTML', () => {
  const safeLogo = BrandIdentity.safeAssetReference(readyIdentity.assets.logo);
  const rendered = BrandIdentity.renderEmail({
    subject: 'Absolute asset URL',
    bodyText: 'Hello',
    brandSnapshot: readyIdentity
  });

  assert.equal(
    safeLogo.url,
    'https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/' + LOGO_ID
  );
  assert.match(
    rendered.htmlBody,
    new RegExp('src="https://leadintel-api\\.edgars-7e7\\.workers\\.dev/api/customer/brand-assets/' + LOGO_ID + '"')
  );
  assert.equal(BrandIdentity.safeAssetReference({
    ...readyIdentity.assets.logo,
    url: 'https://images.example/api/customer/brand-assets/' + LOGO_ID
  }), null);
});

test('renderEmail fails explicitly for a present ready snapshot that does not validate', () => {
  assert.throws(
    () => BrandIdentity.renderEmail({
      subject: 'Must not downgrade',
      bodyText: 'Approved branded body',
      brandSnapshot: {...readyIdentity, senderName: ''}
    }),
    {
      name: 'TypeError',
      message: 'Cannot render a present invalid ready brand identity.'
    }
  );
});

test('safeAssetReference rejects impossible calendar timestamps instead of rolling them forward', () => {
  assert.ok(BrandIdentity.safeAssetReference({
    ...readyIdentity.assets.logo,
    updatedAt: '2024-02-29T12:00:00.000Z'
  }));
  assert.equal(BrandIdentity.safeAssetReference({
    ...readyIdentity.assets.logo,
    updatedAt: '2026-02-29T12:00:00.000Z'
  }), null);
  assert.equal(BrandIdentity.safeAssetReference({
    ...readyIdentity.assets.logo,
    updatedAt: '2026-02-31T12:00:00.000Z'
  }), null);
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

test('renderEmail gives every managed image explicit non-tiny horizontal and vertical bounds', () => {
  const identity = structuredClone(readyIdentity);
  identity.options.includeHeadshot = true;
  identity.options.includeBanner = true;
  identity.assets.headshot = {...identity.assets.logo, id: HEADSHOT_ID, url: '/api/customer/brand-assets/' + HEADSHOT_ID};
  identity.assets.banner = {...identity.assets.logo, id: BANNER_ID, url: '/api/customer/brand-assets/' + BANNER_ID};

  const rendered = BrandIdentity.renderEmail({subject: 'Bounded images', bodyText: 'Hello', brandSnapshot: identity});
  const imageTags = rendered.htmlBody.match(/<img\b[^>]*>/g) || [];

  assert.equal(imageTags.length, 3);
  for (const tag of imageTags) {
    assert.match(tag, /(?:width|max-width):(?:[3-9]|[1-9]\d)(?:\d)*(?:px|%)/);
    assert.match(tag, /(?:height|max-height):(?:[3-9]|[1-9]\d)(?:\d)*(?:px|%)/);
  }
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
    ['FIELD_LIMITS', 'normalize', 'renderEmail', 'safeAssetReference', 'snapshot', 'validate']
  );
});
