import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
test('Worker dispatches research cost reads through authentication before any provider call',async()=>{
 const result=await app.fetch(new Request('https://example.test/api/research/costs?workspace_id=w1'),{APP_ORIGIN:'https://example.test'});
 assert.equal(result.status,401);assert.equal(result.headers.get('cache-control'),'no-store');
});
