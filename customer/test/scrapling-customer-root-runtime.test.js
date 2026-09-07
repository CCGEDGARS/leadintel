const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const customerRoot=path.join(__dirname,'..');
const configPath=path.join(customerRoot,'vercel.json');
const runtimePath=path.join(customerRoot,'api/scrapling.py');
const requirementsPath=path.join(customerRoot,'requirements.txt');

test('configured Vercel customer root owns the Scrapling function deployment',()=>{
  assert.equal(fs.existsSync(configPath),true,'customer/vercel.json must govern the configured Vercel Root Directory');
  assert.equal(fs.existsSync(runtimePath),true,'Scrapling runtime must live inside the deployed customer root');
  assert.equal(fs.existsSync(requirementsPath),true,'Python dependencies must live inside the deployed customer root');
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  assert.equal(config.buildCommand,'bash scripts/build-vercel-static.sh');
  assert.equal(config.outputDirectory,'.vercel-static');
  assert.equal(config.functions?.['api/**/*.py']?.maxDuration,60);
  const requirements=fs.readFileSync(requirementsPath,'utf8');
  assert.match(requirements,/^fastapi==/m);
  assert.match(requirements,/^scrapling\[fetchers\]==0\.4\.15$/m);
});

test('customer-root Scrapling runtime exposes GET health proof and protected POST extraction',()=>{
  const runtime=fs.readFileSync(runtimePath,'utf8');
  assert.match(runtime,/@app\.get\(["']\/api\/scrapling["']\)/);
  assert.match(runtime,/@app\.post\(["']\/api\/scrapling["']\)/);
  assert.match(runtime,/scrapling-fallback/);
  assert.match(runtime,/SCRAPLING_SERVICE_TOKEN/);
  assert.match(runtime,/not ip\.is_global/);
});
