const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '../..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'release-integrity.config.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(root, '.github/workflows/release-integrity.yml'), 'utf8');
const corePath = path.join(root, 'scripts/release-integrity-core.mjs');
const SHA = '0123456789abcdef0123456789abcdef01234567';

async function loadCore() {
  return import(`${pathToFileURL(corePath).href}?test=${Date.now()}-${Math.random()}`);
}

function response({ status = 200, json, text } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return json; },
    async text() { return text ?? JSON.stringify(json ?? {}); }
  };
}

function productionFetch({ customerHtml, discoveryUi }) {
  return async url => {
    const parsed = new URL(String(url));
    if (parsed.pathname === '/release.json') {
      return response({ json: { service: 'leadintel-customer', commit: SHA, ref: 'main' } });
    }
    if (parsed.hostname === 'leadintel-api.edgars-7e7.workers.dev') {
      return response({ json: { status: 'ok', service: 'leadintel-api' } });
    }
    if (parsed.pathname === '/customer/website-input-sync.js') {
      return response({ text: 'toVisibleWebsite syncVisibleWebsite displayChanged' });
    }
    if (parsed.pathname === '/customer/discovery-ui.js') {
      return response({ text: discoveryUi });
    }
    if (parsed.pathname === '/customer/') {
      return response({ text: customerHtml });
    }
    if (parsed.pathname === '/') {
      return response({ text: 'Commercial Intelligence Contact Intelligence href="customer/" href="LeadIntel.html"' });
    }
    return response({ status: 404, text: 'missing' });
  };
}

const shell = 'LeadIntel — Build Your Commercial Intelligence Strategy id="company-website"';
const boundedDiscoveryRuntime = [
  'const DISCOVERY_REQUEST_TIMEOUT_MS=25000;',
  'const DISCOVERY_RUN_TIMEOUT_MS=DISCOVERY_REQUEST_TIMEOUT_MS+1000;',
  'function ensureDiscoveryMounted(){}',
  'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};',
  'initDiscoveryWhenReady();'
].join('\n');

test('production proof blocks the former module-graph Discovery bootstrap', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  const proof = await verifyRelease({
    config,
    expectedSha: SHA,
    ciConclusion: 'success',
    ciRunId: '200',
    fetchImpl: productionFetch({
      customerHtml: `${shell}<script type="module" src="discovery-ui.js?v=old"></script>`,
      discoveryUi: `import "./content-variants.js";\n${boundedDiscoveryRuntime}`
    }),
    nonce: 'module-regression'
  });

  assert.equal(proof.verdict, VERDICTS.BLOCKED_SMOKE_CHECK);
  assert.match(proof.failures.join(' '), /discovery-bootstrap/i);
});

test('production proof blocks a Discovery runtime without a hard stop', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  const proof = await verifyRelease({
    config,
    expectedSha: SHA,
    ciConclusion: 'success',
    ciRunId: '201',
    fetchImpl: productionFetch({
      customerHtml: `${shell}<script defer src="discovery-ui.js?v=current"></script>`,
      discoveryUi: 'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};\ninitDiscoveryWhenReady();'
    }),
    nonce: 'timeout-regression'
  });

  assert.equal(proof.verdict, VERDICTS.BLOCKED_SMOKE_CHECK);
  assert.match(proof.failures.join(' '), /discovery-runtime/i);
});

test('production proof blocks a Discovery runtime that performs hidden-stage startup work', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  const proof = await verifyRelease({
    config,
    expectedSha: SHA,
    ciConclusion: 'success',
    ciRunId: '202',
    fetchImpl: productionFetch({
      customerHtml: `${shell}<script defer src="discovery-ui.js?v=current"></script>`,
      discoveryUi: [
        'const DISCOVERY_REQUEST_TIMEOUT_MS=25000;',
        'const DISCOVERY_RUN_TIMEOUT_MS=DISCOVERY_REQUEST_TIMEOUT_MS+1000;',
        'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};',
        'initDiscoveryWhenReady();'
      ].join('\n')
    }),
    nonce: 'stage-isolation-regression'
  });

  assert.equal(proof.verdict, VERDICTS.BLOCKED_SMOKE_CHECK);
  assert.match(proof.failures.join(' '), /discovery-runtime/i);
});

test('release integrity re-verifies production automatically every fifteen minutes', () => {
  assert.match(workflow, /schedule:\s*\n\s*- cron:\s*['"]\*\/15 \* \* \* \*['"]/);
  assert.match(workflow, /id:\s*scheduled_ci/);
  assert.match(workflow, /github\.event_name == 'schedule'/);
  assert.match(workflow, /actions\/workflows\/customer-ci\.yml\/runs/);
});
