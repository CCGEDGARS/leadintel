const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../discovery.css'),'utf8');

test('Discovery autonomously broadens search when the requested qualified count is not met',()=>{
  assert.match(ui,/MAX_AUTONOMOUS_DISCOVERY_PASSES=3/);
  assert.match(ui,/totalQualified<targetCount&&autoPass<MAX_AUTONOMOUS_DISCOVERY_PASSES/);
  assert.match(ui,/runCompanyDiscovery\(\{savingMode:false,autoPass:autoPass\+1\}\)/);
  assert.match(ui,/LeadIntel is broadening the search automatically/);
});

test('Discovery stops after bounded autonomous research rather than lowering qualification',()=>{
  assert.match(ui,/Research budget exhausted/);
  assert.match(ui,/exhausted/);
  assert.match(ui,/It will not lower the qualification threshold just to fill the list/);
});

test('Qualified cards distinguish score, evidence confidence and buying intent',()=>{
  assert.match(ui,/Qualification score \/100/);
  assert.match(ui,/Evidence confidence/);
  assert.match(ui,/Buying intent<\/strong> Unconfirmed/);
  assert.match(ui,/Independent source families/);
});

test('Qualified cards prioritize commercial decision information and collapse raw evidence',()=>{
  assert.match(ui,/WHAT THEY COULD BUY/);
  assert.match(ui,/WHY NOW/);
  assert.match(ui,/WHY THIS COMPANY/);
  assert.match(ui,/candidate-evidence-details/);
  assert.match(css,/\.opportunity-brief/);
  assert.match(css,/\.opportunity-trust-strip/);
});
