const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');

test('Discovery applies decision-maker ranking before persisting Apollo people',()=>{
  assert.match(ui,/LeadIntelDiscovery\.selectDecisionMakers\(\s*LeadIntelDiscovery\.normalizeApolloPeople\([^)]*\)\s*,\s*main\.profile\s*\|\|\s*\{\}\s*,\s*4\s*\)/s);
});

test('Discovery makes a shortage explicit instead of implying four contacts were found',()=>{
  assert.match(ui,/relevant decision-maker/i);
  assert.match(ui,/people\.length\s*<\s*3/);
});
