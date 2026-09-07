const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const vercelConfigPath = path.join(root, 'vercel.json');
const buildScriptPath = path.join(root, 'scripts/build-vercel-static.sh');
const customerRootBuildScriptPath = path.join(root, 'customer/scripts/build-vercel-static.sh');
const pagesWorkflowPath = path.join(root, '.github/workflows/deploy-pages.yml');
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

test('production root is the LeadIntel entry page while active workspace remains available at /customer/', () => {
  assert.doesNotMatch(rootIndex, /location\.replace\(['"]\/customer\/['"]\)/);
  assert.doesNotMatch(rootIndex, /location\.replace\(['"]\/v2\/['"]\)/);
  assert.match(rootIndex, /href=["']customer\/["']/);
  assert.match(legacyV2Index, /location\.replace\(['"]\/customer\/['"]\)/);
});
