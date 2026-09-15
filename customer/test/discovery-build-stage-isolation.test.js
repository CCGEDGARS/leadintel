const test = require('node:test');
const assert = require('node:assert/strict');

const safeHtml = '<script defer src="discovery-ui.js?v=test"></script>';
const baseMarkers = [
  'const DISCOVERY_REQUEST_TIMEOUT_MS=25000;',
  'const DISCOVERY_RUN_TIMEOUT_MS=DISCOVERY_REQUEST_TIMEOUT_MS*2+2000;',
  'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};',
  'initDiscoveryWhenReady();'
].join('\n');

test('deployment guard rejects hidden-stage Discovery work during Step 1 startup', async () => {
  const { discoveryDeploymentFailures } = await import('../../scripts/verify-discovery-deploy.mjs');
  const failures = discoveryDeploymentFailures({
    html: safeHtml,
    runtime: `${baseMarkers}\nfunction initDiscovery(){discovery=loadDiscovery();renderAll();loadOutreachModules();}`
  });

  assert.ok(
    failures.some(message => /stage-isolated|Step 1|hidden/i.test(message)),
    `expected a stage-isolation failure, got: ${failures.join('; ')}`
  );
});
