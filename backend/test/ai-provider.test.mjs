import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_PROVIDERS,normalizeAiProvider,defaultAiModel,generateText,verifyProviderCredential} from '../src/ai-provider.js';

test('supports exactly the three customer AI providers',()=>{
  assert.deepEqual(AI_PROVIDERS,['openai','anthropic','gemini']);
  assert.equal(normalizeAiProvider(' OpenAI '),'openai');
  assert.equal(normalizeAiProvider('ANTHROPIC'),'anthropic');
  assert.equal(normalizeAiProvider('google'),'gemini');
  assert.equal(normalizeAiProvider('gemini'),'gemini');
  assert.equal(normalizeAiProvider('other'),'');
});

test('provides editable production defaults for all three providers',()=>{
  assert.equal(defaultAiModel('openai'),'gpt-5.6');
  assert.equal(defaultAiModel('anthropic'),'claude-sonnet-4-6');
  assert.equal(defaultAiModel('gemini'),'gemini-3.7-flash');
});

test('OpenAI adapter uses Responses API without server-side response storage',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'Hello'}]}],usage:{input_tokens:12,output_tokens:3}}),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await generateText({provider:'openai',apiKey:'sk-test',model:'gpt-5.6',system:'System',prompt:'Prompt',maxOutputTokens:50,fetchImpl});
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization,'Bearer sk-test');
  assert.equal(request.body.store,false);
  assert.equal(request.body.model,'gpt-5.6');
  assert.equal(request.body.instructions,'System');
  assert.equal(request.body.input,'Prompt');
  assert.equal(result.text,'Hello');
  assert.deepEqual(result.usage,{input_tokens:12,output_tokens:3});
});

test('Anthropic adapter uses Messages API and extracts text',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify({content:[{type:'text',text:'Claude reply'}],usage:{input_tokens:9,output_tokens:4}}),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await generateText({provider:'anthropic',apiKey:'sk-ant-test',model:'claude-sonnet-4-6',system:'System',prompt:'Prompt',maxOutputTokens:50,fetchImpl});
  assert.equal(request.url,'https://api.anthropic.com/v1/messages');
  assert.equal(request.options.headers['x-api-key'],'sk-ant-test');
  assert.equal(request.options.headers['anthropic-version'],'2023-06-01');
  assert.equal(request.body.model,'claude-sonnet-4-6');
  assert.equal(request.body.system,'System');
  assert.deepEqual(request.body.messages,[{role:'user',content:'Prompt'}]);
  assert.equal(result.text,'Claude reply');
  assert.deepEqual(result.usage,{input_tokens:9,output_tokens:4});
});

test('Gemini adapter uses generateContent with x-goog-api-key and extracts text',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Gemini reply'}]}}],usageMetadata:{promptTokenCount:7,candidatesTokenCount:5}}),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await generateText({provider:'gemini',apiKey:'gem-test',model:'gemini-3.7-flash',system:'System',prompt:'Prompt',maxOutputTokens:50,fetchImpl});
  assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent');
  assert.equal(request.options.headers['x-goog-api-key'],'gem-test');
  assert.equal(request.body.system_instruction.parts[0].text,'System');
  assert.equal(request.body.contents[0].parts[0].text,'Prompt');
  assert.equal(result.text,'Gemini reply');
  assert.deepEqual(result.usage,{input_tokens:7,output_tokens:5});
});

test('provider errors are sanitized and never echo upstream bodies or keys',async()=>{
  const fetchImpl=async()=>new Response(JSON.stringify({error:{message:'Account owner secret details sk-live-do-not-leak'}}),{status:401,headers:{'Content-Type':'application/json'}});
  await assert.rejects(()=>generateText({provider:'openai',apiKey:'sk-live-do-not-leak',prompt:'x',fetchImpl}),error=>{
    assert.match(error.message,/OpenAI request failed \(401\)/);
    assert.doesNotMatch(error.message,/sk-live-do-not-leak/);
    assert.doesNotMatch(error.message,/Account owner secret details/);
    return true;
  });
});

test('credential verification performs a small real generation request with enough output budget for reasoning models',async()=>{
  let body;
  const fetchImpl=async(_url,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'OK'}]}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await verifyProviderCredential({provider:'openai',apiKey:'sk-test',model:'gpt-5.6',fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.provider,'openai');
  assert.equal(result.model,'gpt-5.6');
  assert.ok(Number(body.max_output_tokens)>=32&&Number(body.max_output_tokens)<=128);
});
