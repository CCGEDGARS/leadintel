import test from 'node:test';
import assert from 'node:assert/strict';
import {groundedContactSearch} from '../src/grounded-contact-search.js';

test('Gemini grounded search uses Google Search and admits only sourced direct or redirected URLs',async()=>{
  const calls=[];
  const result=await groundedContactSearch({apiKey:'test-key',model:'gemini-2.5-flash',company:'Södra',domain:'sodra.com',person:{name:'Lotta Lyrå',title:'CEO & President'},fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(url.includes('grounding-api-redirect'))return {status:302,headers:new Headers({location:'https://se.linkedin.com/in/lottalyra'})};
    return {ok:true,json:async()=>({candidates:[{groundingMetadata:{webSearchQueries:['Lotta Lyrå Södra LinkedIn'],groundingChunks:[
      {web:{uri:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc',title:'Lotta Lyrå – CEO & President på Södra'}},
      {web:{uri:'https://sodra.com/en/global/',title:'Södra contact'}},
      {web:{uri:'https://attacker.example/in/lotta',title:'Fake'}}
    ],groundingSupports:[{segment:{text:'Lotta Lyrå, CEO at Södra'},groundingChunkIndices:[0]}]}}],usageMetadata:{promptTokenCount:40,candidatesTokenCount:20}})};
  }});
  assert.deepEqual(result.results.map(row=>row.url),['https://se.linkedin.com/in/lottalyra','https://sodra.com/en/global']);
  assert.equal(result.results[0].description,'Lotta Lyrå, CEO at Södra');
  assert.equal(result.web_search,true);
  assert.deepEqual(JSON.parse(calls[0].options.body).tools,[{google_search:{}}]);
  assert.equal(calls[1].options.redirect,'manual');
});

test('ungrounded text and fabricated direct links are not treated as search evidence',async()=>{
  const result=await groundedContactSearch({apiKey:'test-key',model:'gemini-2.5-flash',company:'Södra',domain:'sodra.com',person:{name:'Lotta Lyrå'},fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'https://linkedin.com/in/fabricated'}]}}]})})});
  assert.equal(result.status,'unavailable');assert.deepEqual(result.results,[]);
});
