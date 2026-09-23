import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('process map imports only the lightweight copilot loader with the polished cache key',()=>{
  const source=read('process-map.js');
  assert.match(source,/copilot-loader\.js\?v=20260911-copilot-freshness-v1/);
  assert.doesNotMatch(source,/import ['"]\.\/copilot-(?:ui|api|context)\.js/);
});

test('copilot loader is boot-safe and defers polished UI modules',()=>{
  const source=read('copilot-loader.js');
  assert.doesNotMatch(source,/MutationObserver/);
  assert.doesNotMatch(source,/document\.body/);
  assert.match(source,/import\(['"]\.\/copilot-api\.js\?v=20260908-copilot-polish-v1/);
  assert.match(source,/import\(['"]\.\/copilot-context\.js\?v=20260924-friendly-workflow-labels-v1/);
  assert.match(source,/import\(['"]\.\/copilot-ui\.js\?v=20260911-copilot-freshness-v1/);
  assert.match(source,/try\s*\{|catch\s*\(/);
  assert.match(source,/Ask LeadIntel/);
});

test('loader preloads scoped copilot styles before the first click',()=>{
  const source=read('copilot-loader.js');
  assert.match(source,/copilot\.css\?v=/);
  assert.match(source,/data-leadintel-asset|leadintelAsset/);
  assert.match(source,/stylesheet/);
});

test('loader provides a lightweight entry beneath the progress metric without replacing main content',()=>{
  const source=read('copilot-loader.js');
  assert.match(source,/progress-metric/);
  assert.match(source,/insertAdjacentElement|after\(/);
  assert.match(source,/leadintel-copilot-entry/);
  assert.doesNotMatch(source,/innerHTML\s*=\s*[^;]*<main/i);
});

test('closing and reopening Copilot reuses modules but opens the drawer on every click',async()=>{
  const {createCopilotController}=await import('../copilot-loader.js?test=reopen');
  let loads=0,opens=0;
  const controller=createCopilotController({
    loadModules:async()=>{loads++;return {ui:{}};},
    open:async()=>{opens++;}
  });
  await controller();
  await controller();
  assert.equal(loads,1);
  assert.equal(opens,2);
});
