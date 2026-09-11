const test=require('node:test');
const assert=require('node:assert/strict');

const AI=require('../reference-customer-ai.js');

test('AI prompt asks for per-company commercial analysis and conservative segmentation',()=>{
  const prompt=AI.buildReferenceCustomerPrompt([
    {id:'a',companyName:'Factory A',website:'https://a.example',text:'Industrial manufacturer with 220 employees and export growth.'},
    {id:'b',companyName:'SaaS B',website:'https://b.example',text:'B2B software company serving commercial teams.'}
  ]);
  assert.match(prompt,/industry/i);
  assert.match(prompt,/sizeBand/i);
  assert.match(prompt,/buyerRoles/i);
  assert.match(prompt,/segments/i);
  assert.match(prompt,/do not invent/i);
  assert.match(prompt,/no meaningful/i);
});

test('AI response parser accepts fenced JSON and preserves meaningful repeated segment membership',()=>{
  const parsed=AI.parseReferenceCustomerAnalysis('```json\n'+JSON.stringify({
    companies:[
      {id:'a',industry:'industrial manufacturing',sizeBand:'100-500',businessModel:'B2B',confidence:'high'},
      {id:'b',industry:'industrial manufacturing',sizeBand:'100-500',businessModel:'B2B',confidence:'high'},
      {id:'c',industry:'software / technology',sizeBand:'50-100',businessModel:'B2B',confidence:'medium'},
      {id:'d',industry:'software / technology',sizeBand:'50-100',businessModel:'B2B',confidence:'medium'}
    ],
    segmentation:{meaningful:true,segments:[
      {name:'Industrial manufacturers',rowIds:['a','b'],confidence:'high',summary:'Manufacturing accounts'},
      {name:'B2B software',rowIds:['c','d'],confidence:'medium',summary:'Software accounts'}
    ]}
  })+'\n```',['a','b','c','d']);
  assert.equal(parsed.segmentationMeaningful,true);
  assert.equal(parsed.segments.length,2);
  assert.equal(parsed.analyses.a.industry,'industrial manufacturing');
  assert.deepEqual(parsed.segments[1].rowIds,['c','d']);
});

test('AI response parser rejects weak singleton segmentation and falls back to one coherent group',()=>{
  const parsed=AI.parseReferenceCustomerAnalysis(JSON.stringify({
    companies:[
      {id:'a',industry:'manufacturing',confidence:'high'},
      {id:'b',industry:'software',confidence:'high'}
    ],
    segmentation:{meaningful:true,segments:[
      {name:'Manufacturing',rowIds:['a'],confidence:'high'},
      {name:'Software',rowIds:['b'],confidence:'high'}
    ]}
  }),['a','b']);
  assert.equal(parsed.segmentationMeaningful,false);
  assert.equal(parsed.segments.length,1);
  assert.deepEqual(new Set(parsed.segments[0].rowIds),new Set(['a','b']));
});

test('AI response parser rejects segment row ids that were not supplied',()=>{
  const parsed=AI.parseReferenceCustomerAnalysis(JSON.stringify({
    companies:[{id:'a',industry:'manufacturing',confidence:'high'}],
    segmentation:{meaningful:true,segments:[{name:'Bad',rowIds:['a','invented'],confidence:'high'}]}
  }),['a']);
  assert.deepEqual(parsed.segments[0].rowIds,['a']);
});

test('AI analysis posts through the authenticated LeadIntel AI generate route',async()=>{
  const calls=[];
  const result=await AI.requestReferenceCustomerAnalysis({
    workspaceId:'ws-123',
    rows:[{id:'a',companyName:'Acme',website:'https://acme.example',text:'B2B manufacturer'}],
    fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({text:JSON.stringify({companies:[{id:'a',industry:'manufacturing',confidence:'high'}],segmentation:{meaningful:false,segments:[]}})})};}
  });
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/\/api\/ai\/generate\?workspace_id=ws-123/);
  assert.equal(calls[0].options.credentials,'include');
  assert.equal(result.analyses.a.industry,'manufacturing');
});

test('AI response parser extracts valid JSON surrounded by model commentary',()=>{
  const parsed=AI.parseReferenceCustomerAnalysis('Here is the analysis:\n'+JSON.stringify({companies:[{id:'a',industry:'manufacturing',confidence:'high'}],segmentation:{meaningful:false,segments:[]}})+'\nAnalysis complete.',['a']);
  assert.equal(parsed.analyses.a.industry,'manufacturing');
});

test('AI analysis retries once with a compact recovery prompt after malformed output',async()=>{
  const calls=[];
  const responses=['{"companies":[',JSON.stringify({companies:[{id:'a',industry:'manufacturing',confidence:'high'}],segmentation:{meaningful:false,segments:[]}})];
  const result=await AI.requestReferenceCustomerAnalysis({
    workspaceId:'ws-123',rows:[{id:'a',companyName:'Acme',website:'https://acme.example',text:'B2B manufacturer'}],
    fetchImpl:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({text:responses.shift()})};}
  });
  assert.equal(calls.length,2);
  assert.match(calls[1].prompt,/recovery attempt/i);
  assert.equal(calls[1].max_output_tokens,8192);
  assert.equal(result.analyses.a.industry,'manufacturing');
});
