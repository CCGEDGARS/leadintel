const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const brain=require('../company-brain.js');
const inference=require('../step2-first-party-intelligence.js');

const root=path.join(__dirname,'..');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

test('generic business classification does not invent buying triggers',()=>{
  const source={id:'S1',type:'website',url:'https://ccgroup.lv/',title:'Sales training',text:'Sales training and leadership coaching for B2B sales teams.'};
  const draft=inference.buildFirstPartyDraft({sources:[source],targetMarkets:['Latvia'],uiLanguage:'en'},brain);
  assert.equal(draft.buying_triggers?.value||'','');
});

test('Company Brain is explicitly loaded before Step 2 first-party inference',()=>{
  const brainPos=processMap.indexOf('company-brain.js');
  const inferencePos=processMap.indexOf('step2-first-party-intelligence.js');
  assert.ok(brainPos>=0&&inferencePos>brainPos);
});
