const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const vercelConfigPath = path.join(root, 'vercel.json');
const buildScriptPath = path.join(root, 'scripts/build-vercel-static.sh');
const customerRootBuildScriptPath = path.join(root, 'customer/scripts/build-vercel-static.sh');
const pagesWorkflowPath = path.join(root, '.github/workflows/deploy-pages.yml');
const deploymentAuthorityPath = path.join(root, 'deployment-authority.json');
const customerCiPath = path.join(root, '.github/workflows/customer-ci.yml');
const rootIndex = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const legacyV2Index = fs.readFileSync(path.join(root, 'v2/index.html'), 'utf8');

test('Vercel builds a safe static artifact instead of exposing the repository root', () => {
  assert.equal(fs.existsSync(vercelConfigPath), true);
  assert.equal(fs.existsSync(buildScriptPath), true);
  const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
  const buildScript = fs.readFileSync(buildScriptPath, 'utf8');
  const staticBuild = Array.isArray(config.builds)
    ? config.builds.find(item => item.src === 'package.json' && item.use === '@vercel/static-build')
    : null;

  assert.ok(staticBuild, 'Vercel must explicitly allowlist the static build');
  assert.equal(staticBuild.config?.distDir, '.vercel-static');
  assert.match(buildScript, /mkdir -p \.vercel-static\/v2 \.vercel-static\/customer/);
  assert.match(buildScript, /cp -R customer\/\. \.vercel-static\/customer\//);
  assert.match(buildScript, /cp -R v2\/\. \.vercel-static\/v2\//);
  assert.doesNotMatch(buildScript, /cp -R backend|cp backend/);
});

test('the customer app URL without a trailing slash redirects to /customer/ so its relative assets resolve', () => {
  // customer/index.html references its scripts and styles relatively ("confirmation-dialog.js?v=…"). Served at
  // /customer (no slash) every one of them resolved to the site root and returned 404, leaving the page on
  // "We couldn't load your workspace". The deployed Vercel project has Root Directory=customer, so the config
  // that governs it is customer/vercel.json (see scrapling-customer-root-runtime.test.js), not the root one.
  const liveConfig = JSON.parse(fs.readFileSync(path.join(root, 'customer/vercel.json'), 'utf8'));
  const redirects = Array.isArray(liveConfig.redirects) ? liveConfig.redirects : [];
  const redirect = redirects.find(rule => rule.source === '/customer');
  assert.ok(redirect, 'customer/vercel.json must redirect /customer (no trailing slash)');
  assert.equal(redirect.destination, '/customer/');
  assert.equal(redirect.permanent, true, 'a permanent redirect (308) keeps the request method');
  const rootConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
  assert.ok(!(rootConfig.routes || []).some(route => route.src === '^/customer$'), 'the root vercel.json does not govern the deployment; keep the rule only in the live config');
});

test('Vercel build remains deployable if project Root Directory is customer', () => {
  assert.equal(
    fs.existsSync(customerRootBuildScriptPath),
    true,
    'customer-root compatibility wrapper must exist so the static build remains recoverable if Root Directory is customer'
  );
  const wrapper = fs.readFileSync(customerRootBuildScriptPath, 'utf8');
  assert.match(wrapper, /git rev-parse --show-toplevel/);
  assert.match(wrapper, /bash scripts\/build-vercel-static\.sh/);
  assert.match(wrapper, /customer\/\.vercel-static/);
});

test('obsolete GitHub Pages deployment workflow is removed', () => {
  assert.equal(fs.existsSync(pagesWorkflowPath), false);
});

test('repository declares Vercel as the only frontend deployment authority', () => {
  assert.equal(fs.existsSync(deploymentAuthorityPath), true, 'deployment authority contract must exist');
  const authority = JSON.parse(fs.readFileSync(deploymentAuthorityPath, 'utf8'));
  assert.deepEqual(authority.frontend, {
    provider: 'vercel',
    project: 'leadintel',
    outputDirectory: '.vercel-static'
  });
  assert.equal(authority.backend.provider, 'cloudflare-workers');
  assert.equal(authority.backend.service, 'leadintel-api');
  assert.deepEqual(authority.retiredFrontendProviders.sort(), ['cloudflare-pages', 'github-pages']);

  const customerCi = fs.readFileSync(customerCiPath, 'utf8');
  const watchedPaths = customerCi.match(/deployment-authority\.json/g) || [];
  assert.equal(watchedPaths.length, 2, 'push and pull-request CI must watch the deployment authority contract');
});

test('production root is the LeadIntel entry page while active workspace remains available at /customer/', () => {
  assert.doesNotMatch(rootIndex, /location\.replace\(['"]\/customer\/['"]\)/);
  assert.doesNotMatch(rootIndex, /location\.replace\(['"]\/v2\/['"]\)/);
  assert.match(rootIndex, /href=["']customer\/["']/);
  assert.match(legacyV2Index, /location\.replace\(['"]\/customer\/['"]\)/);
});
