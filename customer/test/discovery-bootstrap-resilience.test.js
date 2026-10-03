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
    /<script defer src="discovery-ui\.js\?v=[^"]+"><\/script>/,
    'Discovery must load as an independent deferred script'
  );
  assert.doesNotMatch(
    discoveryUi,
    /^import\s/m,
    'Discovery must not wait for a redundant static import before it can create Step 5'
  );
  assert.match(
    html,
    /<script defer src="workflow-next-action\.js\?v=20261003-stage-scoped-handoff-v1&company-workflow=20261003-qualified-v2"><\/script>/,
    'The Buyers handoff must load the updated workflow gate after deployment'
  );
});

test('Discovery shell cache keys match the runtime asset version', () => {
  const runtimeVersion = discoveryUi.match(/const ASSET_VERSION="([^"]+)";/)?.[1];
  assert.ok(runtimeVersion, 'Discovery must declare an asset version');
  const expected=new URLSearchParams(`v=${runtimeVersion}`);
  for (const asset of ['discovery-engine.js', 'discovery-ui.js']) {
    const script=html.match(new RegExp(`<script defer src="${asset.replace('.', '\\.')}\\?([^" ]+)"></script>`));
    assert.ok(script,`${asset} must load independently`);
    const actual=new URLSearchParams(script[1]);
    for(const [key,value] of expected)assert.equal(actual.get(key),value,`${asset} cache key ${key} must match the runtime`);
  }
});
