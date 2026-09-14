const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Discovery = require('../discovery-engine.js');

test('Discovery waits for its engine instead of failing before it can create the screen', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'discovery-ui.js'), 'utf8')
    .replace(/\ninitDiscoveryWhenReady\(\);\s*$/, '\ninitDiscoveryWhenReady();\nglobalThis.__discoveryUiState = () => discovery;\n');
  const timers = [];
  const context = {
    console,
    localStorage: { getItem: key => key === 'leadintel_customer_v2_state' ? JSON.stringify({ website: 'https://example.com/' }) : null, setItem() {}, removeItem() {} },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ dataset: {}, addEventListener() {} }),
      head: { appendChild() {} },
      body: { appendChild() {} }
    },
    navigator: { languages: [] },
    addEventListener() {},
    scrollTo() {},
    setTimeout: callback => { timers.push(callback); return timers.length; },
    clearTimeout() {},
    CustomEvent: class CustomEvent {}
  };
  context.window = context;

  assert.doesNotThrow(() => vm.runInNewContext(source, context, { filename: 'discovery-ui.js' }));
  assert.equal(timers.length, 1);
  assert.equal(context.__discoveryUiState(), null);

  context.LeadIntelDiscovery = Discovery;
  assert.doesNotThrow(() => timers.shift()());
  assert.equal(context.__discoveryUiState(), null);
  assert.doesNotThrow(() => context.LeadIntelDiscoveryUI.open());
  assert.equal(context.__discoveryUiState().status, 'idle');
  assert.equal(typeof context.LeadIntelDiscoveryUI.open, 'function');
});
