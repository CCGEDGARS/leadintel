import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVerificationRequest,parseVerificationResponse,verifyMarketResearch} from '../src/market-research-verifier.js';
import {handleAiRoute} from '../src/ai-routes.js';

const evidence=[
  {id:'evidence-1',url:'https://example.com/a',title:'Factory expansion',description:'A new production line is planned.',date:'2026-09-10'},
  {id:'evidence-2',url:'https://example.org/b',title:'Hiring notice',description:'The company is hiring engineers.',date:'2026-09-11'}
];

test('Gemini verification is explicitly evidence-bound and has no web-search role',()=>{
  const request=buildVerificationRequest({mode:'deep',profile:{targetMarkets:'Latvia'},signals:[{name:'Expansion'}],evidence});
  assert.match(request.system,/do not browse|no web access/i);
  assert.match(request.prompt,/evidence-1/);
  assert.match(request.prompt,/https:\/\/example\.com\/a/);
  assert.equal(request.maxOutputTokens,2400);
});

test('verification parser rejects invented evidence ids and sanitizes verdicts',()=>{
  const result=parseVerificationResponse(JSON.stringify({
    summary:'Expansion evidence is stronger than hiring evidence.',
    verdicts:[
      {evidence_id:'evidence-1',relevance:'strong',commercial_fit:'strong',contradiction:false,rationale:'Direct expansion announcement.',missing_evidence:[]},
      {evidence_id:'invented-9',relevance:'strong',commercial_fit:'strong',contradiction:false,rationale:'Must be removed.',missing_evidence:[]}
    ],
    disagreements:['Hiring does not prove purchasing intent.'],missing_evidence:['Budget evidence']
  }),evidence);
  assert.equal(result.web_search,false);
  assert.equal(result.role,'verification');
  assert.deepEqual(result.verdicts.map(item=>item.evidence_id),['evidence-1']);
  assert.deepEqual(result.missing_evidence,['Budget evidence']);
});

test('verification invokes only Gemini and returns safe structured metadata',async()=>{
  let call;
  const generate=async input=>{call=input;return {text:'```json\n{"summary":"Cross-check complete","verdicts":[],"disagreements":[],"missing_evidence":[]}\n```',usage:{input_tokens:12,output_tokens:8}};};
  const result=await verifyMarketResearch({apiKey:'gem-test',model:'gemini-test',mode:'intelligence',profile:{},signals:[],evidence,generate});
  assert.equal(call.provider,'gemini');
  assert.equal(result.provider,'gemini');
  assert.equal(result.model,'gemini-test');
  assert.equal(result.web_search,false);
  assert.deepEqual(result.usage,{input_tokens:12,output_tokens:8});
});

test('malformed verifier output fails closed',()=>{
  assert.throws(()=>parseVerificationResponse('not json',evidence),/valid JSON/i);
});

test('research verification is non-fatal when Gemini is not configured',async()=>{
  const DB={prepare(sql){return {bind(){return {first:async()=>sql.includes('FROM sessions')?{id:'user-1'}:sql.includes('workspace_members')?{role:'researcher'}:null};}};}};
  const request=new Request('https://api.example/api/ai/research-verification?workspace_id=workspace-1',{method:'POST',headers:{Cookie:'leadintel_session=session-token','Content-Type':'application/json'},body:JSON.stringify({mode:'deep',profile:{},signals:[],evidence})});
  const response=await handleAiRoute(request,{DB,OAUTH_TOKEN_ENCRYPTION_KEY:'configured-key'},{});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'unavailable',provider:'gemini',role:'verification',web_search:false,reason:'Gemini is not configured'});
});
