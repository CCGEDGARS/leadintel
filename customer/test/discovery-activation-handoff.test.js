const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('activation keeps the request to open Discovery until its UI is ready', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const match = app.match(/function openDiscoveryAfterActivation\(\)\{[\s\S]*?\n\}\nasync function activateMarketStrategy/);
  assert.ok(match, 'openDiscoveryAfterActivation should be present');
  const source = match[0]
    .replace(/\nasync function activateMarketStrategy$/, '\nglobalThis.__openDiscoveryAfterActivation = openDiscoveryAfterActivation;');
  let active = false;
  const context = {
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    dispatchEvent() {},
    document: {
      getElementById: id => id === 'step-5' ? { classList: { contains: () => active } } : null,
      querySelector: () => null
    },
    setTimeout() {},
    $: () => null
  };
  context.window = context;

  vm.runInNewContext(source, context, { filename: 'app.js' });
  assert.equal(context.__openDiscoveryAfterActivation(), false);
  assert.equal(context.__leadIntelPendingDiscoveryOpen, true);

  context.LeadIntelDiscoveryUI = { open() { active = true; } };
  assert.equal(context.__openDiscoveryAfterActivation(), true);
  assert.equal(context.__leadIntelPendingDiscoveryOpen, false);
});
