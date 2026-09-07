import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../../api/scrapling.py',import.meta.url),'utf8');
const requirements=fs.readFileSync(new URL('../../requirements.txt',import.meta.url),'utf8');
const blueprint=fs.readFileSync(new URL('../../render.yaml',import.meta.url),'utf8');
const wrangler=fs.readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
const deployWorkflow=fs.readFileSync(new URL('../../.github/workflows/backend-deploy.yml',import.meta.url),'utf8');
const scraplingRoutes=fs.readFileSync(new URL('../src/scrapling-routes.js',import.meta.url),'utf8');

test('Scrapling standalone runtime exposes a health endpoint',()=>{
  assert.match(runtime,/@app\.get\(["']\/health["']\)/);
  assert.match(runtime,/status["']?\s*:\s*["']ok["']/);
});

test('Scrapling standalone runtime has an explicit ASGI server dependency',()=>{
  assert.match(requirements,/^uvicorn(?:\[standard\])?==/m);
});

test('Render blueprint deploys only the Scrapling runtime and generates a private service token',()=>{
  assert.match(blueprint,/type:\s*web/);
  assert.match(blueprint,/runtime:\s*python/);
  assert.match(blueprint,/uvicorn api\.scrapling:app/);
  assert.match(blueprint,/healthCheckPath:\s*\/health/);
  assert.match(blueprint,/key:\s*SCRAPLING_SERVICE_TOKEN/);
  assert.match(blueprint,/generateValue:\s*true/);
});

test('Cloudflare Worker points Scrapling fallback at the live Render extraction endpoint',()=>{
  assert.match(wrangler,/SCRAPLING_SERVICE_URL\s*=\s*"https:\/\/leadintel-scrapling\.onrender\.com\/api\/scrapling"/);
  assert.match(wrangler,/SCRAPLING_SERVICE_TOKEN/,'deployment config must document the matching Worker secret');
});

test('permanent backend deployment preserves the synchronized Scrapling secret instead of rotating it',()=>{
  assert.doesNotMatch(deployWorkflow,/Bootstrap protected Scrapling service token|SCRAPLING_TOKEN_CIPHERTEXT|openssl rand/);
});

test('temporary public Scrapling extraction probe is removed after production verification',()=>{
  assert.doesNotMatch(scraplingRoutes,/scrapling\/health|SCRAPLING_PROBE_TARGET/);
});
