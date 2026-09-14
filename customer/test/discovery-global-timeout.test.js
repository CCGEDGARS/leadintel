const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Discovery = require('../discovery-engine.js');

function loadDiscoveryRunner({ renderFails = false } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'discovery-ui.js'), 'utf8')
    .replace('const DISCOVERY_REQUEST_TIMEOUT_MS=25000;', 'const DISCOVERY_REQUEST_TIMEOUT_MS=1;')
    .replace('const DISCOVERY_RUN_TIMEOUT_MS=DISCOVERY_REQUEST_TIMEOUT_MS+1000;', 'const DISCOVERY_RUN_TIMEOUT_MS=8;')
    .replace(/\ninitDiscoveryWhenReady\(\);\nimport\s+['"][^'\"]+['"];?\s*$/, '\ndiscovery=LeadIntelDiscovery.normalizeDiscoveryState({});\nglobalThis.__runDiscovery = runCompanyDiscovery;\nglobalThis.__discoveryState = () => discovery;\n');
  const mainState = {
    website: 'https://acme.example/',
    profile: {
      website: 'https://acme.example/',
      targetMarkets: 'Latvia',
      priorityOffers: 'industrial automation',
      idealCustomer: 'manufacturers'
    },
    market: {
      signals: [{ id: 'expansion', name: 'Expansion', active: true, weight: 9, keywords: 'new factory; expansion' }],
      opportunities: [{ market: 'Latvia', active: true, score: { total: 80 } }]
    }
  };
  const storage = new Map([['leadintel_customer_v2_state', JSON.stringify(mainState)]]);
  const context = {
    console: { ...console, error() {} },
    AbortController,
    LeadIntelDiscovery: Discovery,
    fetch: () => new Promise(() => {}),
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document: { getElementById: id => renderFails && id === 'discovery-status' ? { textContent: '' } : null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ dataset: {}, addEventListener() {} }), head: { appendChild() {} }, body: { appendChild() {} } },
    navigator: { languages: [] },
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {}
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: 'discovery-ui.js' });
  return context;
}

test('a permanently pending provider cannot leave Company Discovery running', async () => {
  const context = loadDiscoveryRunner();
  const completed = await Promise.race([
    context.__runDiscovery().then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 60))
  ]);
  assert.equal(completed, true);
  assert.notEqual(context.__discoveryState().status, 'running');
});

test('a rendering failure cannot leave Company Discovery running', async () => {
  const context = loadDiscoveryRunner({ renderFails: true });
  await assert.doesNotReject(context.__runDiscovery());
  assert.equal(context.__discoveryState().status, 'error');
});
