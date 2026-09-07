const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const customerRoot=path.join(__dirname,'..');
const repoRoot=path.join(customerRoot,'..');
const configPath=path.join(customerRoot,'vercel.json');
const renderRuntimePath=path.join(repoRoot,'api/scrapling.py');
const renderRequirementsPath=path.join(repoRoot,'requirements.txt');
const renderBlueprintPath=path.join(repoRoot,'render.yaml');

test('configured Vercel customer root remains static while Render owns Scrapling runtime',()=>{
  assert.equal(fs.existsSync(configPath),true,'customer/vercel.json must govern the configured Vercel Root Directory');
  assert.equal(fs.existsSync(path.join(customerRoot,'api/scrapling.py')),false,'customer Vercel must not package Scrapling runtime');
  assert.equal(fs.existsSync(path.join(customerRoot,'requirements.txt')),false,'customer Vercel must not install Scrapling dependencies');
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  assert.equal(config.buildCommand,'bash scripts/build-vercel-static.sh');
  assert.equal(config.outputDirectory,'.vercel-static');
  assert.equal(config.functions,undefined);
  assert.equal(fs.existsSync(renderRuntimePath),true,'Render Scrapling runtime must remain at repository root');
  assert.equal(fs.existsSync(renderRequirementsPath),true,'Render dependencies must remain at repository root');
  assert.equal(fs.existsSync(renderBlueprintPath),true,'Render blueprint must remain configured');
});

test('Render Scrapling runtime keeps protected extraction and lightweight static Fetcher dependencies',()=>{
  const runtime=fs.readFileSync(renderRuntimePath,'utf8');
  const requirements=fs.readFileSync(renderRequirementsPath,'utf8');
  const blueprint=fs.readFileSync(renderBlueprintPath,'utf8');
  assert.match(runtime,/@app\.post\(["']\/api\/scrapling["']\)/);
  assert.match(runtime,/scrapling-fallback/);
  assert.match(runtime,/SCRAPLING_SERVICE_TOKEN/);
  assert.match(requirements,/scrapling\[fetchers\]==0\.4\.15/);
  assert.match(blueprint,/uvicorn api\.scrapling:app/);
  assert.match(blueprint,/healthCheckPath:\s*\/health/);
});
