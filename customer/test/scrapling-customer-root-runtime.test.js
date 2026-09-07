const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const customerRoot=path.join(__dirname,'..');
const repoRoot=path.join(customerRoot,'..');
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
  assert.match(requirements,/^scrapling==0\.4\.15$/m);
  assert.match(requirements,/^curl_cffi==/m,'static Fetcher needs curl_cffi');
  assert.match(requirements,/^browserforge==/m,'static Fetcher header generation needs browserforge');
  assert.doesNotMatch(requirements,/scrapling\[fetchers\]|playwright|patchright/i,'serverless runtime must not install browser automation dependencies');
});

test('customer-root Scrapling runtime exposes independent health proof and protected POST extraction',()=>{
  const runtime=fs.readFileSync(runtimePath,'utf8');
  assert.match(runtime,/@app\.get\(["']\/api\/scrapling["']\)/);
  assert.match(runtime,/@app\.post\(["']\/api\/scrapling["']\)/);
  assert.match(runtime,/scrapling-fallback/);
  assert.match(runtime,/SCRAPLING_SERVICE_TOKEN/);
  assert.match(runtime,/not ip\.is_global/);
  assert.doesNotMatch(runtime,/^from scrapling\.fetchers import Fetcher$/m,'health route must not crash merely because the optional Fetcher stack cannot initialize');
  assert.match(runtime,/def _fetcher\(\):[\s\S]*from scrapling\.fetchers import Fetcher/,'Fetcher must load lazily only for extraction');
});

test('private Scrapling runtime files are removed from the public static artifact',()=>{
  const buildScript=fs.readFileSync(path.join(repoRoot,'scripts/build-vercel-static.sh'),'utf8');
  assert.match(buildScript,/\.vercel-static\/customer\/api/);
  assert.match(buildScript,/\.vercel-static\/customer\/requirements\.txt/);
  assert.match(buildScript,/\.vercel-static\/customer\/vercel\.json/);
});
