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

test('Step 3 canonical profile owns edit and save so button and textareas cannot drift apart',()=>{
  assert.match(source,/function enterEditMode\(/);
  assert.match(source,/function saveCanonicalEdits\(/);
  assert.match(source,/data-profile-field/);
  assert.match(source,/user_confirmed/);
  assert.match(source,/edit-profile/);
  assert.match(source,/stopImmediatePropagation/);
});

test('canonical edit mode is controlled only by runtime state, never stale editable DOM',()=>{
  assert.match(source,/function profileIsEditing\([^)]*\)\{return Boolean\(editing\);\}/);
  assert.doesNotMatch(source,/textarea:not\(\[readonly\]\)/);
});

test('Step 3 summarises signals without a broken link into the approval-gated next stage',()=>{
  assert.match(source,/active signal themes/i);
  assert.match(source,/Approve the profile below/i);
  assert.match(source,/intel-attention-panel/);
  assert.match(source,/intel-signal-theme/);
  assert.match(source,/role="list"/);
  assert.doesNotMatch(source,/Open Signal Designer|data-open-signal-designer/);
});

test('legacy lookalike textarea is retired from visible Step 2 intake',()=>{
  assert.match(source,/lookalike_customers/);
  assert.match(source,/question-card/);
  assert.match(source,/remove\(\)|hidden\s*=\s*true/);
});

test('legacy lower Profile Quality duplicate is removed and evidence becomes the only lower panel',()=>{
  assert.match(source,/intel-lower-compact/);
  assert.match(source,/second\.remove\(\)/);
});

test('legacy commercial context and evidence layout sidecars are not runtime dependencies anymore',()=>{
  assert.doesNotMatch(evidence,/commercial-context-layout\.js/);
  assert.doesNotMatch(evidence,/profile-evidence-layout\.js/);
});

test('runtime loads the new profile and reference-customer CSS with cache versions',()=>{
  assert.match(source,/intelligence-profile\.css\?v=/);
  assert.match(source,/reference-customers\.css\?v=/);
});
