const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('commercial context uses two balanced columns for market focus, pains, buying situations and objective',()=>{
  const ui=read('business-identity.js');
  const app=read('app.js');

  assert.match(ui,/"currentMarkets","targetMarkets","marketFocus","customerPainPoints","buyingTriggers","commercialObjective"/,
    'Market Focus must pair with Customer Pain Points, followed by Buying Situations paired with Commercial Objective');
  assert.doesNotMatch(ui,/identity-customerPainPoints\{grid-column:1\/-1\}/,
    'Customer Pain Points must no longer span both columns');
  assert.match(ui,/painField\.classList\.remove\(['"]wide['"],['"]identity-wide['"]\)/,
    'Customer Pain Points must explicitly drop inherited full-width classes');
  assert.match(ui,/buyingTriggersField\?\.classList\.remove\(['"]wide['"],['"]identity-wide['"]\)/,
    'Buying Situations must be half width');
  assert.match(ui,/commercialObjectiveField\?\.classList\.remove\(['"]wide['"],['"]identity-wide['"]\)/,
    'Commercial Objective must be half width');

  assert.match(app,/\["customerPainPoints","Customer Pain Points",false\]/);
  assert.match(app,/\["buyingTriggers","Buying situations \/ triggers",false\]/);
  assert.match(app,/\["commercialObjective","6–12 month commercial objective",false\]/);
});
