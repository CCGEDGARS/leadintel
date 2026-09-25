import test from 'node:test';
import assert from 'node:assert/strict';
import * as extractionFallback from '../src/company-extraction-fallback.js';

test('retryable OpenAI extraction failures reuse the evidence request with Gemini and disclose fallback',async()=>{
  assert.equal(typeof extractionFallback.generateCompanyExtraction, 'function', 'company extraction fallback behavior must be implemented');
  const request={system:'Extract only source-backed operating companies.',prompt:'Evidence E1: https://example.com/news',maxOutputTokens:1800};
  const calls=[];
  const primary={provider:'openai',model:'gpt-5.6',encrypted_api_key:'encrypted-openai'};
  const backup={provider:'gemini',model:'gemini-3.7-flash',encrypted_api_key:'encrypted-gemini'};
  const result=await extractionFallback.generateCompanyExtraction({
    task:'company-extraction',fallbackProvider:'gemini',primaryIntegration:primary,
    getFallbackIntegration:async()=>backup,request,
    runProvider:async(integration,payload)=>{
      calls.push({provider:integration.provider,payload});
      if(integration.provider==='openai')throw new Error('OpenAI request failed (429) · code: insufficient_quota');
      return {provider:'gemini',model:integration.model,text:'{"companies":[{"company":"Northstar AB","sourceUrl":"https://example.com/news"}]}'};
    }
  });

  assert.equal(result.ok,true);
  assert.equal(result.result.provider,'gemini');
  assert.deepEqual(calls.map(call=>call.provider),['openai','gemini']);
  assert.strictEqual(calls[0].payload,request);
  assert.strictEqual(calls[1].payload,request,'Gemini must receive the same evidence payload');
  assert.deepEqual(result.fallback,{status:'used',used:true,from:'openai',provider:'gemini',reason:'quota_or_rate_limit'});

  const emptyCalls=[];
  const empty=await extractionFallback.generateCompanyExtraction({
    task:'company-extraction',fallbackProvider:'gemini',primaryIntegration:primary,
    getFallbackIntegration:async()=>backup,request,
    runProvider:async integration=>{emptyCalls.push(integration.provider);return {provider:'openai',model:primary.model,text:'{"companies":[]}'};}
  });
  assert.equal(empty.ok,true);
  assert.deepEqual(emptyCalls,['openai'],'a successful empty answer must not trigger a paid Gemini call');
  assert.equal(empty.fallback.used,false);
});

test('provider timeouts and outages retry once, while validation failures and other tasks do not',async()=>{
  const primary={provider:'openai',model:'gpt-5.6',encrypted_api_key:'encrypted-openai'};
  const backup={provider:'gemini',model:'gemini-3.7-flash',encrypted_api_key:'encrypted-gemini'};
  const request={system:'Extract only source-backed companies.',prompt:'Evidence E1',maxOutputTokens:1800};
  for(const [message,reason] of [['OpenAI request timed out','timeout'],['OpenAI request failed (503)','provider_outage']]){
    const calls=[];
    const attempt=await extractionFallback.generateCompanyExtraction({task:'company-extraction',fallbackProvider:'gemini',primaryIntegration:primary,getFallbackIntegration:async()=>backup,request,runProvider:async integration=>{
      calls.push(integration.provider);
      if(integration.provider==='openai')throw new Error(message);
      return {provider:'gemini',model:backup.model,text:'{"companies":[]}'};
    }});
    assert.equal(attempt.ok,true);
    assert.equal(attempt.fallback.reason,reason);
    assert.deepEqual(calls,['openai','gemini']);
  }
  let calls=0;
  const invalid=await extractionFallback.generateCompanyExtraction({task:'company-extraction',fallbackProvider:'gemini',primaryIntegration:primary,getFallbackIntegration:async()=>backup,request,runProvider:async()=>{calls++;throw new Error('OpenAI request failed (400) · code: invalid_parameter');}});
  assert.equal(invalid.ok,false);
  assert.equal(invalid.fallback.status,'not_used');
  assert.equal(calls,1,'invalid extraction requests must not spend a second provider call');
  const otherTask=await extractionFallback.generateCompanyExtraction({task:'general-writing',fallbackProvider:'gemini',primaryIntegration:primary,getFallbackIntegration:async()=>backup,request,runProvider:async()=>{calls++;throw new Error('OpenAI request failed (429)');}});
  assert.equal(otherTask.fallback.status,'not_used');
  assert.equal(calls,2,'Gemini failover is limited to company extraction');
});

test('missing or failing Gemini fallback is reported without hiding the primary failure',async()=>{
  const primary={provider:'openai',model:'gpt-5.6',encrypted_api_key:'encrypted-openai'};
  const request={prompt:'Evidence',maxOutputTokens:1800};
  const runProvider=async integration=>{if(integration.provider==='openai')throw new Error('OpenAI request failed (429)');throw new Error('Gemini request failed (503)');};
  const missing=await extractionFallback.generateCompanyExtraction({task:'company-extraction',fallbackProvider:'gemini',primaryIntegration:primary,getFallbackIntegration:async()=>null,request,runProvider});
  assert.equal(missing.ok,false);
  assert.equal(missing.error.message,'OpenAI request failed (429)');
  assert.equal(missing.fallback.status,'not_configured');
  const failed=await extractionFallback.generateCompanyExtraction({task:'company-extraction',fallbackProvider:'gemini',primaryIntegration:primary,getFallbackIntegration:async()=>({provider:'gemini',encrypted_api_key:'encrypted-gemini'}),request,runProvider});
  assert.equal(failed.ok,false);
  assert.equal(failed.error.message,'Gemini request failed (503)');
  assert.equal(failed.fallback.status,'failed');
});
