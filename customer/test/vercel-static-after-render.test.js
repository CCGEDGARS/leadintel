import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const vercel=fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8');
const config=JSON.parse(vercel);

test('customer Vercel serves static UI and first-party Node proxy while Scrapling stays on Render',()=>{
  assert.equal(config.outputDirectory,'.vercel-static');
  assert.deepEqual(Object.keys(config.functions||{}),['api/backend.mjs'],'only the first-party Node API proxy may be packaged');
  assert.equal(fs.existsSync(new URL('../api/scrapling.py',import.meta.url)),false,'Scrapling runtime belongs on Render, not customer Vercel');
  assert.equal(fs.existsSync(new URL('../requirements.txt',import.meta.url)),false,'customer Vercel must not install Scrapling Python dependencies');
});
