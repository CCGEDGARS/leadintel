const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('activation keeps the request to open Discovery until its UI is ready', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app,/async function openDiscoveryAfterActivation\(\)/);
  assert.match(app,/window\.__leadIntelPendingDiscoveryOpen=true/);
  assert.match(app,/const opened=await waitForDiscoveryOpen\(\)/);
  assert.match(app,/window\.__leadIntelPendingDiscoveryOpen=!opened/);
  assert.match(app,/return opened/);
});
