const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '../..');

function runProductionBuild({ customerHtml, discoveryUi }) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'leadintel-discovery-build-'));
  try {
    fs.mkdirSync(path.join(fixture, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(fixture, 'customer'), { recursive: true });
    fs.mkdirSync(path.join(fixture, 'v2'), { recursive: true });
    fs.copyFileSync(
      path.join(root, 'scripts/build-vercel-static.sh'),
      path.join(fixture, 'scripts/build-vercel-static.sh')
    );
    const verifier = path.join(root, 'scripts/verify-discovery-deploy.mjs');
    if (fs.existsSync(verifier)) {
      fs.copyFileSync(verifier, path.join(fixture, 'scripts/verify-discovery-deploy.mjs'));
    }
    fs.writeFileSync(path.join(fixture, 'index.html'), '<a href="customer/">Customer</a>');
    fs.writeFileSync(path.join(fixture, 'LeadIntel.html'), '<main>Legacy</main>');
    fs.writeFileSync(path.join(fixture, 'v2/index.html'), '<main>V2</main>');
    fs.writeFileSync(path.join(fixture, 'customer/index.html'), customerHtml);
    fs.writeFileSync(path.join(fixture, 'customer/discovery-ui.js'), discoveryUi);

    const result = spawnSync('bash', ['scripts/build-vercel-static.sh'], {
      cwd: fixture,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567', GITHUB_REF_NAME: 'main' }
    });
    return {
      status: result.status,
      stderr: result.stderr,
      artifactExists: fs.existsSync(path.join(fixture, '.vercel-static'))
    };
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

function assertBuildRejected(result) {
  assert.notEqual(result.status, 0, 'a regressed Discovery bootstrap must fail before Vercel can publish it');
  assert.match(result.stderr, /Discovery deployment guard failed/i);
  assert.equal(result.artifactExists, false);
}

test('the production build refuses the former module-graph Discovery bootstrap', () => {
  const result = runProductionBuild({
    customerHtml: '<script type="module" src="discovery-ui.js?v=regressed"></script>',
    discoveryUi: [
      'import "./content-variants.js";',
      'const DISCOVERY_REQUEST_TIMEOUT_MS=25000;',
      'const DISCOVERY_RUN_TIMEOUT_MS=DISCOVERY_REQUEST_TIMEOUT_MS*2+2000;',
      'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};',
      'initDiscoveryWhenReady();'
    ].join('\n')
  });

  assertBuildRejected(result);
});

test('the production build refuses a Discovery runtime without a hard stop', () => {
  const result = runProductionBuild({
    customerHtml: '<script defer src="discovery-ui.js?v=regressed"></script>',
    discoveryUi: [
      'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};',
      'initDiscoveryWhenReady();'
    ].join('\n')
  });

  assertBuildRejected(result);
});
