import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const vercel=fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8');
const config=JSON.parse(vercel);

test('customer Vercel deployment stays static after Scrapling moved to Render',()=>{
  assert.equal(config.outputDirectory,'.vercel-static');
  assert.equal(config.functions,undefined,'customer Vercel must not package Python functions');
  assert.equal(fs.existsSync(new URL('../api/scrapling.py',import.meta.url)),false,'Scrapling runtime belongs on Render, not customer Vercel');
  assert.equal(fs.existsSync(new URL('../requirements.txt',import.meta.url)),false,'customer Vercel must not install Scrapling Python dependencies');
});
