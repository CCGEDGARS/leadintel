import test from 'node:test';
import assert from 'node:assert/strict';
import {groundedContactSearch} from '../src/grounded-contact-search.js';
import {searchGeminiWeb} from '../src/ai-task-routing.js';

for(const [model,thinking] of [['gemini-3.7-flash',{thinkingLevel:'low'}],['gemini-3.8-flash',{thinkingLevel:'low'}],['gemini-2.5-flash',{thinkingBudget:1024}]]){
 for(const operation of ['contact','general'])test(`${operation} grounded research bounds reasoning while retaining real Google grounding: ${model}`,async()=>{
  let body;
  const fetchImpl=async(_url,options)=>{body=JSON.parse(options.body);return Response.json({candidates:[{groundingMetadata:{webSearchQueries:['Alex Morgan Acme Labs'],groundingChunks:[{web:{uri:'https://acme.example/team',title:'Team'}}],groundingSupports:[{segment:{text:'Alex Morgan, CEO at Acme Labs'},groundingChunkIndices:[0]}]}}]});};
  const result=await (operation==='contact'?groundedContactSearch({apiKey:'fixture',model,company:'Acme Labs',domain:'acme.example',person:{name:'Alex Morgan',title:'CEO'},fetchImpl}):searchGeminiWeb({apiKey:'fixture',model,query:'Alex Morgan Acme Labs',fetchImpl}));
  assert.deepEqual(body.generationConfig.thinkingConfig,thinking);assert.deepEqual(body.tools,[{google_search:{}}]);assert.equal(result.web_search,true);assert.equal(result.results[0].url,'https://acme.example/team');assert.equal(result.results[0].evidenceKind,'model_summary','Grounded summaries still need actual source reads');
 });
}
