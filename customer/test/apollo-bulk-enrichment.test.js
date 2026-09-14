const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Apollo enrichment defaults to safe one-by-one mode and exposes alternatives', () => {
  const ui = read('apollo-bulk-enrichment.js');
  assert.match(ui, /DEFAULT_MODE\s*=\s*['"]one-by-one['"]/);
  assert.match(ui, /One by one \(default\)/);
  assert.match(ui, /<option value="batch">Batch<\/option>/);
  assert.match(ui, /<option value="automatic">Automatic \(while open\)<\/option>/);
  assert.match(ui, /STORAGE_KEY\s*=\s*['"]leadintel_apollo_enrichment_preferences_v1['"]/);
});

test('Apollo batch and automatic actions state their credit and safety gates', () => {
  const ui = read('apollo-bulk-enrichment.js');
  assert.match(ui, /bulkConfirmationMessage/);
  assert.match(ui, /business-email verification/);
  assert.match(ui, /Automatic Apollo email verification may use up to/);
  assert.match(ui, /direct LinkedIn profile/);
  assert.match(ui, /while this workspace is open/);
  assert.match(ui, /AUTO_LIMIT_MAX\s*=\s*20/);
  assert.match(ui, /DEFAULT_AUTO_LIMIT\s*=\s*10/);
  assert.match(ui, /dailyLimit/);
});

test('automatic Apollo verification requires identity evidence and excludes completed contacts', () => {
  const ui = read('apollo-bulk-enrichment.js');
  assert.match(ui, /function isAutomaticEligible/);
  assert.match(ui, /linkedin\.com\/in/);
  assert.match(ui, /verified\|working\|pending/);
  assert.match(ui, /processedKeys/);
  assert.match(ui, /runAutomatic/);
});

test('customer discovery bootstrap loads the Apollo mode module once', () => {
  const variants = fs.readFileSync(path.join(root, 'content-variants.js'), 'utf8');
  assert.match(variants, /apollo-bulk-enrichment\.js\?v=20260914-stage5-scoped-v1/);
});
