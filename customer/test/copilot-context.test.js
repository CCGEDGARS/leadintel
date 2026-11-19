import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-context.js',import.meta.url),'utf8');

test('screen context exposes only navigation metadata',()=>{
  assert.match(source,/export\s+function\s+currentCopilotScreenContext/);
  assert.match(source,/step/);assert.match(source,/label/);
  assert.match(source,/entity_type/);assert.match(source,/entity_id/);
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
  assert.doesNotMatch(source,/\.value\b|FormData|innerHTML|textContent\s*\.slice|querySelectorAll\([^)]*(?:input|textarea|select)/i);
});

test('contextual prompts are step-based and do not trigger model calls',()=>{
  assert.match(source,/export\s+function\s+contextualPromptSuggestions/);
  assert.doesNotMatch(source,/fetch\s*\(|sendCopilotMessage|requestCopilot/);
});

test('Companies shares ranked visible scores and marks previous scores',async()=>{
  const step={dataset:{step:'5'}};
  const row=(data,visible=true)=>({
    getClientRects:()=>visible?[{}]:[],
    querySelector:()=>({dataset:data})
  });
  const rows=[
    row({companyKey:'first.example',companyScore:'66',scoreState:'current'}),
    row({companyKey:'older.example',companyScore:'62',scoreState:'previous'}),
    row({companyKey:'hidden.example',companyScore:'99',scoreState:'current'},false),
    row({companyKey:'pending.example',companyScore:'',scoreState:'pending'})
  ];
  globalThis.document={
    getElementById:()=>null,
    querySelector:selector=>selector.includes('.step-view')?step:null,
    querySelectorAll:selector=>selector.includes('.company-result-row')?rows:[]
  };
  globalThis.window={};
  try{
    const {currentCopilotScreenContext}=await import('data:text/javascript,'+encodeURIComponent(source));
    assert.deepEqual(currentCopilotScreenContext().companyScores,[
      {domain:'first.example',score:66,state:'current'},
      {domain:'older.example',score:62,state:'previous'}
    ]);
  }finally{
    delete globalThis.document;
    delete globalThis.window;
  }
});
