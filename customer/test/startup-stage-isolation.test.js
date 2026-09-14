const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const customerRoot = path.join(__dirname, '..');

test('Step 1 startup does not load or render saved Discovery and Outreach stages', () => {
  const source = fs.readFileSync(path.join(customerRoot, 'discovery-ui.js'), 'utf8');
  const storage = new Map([
    ['leadintel_customer_v2_state', JSON.stringify({ step: 1, website: 'https://example.com/' })],
    ['leadintel_customer_v2_discovery', JSON.stringify({
      status: 'complete',
      candidates: Array.from({ length: 50 }, (_, index) => ({
        company: `Company ${index}`,
        domain: `company-${index}.test`,
        website: `https://company-${index}.test/`,
        evidence: [{ text: 'x'.repeat(7000) }]
      }))
    })]
  ]);
  let discoveryReads = 0;
  let outreachAppends = 0;
  const context = {
    console,
    LeadIntelDiscovery: require('../discovery-engine.js'),
    LeadIntelContentLanguage: { resolveLanguage: () => 'en' },
    localStorage: {
      getItem(key) {
        if (key === 'leadintel_customer_v2_discovery') discoveryReads++;
        return storage.get(key) || null;
      },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    document: {
      activeElement: null,
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ dataset: {}, addEventListener() {} }),
      head: { appendChild() {} },
      body: { appendChild() { outreachAppends++; } }
    },
    navigator: { languages: [] },
    addEventListener() {},
    scrollTo() {},
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {},
    MouseEvent: class MouseEvent {}
  };
  context.window = context;

  vm.runInNewContext(source, context, { filename: 'discovery-ui.js' });

  assert.equal(typeof context.LeadIntelDiscoveryUI.open, 'function');
  assert.equal(discoveryReads, 0, 'hidden Discovery state must remain untouched on Step 1');
  assert.equal(outreachAppends, 0, 'hidden Outreach modules must not load on Step 1');

  context.LeadIntelDiscoveryUI.open();
  assert.equal(discoveryReads, 1, 'Discovery state is loaded once when Step 5 is requested');
  assert.equal(outreachAppends, 1, 'Outreach loads only after Discovery is mounted');
});

test('Step 1 startup does not render a saved Profile off-screen', () => {
  const source = fs.readFileSync(path.join(customerRoot, 'app.js'), 'utf8');
  const startup = source.slice(source.lastIndexOf('function bind()'));

  assert.doesNotMatch(
    startup,
    /if\(state\.profile\)\{[^}]*renderProfile\(\)/,
    'saved Profile rendering must be deferred until Step 3 is opened'
  );
});
