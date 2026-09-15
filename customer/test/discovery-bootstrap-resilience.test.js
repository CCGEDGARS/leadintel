const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const discoveryUi = fs.readFileSync(path.join(root, 'discovery-ui.js'), 'utf8');

test('Company Discovery bootstrap is not blocked by a module dependency graph', () => {
  assert.match(
    html,
    /<script defer src="discovery-ui\.js\?v=20260916-brand-outreach-v2"><\/script>/,
    'Discovery must load as an independent deferred script'
  );
  assert.doesNotMatch(
    discoveryUi,
    /^import\s/m,
    'Discovery must not wait for a redundant static import before it can create Step 5'
  );
});
