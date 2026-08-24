const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/deploy-pages.yml'), 'utf8');
const rootIndex = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const legacyV2Index = fs.readFileSync(path.join(__dirname, '../../v2/index.html'), 'utf8');

test('GitHub Pages artifact publishes customer workspace', () => {
  assert.match(workflow, /mkdir -p \.pages\/v2 \.pages\/customer/);
  assert.match(workflow, /cp -R customer\/\. \.pages\/customer\//);
});

test('legacy v2 deployment remains preserved', () => {
  assert.match(workflow, /cp -R v2\/\. \.pages\/v2\//);
});

test('production entry points route to the active customer workspace', () => {
  assert.match(rootIndex, /location\.replace\(['"]\/customer\/['"]\)/);
  assert.doesNotMatch(rootIndex, /location\.replace\(['"]\/v2\/['"]\)/);
  assert.match(legacyV2Index, /location\.replace\(['"]\/customer\/['"]\)/);
});
