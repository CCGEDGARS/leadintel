import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function discoveryScriptTags(html) {
  return String(html || '').match(/<script\b[^>]*\bsrc=(["'])[^"']*discovery-ui\.js[^"']*\1[^>]*><\/script>/gi) || [];
}

export function discoveryDeploymentFailures({ html = '', runtime = '', appRuntime = '' } = {}) {
  const failures = [];
  const tags = discoveryScriptTags(html);
  if (tags.length !== 1) {
    failures.push(`expected exactly one Discovery UI script, found ${tags.length}`);
  } else {
    const tag = tags[0];
    if (!/\bdefer(?:\s|=|>)/i.test(tag)) {
      failures.push('Discovery UI script must be deferred');
    }
    if (/\btype\s*=\s*(["'])module\1/i.test(tag)) {
      failures.push('Discovery UI script must not use the module dependency graph');
    }
  }

  if (/^\s*import(?:\s|["'])/m.test(runtime)) {
    failures.push('Discovery UI runtime must not contain a static import');
  }
  for (const marker of [
    'const DISCOVERY_REQUEST_TIMEOUT_MS=25000;',
    'const DISCOVERY_RUN_TIMEOUT_MS=DISCOVERY_REQUEST_TIMEOUT_MS*2+2000;',
    'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};',
    'initDiscoveryWhenReady();'
  ]) {
    if (!String(runtime).includes(marker)) {
      failures.push(`Discovery UI runtime is missing: ${marker}`);
    }
  }
  const initBody = String(runtime).match(/function initDiscovery\(\)\{([^}]*)\}/)?.[1] || '';
  if (!String(runtime).includes('function ensureDiscoveryMounted()')) {
    failures.push('Discovery UI runtime must keep hidden stages stage-isolated from Step 1');
  }
  if (/\b(?:loadDiscovery|renderAll|loadOutreachModules|refreshCrmState)\s*\(/.test(initBody)) {
    failures.push('Discovery UI startup must not load or render hidden stages on Step 1');
  }
  if (appRuntime) {
    const appStartup = String(appRuntime).slice(String(appRuntime).lastIndexOf('function init()'));
    if (/if\(state\.profile\)\{[^}]*renderProfile\(\)/.test(appStartup)) {
      failures.push('Customer startup must not render the hidden Profile on Step 1');
    }
  }
  return failures;
}

export async function verifyDiscoveryDeployment(root = process.cwd()) {
  const customerRoot = path.join(path.resolve(root), 'customer');
  const [html, runtime, appRuntime] = await Promise.all([
    fs.readFile(path.join(customerRoot, 'index.html'), 'utf8'),
    fs.readFile(path.join(customerRoot, 'discovery-ui.js'), 'utf8'),
    fs.readFile(path.join(customerRoot, 'app.js'), 'utf8')
  ]);
  return discoveryDeploymentFailures({ html, runtime, appRuntime });
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length > 1) throw new Error('Usage: node scripts/verify-discovery-deploy.mjs [root]');
  const failures = await verifyDiscoveryDeployment(argv[0] || process.cwd());
  if (failures.length) {
    console.error('[discovery-deploy] Discovery deployment guard failed');
    for (const failure of failures) console.error(`[discovery-deploy] ${failure}`);
    return 1;
  }
  console.log('[discovery-deploy] PASS standalone bootstrap, bounded runtime, and stage-isolated startup');
  return 0;
}

const direct = Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
if (direct) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(`[discovery-deploy] Discovery deployment guard failed: ${error?.message || error}`);
    process.exitCode = 1;
  });
}
