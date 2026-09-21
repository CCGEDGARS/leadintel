const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const outreach=fs.readFileSync(path.join(root,'outreach-ui.js'),'utf8');
const engine=fs.readFileSync(path.join(root,'outreach-engine.js'),'utf8');

test('the core workspace is English-only and has no global translation controls',()=>{
  assert.doesNotMatch(html,/id=["']language-select["']/);
  assert.doesNotMatch(html,/src=["']language\.js/);
  assert.match(app,/function contentLanguage\(\)\{return 'en';\}/);
  assert.doesNotMatch(app,/localizeMarketGeneratedContent|leadintel:language-changed|LeadIntelLanguage/);
  assert.doesNotMatch(outreach,/leadintel:language-changed|LeadIntelLanguage/);
});

test('translation is an explicit Campaign Studio action',()=>{
  assert.match(outreach,/id=["']translate-outreach["']/);
  assert.match(outreach,/Translate \/ localize/);
  assert.match(outreach,/translate-outreach["']\)\?\.addEventListener\(["']click["'],confirmOutreachLanguage\)/);
  assert.doesNotMatch(outreach,/outreach-email-language["']\)\?\.addEventListener\(["']change["']/);
  assert.match(engine,/tone:'consultative',language:'en',status:'draft'/);
  assert.doesNotMatch(outreach,/Auto · recipient local language/);
});
