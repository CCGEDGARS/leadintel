import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../../api/scrapling.py',import.meta.url),'utf8');
const requirements=fs.readFileSync(new URL('../../requirements.txt',import.meta.url),'utf8');

test('Scrapling runtime is pinned and exposes a guarded POST extractor',()=>{
  assert.match(requirements,/scrapling\[fetchers\]==0\.4\.15/);
  assert.match(runtime,/FastAPI/);
  assert.match(runtime,/Fetcher\.get/);
  assert.match(runtime,/scrapling-fallback/);
  assert.match(runtime,/SCRAPLING_SERVICE_TOKEN/);
  assert.match(runtime,/is_private|is_global|private/i);
  assert.match(runtime,/http.*https|https.*http/i);
});
