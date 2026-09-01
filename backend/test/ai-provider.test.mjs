import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_PROVIDERS,normalizeAiProvider,defaultAiModel,generateText,verifyProviderCredential,searchWeb} from '../src/ai-provider.js';

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

test('OpenAI web search uses hosted search, source inclusion and strict structured output',async()=>{
  let request;
  const payload={
    output:[
      {type:'web_search_call',status:'completed',action:{sources:[
        {type:'url',url:'https://example.com/news/office-move',title:'Office move'},
        {type:'url',url:'https://example.com/news/office-move/',title:'Duplicate canonical URL'},
        {type:'url',url:'https://linkedin.com/posts/acme-new-office',title:'LinkedIn post'}
      ]}},
      {type:'message',content:[{type:'output_text',text:JSON.stringify({results:[
        {title:'Acme opens a new office',url:'https://example.com/news/office-move',description:'Acme is moving into larger premises.',date:'2026-08-29'},
        {title:'Duplicate',url:'https://example.com/news/office-move/',description:'Duplicate source.',date:'2026-08-29'},
        {title:'LinkedIn announcement',url:'https://linkedin.com/posts/acme-new-office',description:'The company announced its new office.',date:'2026-08-30'},
        {title:'Invented source',url:'https://not-in-search.example/fake',description:'Must not be trusted.',date:'2026-08-31'}
      ]})}]}],
    usage:{input_tokens:110,output_tokens:42}
  };
  const fetchImpl=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await searchWeb({apiKey:'sk-test',model:'gpt-5.6',query:'Latvia companies moving to new offices',maxResults:5,fetchImpl});
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization,'Bearer sk-test');
  assert.equal(request.body.store,false);
  assert.deepEqual(request.body.tools,[{type:'web_search'}]);
  assert.equal(request.body.tool_choice,'required');
  assert.deepEqual(request.body.include,['web_search_call.action.sources']);
  assert.equal(request.body.text.format.type,'json_schema');
  assert.equal(request.body.text.format.strict,true);
  assert.equal(request.body.text.format.schema.properties.results.maxItems,5);
  assert.equal(result.provider,'openai');
  assert.equal(result.model,'gpt-5.6');
  assert.deepEqual(result.usage,{input_tokens:110,output_tokens:42});
  assert.equal(result.results.length,2);
  assert.deepEqual(result.results.map(row=>row.url),['https://example.com/news/office-move','https://linkedin.com/posts/acme-new-office']);
  assert.equal(result.results.some(row=>row.url.includes('not-in-search')),false);
});

test('OpenAI web search sanitizes upstream errors and never leaks provider secrets',async()=>{
  const fetchImpl=async()=>new Response(JSON.stringify({error:{message:'secret details sk-live-do-not-leak',type:'invalid_request_error',code:'invalid_tool'}}),{status:400,headers:{'Content-Type':'application/json'}});
  await assert.rejects(()=>searchWeb({apiKey:'sk-live-do-not-leak',model:'gpt-5.6',query:'office expansion Latvia',fetchImpl}),error=>{
    assert.match(error.message,/OpenAI request failed \(400\)/);
    assert.match(error.message,/invalid_tool/);
    assert.doesNotMatch(error.message,/sk-live-do-not-leak/);
    assert.doesNotMatch(error.message,/secret details/);
    return true;
  });
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

test('Gemini adapter uses current GenerateContent fields and extracts text',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Gemini reply'}]}}],usageMetadata:{promptTokenCount:7,candidatesTokenCount:5}}),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await generateText({provider:'gemini',apiKey:'gem-test',model:'gemini-3.7-flash',system:'System',prompt:'Prompt',maxOutputTokens:50,fetchImpl});
  assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent');
  assert.equal(request.options.headers['x-goog-api-key'],'gem-test');
  assert.equal(request.body.systemInstruction.parts[0].text,'System');
  assert.equal(request.body.contents[0].parts[0].text,'Prompt');
  assert.equal(result.text,'Gemini reply');
  assert.deepEqual(result.usage,{input_tokens:7,output_tokens:5});
});

test('provider errors expose only safe upstream code and parameter diagnostics',async()=>{
  const fetchImpl=async()=>new Response(JSON.stringify({error:{message:'Account owner secret details sk-live-do-not-leak',type:'invalid_request_error',code:'invalid_parameter',param:'max_output_tokens'}}),{status:400,headers:{'Content-Type':'application/json'}});
  await assert.rejects(()=>generateText({provider:'openai',apiKey:'sk-live-do-not-leak',prompt:'x',fetchImpl}),error=>{
    assert.match(error.message,/OpenAI request failed \(400\)/);
    assert.match(error.message,/invalid_parameter/);
    assert.match(error.message,/max_output_tokens/);
    assert.doesNotMatch(error.message,/sk-live-do-not-leak/);
    assert.doesNotMatch(error.message,/Account owner secret details/);
    return true;
  });
});

test('Gemini diagnostics expose safe status instead of provider message text',async()=>{
  const fetchImpl=async()=>new Response(JSON.stringify({error:{code:400,status:'INVALID_ARGUMENT',message:'Secret Gemini details AIza-do-not-leak'}}),{status:400,headers:{'Content-Type':'application/json'}});
  await assert.rejects(()=>generateText({provider:'gemini',apiKey:'AIza-do-not-leak',prompt:'x',fetchImpl}),error=>{
    assert.match(error.message,/Gemini request failed \(400\)/);
    assert.match(error.message,/INVALID_ARGUMENT/);
    assert.doesNotMatch(error.message,/AIza-do-not-leak/);
    assert.doesNotMatch(error.message,/Secret Gemini details/);
    return true;
  });
});

test('OpenAI credential verification matches the official minimal Responses request',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'OK'}]}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await verifyProviderCredential({provider:'openai',apiKey:'sk-test',model:'gpt-5.6',fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.provider,'openai');
  assert.equal(result.model,'gpt-5.6');
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.deepEqual(request.body,{model:'gpt-5.6',input:'Reply with exactly OK.'});
});

test('Anthropic credential verification matches the current Messages contract',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify({content:[{type:'text',text:'OK'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await verifyProviderCredential({provider:'anthropic',apiKey:'sk-ant-test',model:'claude-sonnet-4-6',fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(request.url,'https://api.anthropic.com/v1/messages');
  assert.equal(request.options.headers['x-api-key'],'sk-ant-test');
  assert.equal(request.options.headers['anthropic-version'],'2023-06-01');
  assert.deepEqual(request.body,{model:'claude-sonnet-4-6',max_tokens:64,messages:[{role:'user',content:'Reply with exactly OK.'}]});
});

test('Gemini credential verification uses a minimal GenerateContent request without an output cap',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'OK'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await verifyProviderCredential({provider:'gemini',apiKey:'AIza-test',model:'gemini-3.7-flash',fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent');
  assert.equal(request.options.headers['x-goog-api-key'],'AIza-test');
  assert.deepEqual(request.body,{contents:[{role:'user',parts:[{text:'Reply with exactly OK.'}]}]});
});
