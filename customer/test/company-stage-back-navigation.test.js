const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const Discovery = require('../discovery-engine.js');
const NextAction = require('../workflow-next-action.js');

const MAIN = 'leadintel_customer_v2_state';
const META = 'leadintel_customer_v2_discovery_meta';
const RESEARCH = 'leadintel_customer_v2_discovery';
const source = fs.readFileSync(require.resolve('../discovery-ui.js'), 'utf8')
  .replace(/\ninitDiscoveryWhenReady\(\);\s*$/, `
    discovery = LeadIntelDiscovery.normalizeDiscoveryState(JSON.parse(localStorage.getItem('${RESEARCH}')));
    discoveryMounted = true;
    bindDiscovery();
    renderDiscoveryFocus(currentJourneyFocus());
  `);

function runtime({ stage = 5, saved } = {}) {
  const dom = new JSDOM(`<!doctype html><body>
    <section class="step-view" data-step="4"></section>
    <section class="step-view active" id="step-5" data-step="5">
      <span id="discovery-stage-kicker"></span><h1 id="discovery-stage-title"></h1>
      <p id="discovery-stage-description"></p><button id="back-to-strategy"></button>
      <div class="discovery-panel"><button id="run-company-discovery">Find companies</button></div>
      <section id="discovery-buyers-guide"></section><section class="pipeline-panel"></section>
      <span id="companies-selection-status"></span><button id="continue-company-buyers">Continue to Buyers</button>
      <footer class="workflow-next-action"><button id="continue-to-outreach"></button></footer>
    </section>
  </body>`, { url: 'https://leadintel.example/customer/', runScripts: 'outside-only' });
  const w = dom.window;
  const defaults = {
    [MAIN]: { step: 5, website: 'https://seller.example/', answers: { priority_offers: 'Industrial components' } },
    [META]: { activeJourneyStage: stage, visibleStep: 5, targetCount: 5, scriptBuyer: { domain: 'target.example', personId: 'buyer-1' } },
    [RESEARCH]: {
      qualityVersion: Discovery.DISCOVERY_QUALITY_VERSION, status: 'partial', candidates: [], pipeline: [],
      potentialMatches: [{ company: 'Pending', domain: 'pending.example', evidence: [{ url: 'https://pending.example/', text: 'Saved evidence' }] }],
      selectedProspects: [{ company: 'Selected', domain: 'target.example', buyerSearchMode: 'user_selected_target', people: [{ id: 'buyer-1', name: 'Saved Buyer', kept: false }] }]
    }
  };
  for (const [key, value] of Object.entries(saved || defaults)) w.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  const calls = [];
  w.LeadIntelDiscovery = Discovery;
  w.LeadIntelNextAction = NextAction;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.fetch = (...args) => { calls.push(args); throw new Error('Navigation must not start provider calls'); };
  vm.runInContext(source, dom.getInternalVMContext(), { filename: 'discovery-ui.js' });
  return {
    dom, calls,
    click: id => w.document.getElementById(id).click(),
    read: key => JSON.parse(w.localStorage.getItem(key)),
    text: id => w.document.getElementById(id).textContent,
    saved: () => Object.fromEntries([MAIN, META, RESEARCH].map(key => [key, w.localStorage.getItem(key)]))
  };
}

test('Back to Companies on Buyers returns to Companies rather than Strategy', () => {
  const r = runtime();
  assert.equal(r.text('back-to-strategy'), '← Companies');
  r.click('back-to-strategy');
  assert.equal(r.read(META).activeJourneyStage, 4);
  assert.equal(r.read(META).visibleStep, 5);
  assert.equal(r.read(MAIN).step, 5);
  assert.equal(r.text('discovery-stage-title'), 'Find companies that fit your strategy.');
  assert.equal(r.dom.window.document.getElementById('step-5').classList.contains('active'), true);
  assert.equal(r.calls.length, 0);
  r.dom.window.close();
});

test('Back to Strategy on Companies still returns to Strategy', () => {
  const r = runtime({ stage: 4 });
  assert.equal(r.text('back-to-strategy'), '← Strategy');
  r.click('back-to-strategy');
  assert.equal(r.read(MAIN).step, 4);
  assert.equal(r.read(META).visibleStep, 4);
  assert.equal(r.dom.window.document.querySelector('[data-step="4"]').classList.contains('active'), true);
  assert.equal(r.calls.length, 0);
  r.dom.window.close();
});

test('Companies and Buyers round trip preserves saved research and recipients through reload', () => {
  const r = runtime({ stage: 4 });
  const before = r.saved();
  r.click('continue-company-buyers');
  assert.equal(r.read(META).activeJourneyStage, 5);
  r.click('back-to-strategy');
  assert.equal(r.read(META).activeJourneyStage, 4);
  assert.equal(r.saved()[RESEARCH], before[RESEARCH]);
  assert.deepEqual(r.read(META).scriptBuyer, JSON.parse(before[META]).scriptBuyer);
  assert.equal(r.saved()[MAIN], before[MAIN]);
  const restored = runtime({ saved: r.saved() });
  assert.equal(restored.text('back-to-strategy'), '← Strategy');
  restored.click('continue-company-buyers');
  assert.equal(restored.read(META).activeJourneyStage, 5);
  assert.equal(restored.saved()[RESEARCH], before[RESEARCH]);
  assert.equal(r.calls.length + restored.calls.length, 0);
  r.dom.window.close();
  restored.dom.window.close();
});
