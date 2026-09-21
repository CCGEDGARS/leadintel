import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=path.resolve(process.cwd(),'customer');
const modulePath=path.join(root,'apollo-bulk-enrichment.js');

test('Apollo bulk enrichment module exists and exposes explicit credit estimates', async()=>{
  assert.equal(fs.existsSync(modulePath),true,'apollo-bulk-enrichment.js should exist');
  const mod=await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
  assert.equal(mod.estimateApolloCredits(3,'email'),3);
  assert.equal(mod.estimateApolloCredits(3,'phone'),27);
  assert.equal(mod.estimateApolloCredits(0,'phone'),0);
});

test('bulk confirmation copy makes the selected scope and Apollo cost explicit', async()=>{
  const mod=await import(`${pathToFileURL(modulePath).href}?t=${Date.now()+1}`);
  assert.match(mod.bulkConfirmationMessage(12,'email'),/12 contacts selected/i);
  assert.match(mod.bulkConfirmationMessage(12,'email'),/12 Apollo credits/i);
  assert.match(mod.bulkConfirmationMessage(12,'phone'),/108 Apollo credits/i);
});

test('selection identity changes when the rendered contact changes at the same row index', async()=>{
  const mod=await import(`${pathToFileURL(modulePath).href}?t=${Date.now()+2}`);
  const first=mod.contactSelectionKey(2,1,'Alice Smith|Sales Director');
  const second=mod.contactSelectionKey(2,1,'Bob Jones|Sales Director');
  assert.notEqual(first,second);
  assert.match(first,/^2:1:/);
});

test('discovery labels distinguish free people search from credit-consuming enrichment',()=>{
  const source=fs.readFileSync(path.join(root,'discovery-ui.js'),'utf8');
  assert.match(source,/Apollo People Search does not reveal email addresses/i);
  const controls=fs.readFileSync(modulePath,'utf8');
  assert.match(controls,/Verify email with Apollo · 1 credit/i);
  assert.match(controls,/Find phone with Apollo · up to 9 credits/i);
  assert.match(controls,/Finding people does not reveal contact details/i);
  assert.match(controls,/Verify selected emails with Apollo/i);
  assert.match(controls,/Find selected phones with Apollo/i);
});


test('Apollo toolbar stays hidden until a discovered decision-maker can be verified',async()=>{
  const mod=await import(`${pathToFileURL(modulePath).href}?t=${Date.now()+3}`);
  const emptyDocument={querySelector:()=>null};
  const readyDocument={querySelector:(selector)=>selector.includes('enrich-contact')?{}:null};
  assert.equal(mod.apolloToolbarShouldShow(emptyDocument),false);
  assert.equal(mod.apolloToolbarShouldShow(readyDocument),true);
  const controls=fs.readFileSync(modulePath,'utf8');
  assert.match(controls,/toolbar\.hidden=!apolloToolbarShouldShow\(document\)/);
});
