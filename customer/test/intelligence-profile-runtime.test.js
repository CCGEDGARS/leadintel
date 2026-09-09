const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','intelligence-profile-runtime.js'),'utf8');
const evidence=fs.readFileSync(path.join(__dirname,'..','evidence-view.js'),'utf8');

test('Step 3 runtime delegates the profile grid to the canonical intelligence renderer',()=>{
  assert.match(source,/LeadIntelIntelligenceProfileUI/);
  assert.match(source,/profile-editor/);
  assert.match(source,/UI\.render/);
  assert.match(source,/canonical/);
});

test('canonical renderer reruns when legacy app replaces its DOM while state signature stays unchanged',()=>{
  assert.match(source,/canonicalSignature===signature\s*&&\s*editor\.querySelector\(['"]\.intel-profile-shell['"]\)/);
});

test('Step 3 replaces full signal library with compact summary and preserves Step 4 Signal Designer link',()=>{
  assert.match(source,/active signal themes/i);
  assert.match(source,/Open Signal Designer/i);
  assert.match(source,/data-step-marker/);
});

test('legacy lookalike textarea is retired from visible Step 2 intake',()=>{
  assert.match(source,/lookalike_customers/);
  assert.match(source,/question-card/);
  assert.match(source,/remove\(\)|hidden\s*=\s*true/);
});

test('legacy commercial context and evidence layout sidecars are not runtime dependencies anymore',()=>{
  assert.doesNotMatch(evidence,/commercial-context-layout\.js/);
  assert.doesNotMatch(evidence,/profile-evidence-layout\.js/);
});

test('runtime loads the new profile and reference-customer CSS with cache versions',()=>{
  assert.match(source,/intelligence-profile\.css\?v=/);
  assert.match(source,/reference-customers\.css\?v=/);
});
