import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Reference Customer action modules use a fresh cache key end to end',()=>{
  const index=read('index.html');
  const processMap=read('process-map.js');
  assert.match(index,/process-map\.js\?v=20260909-reference-actions-v2/);
  assert.match(processMap,/reference-customer-ui\.js\?v=20260909-reference-actions-v2/);
  assert.match(processMap,/reference-customer-clear-list\.js\?v=20260909-reference-actions-v2/);
  assert.match(processMap,/reference-customer-website-enrichment\.js\?v=20260909-reference-actions-v2/);
  assert.match(processMap,/reference-customer-ai-runtime\.js\?v=20260910-reference-simple-flow-v2/);
  assert.match(processMap,/lookalike-discovery\.js\?v=20260910-reference-portfolio-v1/);
  const analysis=read('reference-customer-ai-runtime.js');
  assert.match(analysis,/reference-customer-library\.js\?v=20260910-reference-portfolio-v1/);
  assert.match(analysis,/reference-customer-portfolio\.js\?v=20260910-reference-portfolio-v1/);
  assert.match(analysis,/reference-customer-library-ui\.js\?v=20260910-reference-simple-flow-v2/);
});

test('clear-list action uses branded inline confirmation rather than native browser confirm',()=>{
  const source=read('reference-customer-clear-list.js');
  assert.match(source,/data-reference-clear-confirm/);
  assert.doesNotMatch(source,/\bconfirm\s*\(/);
});

test('website and analysis actions remain explicitly bound',()=>{
  const enrichment=read('reference-customer-website-enrichment.js');
  const analysis=read('reference-customer-ai-runtime.js');
  assert.match(enrichment,/closest\?\.\(["']#reference-find-websites["']\)|getElementById\(["']reference-find-websites["']\)/);
  assert.match(enrichment,/Finding websites…/);
  assert.match(analysis,/closest\?\.\(["']#reference-analyze["']\)|getElementById\(["']reference-analyze["']\)/);
  assert.match(analysis,/runAiAnalysis/);
});
