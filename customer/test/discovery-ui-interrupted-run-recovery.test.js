const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Discovery = require('../discovery-engine.js');

function loadUiWithStoredDiscovery(value) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'discovery-ui.js'), 'utf8')
    .replace(/\ninitDiscoveryWhenReady\(\);\s*$/, '\ninitDiscovery();\nglobalThis.__discoveryUiState = () => discovery;\n');
  const storage = new Map([["leadintel_customer_v2_discovery", JSON.stringify(value)]]);
  const context = {
    console,
    LeadIntelDiscovery: Discovery,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, item) => storage.set(key, String(item)), removeItem: key => storage.delete(key) },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ dataset: {}, addEventListener() {} }), head: { appendChild() {} }, body: { appendChild() {} } },
    navigator: { languages: [] },
    addEventListener() {},
    scrollTo() {},
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {}
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: 'discovery-ui.js' });
  return context.__discoveryUiState();
}

test('Discovery UI unlocks a search left running by a previous page session', () => {
  const state = loadUiWithStoredDiscovery({
    status: 'running',
    queries: [{ id: 'q-1', market: 'Latvia', query: 'office furniture Latvia', offer: 'office furniture' }],
    rawResults: [],
    candidates: [],
    pipeline: [],
    lastRunAt: '2026-09-14T10:00:00.000Z'
  });
  assert.equal(state.status, 'error');
});
