const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/deploy-pages.yml'), 'utf8');

test('GitHub Pages artifact publishes customer workspace', () => {
  assert.match(workflow, /mkdir -p \.pages\/v2 \.pages\/customer/);
  assert.match(workflow, /cp -R customer\/\. \.pages\/customer\//);
});

test('legacy v2 deployment remains preserved', () => {
  assert.match(workflow, /cp -R v2\/\. \.pages\/v2\//);
});