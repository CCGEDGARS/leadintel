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
    /<script defer src="discovery-ui\.js\?v=20260925-discovery-coverage-v1"><\/script>/,
    'Discovery must load as an independent deferred script'
  );
  assert.doesNotMatch(
    discoveryUi,
    /^import\s/m,
    'Discovery must not wait for a redundant static import before it can create Step 5'
  );
  assert.match(
    html,
    /<script defer src="workflow-next-action\.js\?v=20260925-buyers-stage-view-v1"><\/script>/,
    'The Buyers handoff must load the updated workflow gate after deployment'
  );
});

test('Discovery shell cache keys match the runtime asset version', () => {
  const runtimeVersion = discoveryUi.match(/const ASSET_VERSION="([^"]+)";/)?.[1];
  assert.ok(runtimeVersion, 'Discovery must declare an asset version');
  for (const asset of ['discovery-engine.js', 'discovery-ui.js']) {
    assert.ok(html.includes(`<script defer src="${asset}?v=${runtimeVersion}"></script>`), `${asset} must load the current Discovery release`);
  }
});
