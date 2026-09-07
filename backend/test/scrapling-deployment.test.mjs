import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../../api/scrapling.py',import.meta.url),'utf8');
const requirements=fs.readFileSync(new URL('../../requirements.txt',import.meta.url),'utf8');
const blueprint=fs.readFileSync(new URL('../../render.yaml',import.meta.url),'utf8');

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
