const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const rootDir=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(rootDir,'apollo-bulk-enrichment.js'),'utf8');

test('Apollo toolbar does not rewrite selected-count text when unchanged',()=>{
  assert.match(
    source,
    /if\(countNode&&countNode\.textContent!==String\(count\)\)countNode\.textContent=String\(count\)/,
    'MutationObserver decoration must not rewrite identical toolbar text and retrigger childList mutations'
  );
});

test('Apollo contact decoration does not rewrite identical action labels',()=>{
  assert.match(
    source,
    /emailButton\.textContent!==emailLabel/,
    'email action label must only be written when it changes'
  );
  assert.match(
    source,
    /phoneButton\.textContent!==phoneLabel/,
    'phone action label must only be written when it changes'
  );
});

test('content bootstrap cache-busts the fixed Apollo observer module',()=>{
  const bootstrap=fs.readFileSync(path.join(rootDir,'content-variants.js'),'utf8');
  assert.match(bootstrap,/apollo-bulk-enrichment\.js\?v=20260921-contact-gated-v2/);
});
