import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  assert.equal(defaultAiModel('openai'),'gpt-6.1-sol');
  assert.equal(defaultAiModel('anthropic'),'claude-sonnet-5-5');
  assert.equal(defaultAiModel('gemini'),'gemini-3.8-flash');
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
  assert.equal(request.body.max_tool_calls,2);
  assert.equal(request.body.max_output_tokens,4000);
  assert.deepEqual(request.body.reasoning,{effort:'low'});
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

test('source-access audit uses provider, API, terms and automation research instructions',async()=>{
  let request;const sourceUrl='https://provider.example/api';
  const payload={output:[{type:'web_search_call',action:{sources:[{url:sourceUrl,title:'API'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({results:[{title:'API',url:sourceUrl,description:'Official API',date:'2026-09-12'}]})}]}]};
  const fetchImpl=async(url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});};
  await searchWeb({apiKey:'sk-test',model:'gpt-5.6',query:'Can we access provider.example?',purpose:'source_access_audit',fetchImpl});
  assert.match(request.instructions,/official service\/API pages/i);assert.match(request.instructions,/terms of use/i);assert.match(request.instructions,/public webpage visibility/i);assert.match(request.instructions,/authorised API access/i);
});

test('contact research labels generated summaries so contact extraction requires source text',async()=>{
  const url='https://example.com/team';
  const payload={output:[{type:'web_search_call',action:{sources:[{url,title:'Team'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({results:[{title:'Team',url,description:'Anna Smith anna.smith@example.com',date:''}]})}]}]};
  const result=await searchWeb({apiKey:'sk-test',query:'Find Anna Smith contacts',purpose:'contact_research',fetchImpl:async()=>new Response(JSON.stringify(payload))});
  assert.equal(result.results[0].evidenceKind,'model_summary');
  assert.equal(result.results[0].url,url);
});

test('business assistant research uses general primary-source evidence rather than buying-signal instructions',async()=>{
 let request;const url='https://company.example/project';
 const payload={output:[{type:'web_search_call',action:{sources:[{url}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({results:[{title:'Project',url,description:'Official details',date:''}]})}]}]};
 await searchWeb({apiKey:'sk-test',query:'Explain this public project',purpose:'assistant_research',fetchImpl:async(_url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify(payload));}});
 assert.match(request.instructions,/general facts|official documentation/);assert.match(request.instructions,/Inspect underlying sources/);assert.equal(request.max_tool_calls,4);assert.equal(request.tool_choice,'required');
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

test('web search retains actual discovered sources when structured summary is malformed',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return new Response(JSON.stringify({output:[{type:'web_search_call',action:{sources:[{url:'https://buyer.example/project',title:'Buyer project'}]}},{type:'message',content:[{type:'output_text',text:'not valid JSON'}]}]}));};
  const result=await searchWeb({apiKey:'sk-test',query:'buyer expansion',fetchImpl});
  assert.equal(calls,1);assert.equal(result.results[0].url,'https://buyer.example/project');assert.equal(result.results[0].description,'');assert.equal(result.results[0].date,'');assert.match(result.warning,/require extraction/);
});
test('web search preserves safe failure categories without upstream secrets',async()=>{
  const params={apiKey:'sk-test',query:'buyer expansion'};
  await assert.rejects(()=>searchWeb({...params,fetchImpl:async()=>{throw new DOMException('private details','AbortError');}}),/timed out or was cancelled/);
  await assert.rejects(()=>searchWeb({...params,fetchImpl:async()=>{throw new TypeError('private details sk-secret');}}),/OpenAI network error while requesting web search/);
  await assert.rejects(()=>searchWeb({...params,fetchImpl:async()=>new Response(JSON.stringify({output:[]}))}),/returned no answer text/);
  await assert.rejects(()=>searchWeb({...params,fetchImpl:async()=>new Response(JSON.stringify({output_text:'not JSON'}))}),/returned invalid structured output/);
});
test('OpenAI web search forwards the caller abort signal to the upstream request',async()=>{
  const controller=new AbortController();let requestSignal;
  const fetchImpl=async(url,options)=>{
    requestSignal=options.signal;
    const payload={output:[{type:'web_search_call',action:{sources:[]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({results:[]})}]}]};
    return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
  };
  await searchWeb({apiKey:'sk-test',model:'gpt-5.6',query:'Latvia market',signal:controller.signal,fetchImpl});
  assert.equal(requestSignal,controller.signal);
});

test('web-search route links request cancellation to its bounded provider signal and prevents fallback',async()=>{
  const {handleAiRoute}=await import('../src/ai-routes.js'),{storageDb}=await import('./workspace-storage-fixture.mjs'),{sha256}=await import('../src/security.js'),{importAesKey,encryptSecret}=await import('../src/oauth.js');
  const DB=storageDb(),env={DB,OAUTH_TOKEN_ENCRYPTION_KEY:btoa('a'.repeat(32))},controller=new AbortController(),old=globalThis.fetch;let providerSignal,calls=0;
  DB.raw.prepare("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES('storage-owner',?,datetime('now','+1 day'))").run(await sha256('abort-test'));
  const encrypted=await encryptSecret('private-test-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
  for(const provider of ['openai','gemini'])DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES('storage-w1',?,?,'hidden','test',?)").run(provider,encrypted,provider==='openai'?1:0);
  globalThis.fetch=async(_url,options)=>{calls++;providerSignal=options.signal;assert.equal(providerSignal.aborted,false);controller.abort();assert.equal(providerSignal.aborted,true);throw new DOMException('Canceled','AbortError');};
  try{
    const response=await handleAiRoute(new Request('https://api.test/api/ai/web-search?workspace_id=storage-w1',{method:'POST',signal:controller.signal,headers:{Cookie:'leadintel_session=abort-test','Content-Type':'application/json'},body:JSON.stringify({query:'Example projects'})}),env);
    assert.equal(response.status,499);assert.equal(providerSignal.aborted,true);assert.equal(calls,1);assert.equal(DB.raw.prepare("SELECT count(*) n FROM audit_events WHERE event_type='ai.web_search_completed'").get().n,0);
  }finally{globalThis.fetch=old;}
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

test('Gemini dossier extraction requests JSON and low thinking without changing ordinary text calls',async()=>{
  const bodies=[];const fetchImpl=async(_url,options)=>{bodies.push(JSON.parse(options.body));return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"people":[]}' } ]}}]});};
  const result=await generateText({provider:'gemini',apiKey:'fixture',model:'gemini-3.8-flash',prompt:'Extract JSON',responseFormat:'json',reasoningEffort:'low',maxOutputTokens:6000,fetchImpl});
  assert.deepEqual(JSON.parse(result.text),{people:[]});
  assert.deepEqual(bodies[0].generationConfig,{maxOutputTokens:6000,responseMimeType:'application/json',thinkingConfig:{thinkingLevel:'low'}});
  await generateText({provider:'gemini',apiKey:'fixture',model:'gemini-2.0-flash',prompt:'Write text',fetchImpl});
  assert.deepEqual(bodies[1].generationConfig,{maxOutputTokens:1200});
  await generateText({provider:'gemini',apiKey:'fixture',model:'gemini-2.5-pro',prompt:'Extract JSON',responseFormat:'json',reasoningEffort:'low',fetchImpl});
  assert.deepEqual(bodies[2].generationConfig.thinkingConfig,{thinkingBudget:1024});
});

test('Gemini truncated extraction is an explicit token-limit failure, never accepted as complete JSON',async()=>{
  await assert.rejects(generateText({provider:'gemini',apiKey:'fixture',prompt:'Extract JSON',responseFormat:'json',fetchImpl:async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"people":[]}' }]}}]})}),/Gemini response exceeded output token limit/);
});

test('text generation forwards abort signals to OpenAI and Gemini provider requests',async()=>{
  for(const provider of ['openai','gemini']){
    const controller=new AbortController();let receivedSignal;
    const fetchImpl=async(url,options)=>{
      receivedSignal=options.signal;
      const payload=provider==='openai'
        ?{output:[{type:'message',content:[{type:'output_text',text:'{"companies":[]}'}]}]}
        :{candidates:[{content:{parts:[{text:'{"companies":[]}'}]}}]};
      return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
    };
    await generateText({provider,apiKey:'provider-test-key',model:provider==='openai'?'gpt-5.6':'gemini-3.7-flash',prompt:'Extract companies',signal:controller.signal,fetchImpl});
    assert.strictEqual(receivedSignal,controller.signal,`${provider} request must be abortable`);
  }
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
test('text-generation timeouts retain their cause instead of reporting an upstream 502',async()=>{
 for(const provider of AI_PROVIDERS)await assert.rejects(generateText({provider,apiKey:'fixture',prompt:'Read this section',fetchImpl:async()=>{throw new DOMException('expired','TimeoutError');}}),/request timed out/);
});
test('writing analysis can request low reasoning without changing normal generation',async()=>{
 let body;await generateText({provider:'openai',apiKey:'fixture',model:'gpt-6.1-sol',prompt:'Analyse source',reasoningEffort:'low',fetchImpl:async(url,options)=>{body=JSON.parse(options.body);return Response.json({output_text:'ok'});}});assert.deepEqual(body.reasoning,{effort:'low'});
});

// Speed burst step 1 (2026-10-26): the copilot asks for no reasoning. OpenAI gpt-5/6 models get the value verbatim (an unsupported model answers 400 and the
// caller falls back); Gemini 3.8 Flash rejects `minimal`, so Gemini takes `low`; Anthropic's lowest level is `low`.
test('reasoningEffort none reaches OpenAI verbatim and becomes the lowest safe level elsewhere',async()=>{
  let body;const openai=async(_url,options)=>{body=JSON.parse(options.body);return Response.json({output_text:'ok'});};
  await generateText({provider:'openai',apiKey:'fixture',model:'gpt-6-luna',prompt:'Short',reasoningEffort:'none',fetchImpl:openai});
  assert.deepEqual(body.reasoning,{effort:'none'});
  await generateText({provider:'openai',apiKey:'fixture',model:'gpt-4.1',prompt:'Short',reasoningEffort:'none',fetchImpl:openai});
  assert.equal(body.reasoning,undefined,'models outside gpt-5/6 take no reasoning parameter');
  const bodies=[];const gemini=async(_url,options)=>{bodies.push(JSON.parse(options.body));return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'ok'}]}}]});};
  await generateText({provider:'gemini',apiKey:'fixture',model:'gemini-3.8-flash',prompt:'Short',reasoningEffort:'none',fetchImpl:gemini});
  assert.deepEqual(bodies[0].generationConfig.thinkingConfig,{thinkingLevel:'low'});
  let anthropic;const claude=async(_url,options)=>{anthropic=JSON.parse(options.body);return Response.json({content:[{type:'text',text:'ok'}]});};
  await generateText({provider:'anthropic',apiKey:'fixture',model:'claude-sonnet-5-5',prompt:'Short',reasoningEffort:'none',fetchImpl:claude});
  assert.deepEqual(anthropic.output_config,{effort:'low'});
});

// Speed burst step 2 (2026-10-26): token streaming for the three providers. A fetch stub answers with text/event-stream; deltas arrive in order; the
// returned shape matches generateText; a JSON (non-stream) response still works; upstream errors stay sanitized.
import {generateTextStream} from '../src/ai-provider.js';
function sse(frames,headers={'Content-Type':'text/event-stream'}){const bytes=new TextEncoder().encode(frames.join(''));const body=new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));controller.close();}});return new Response(body,{status:200,headers});}
test('OpenAI Responses streaming delivers output_text deltas in order and usage from the completed event',async()=>{
  let body;const fetchImpl=async(_url,options)=>{body=JSON.parse(options.body);return sse(['event: response.created\ndata: {"type":"response.created"}\n\n','event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"{\\"answer\\":\\"Hel"}\n\n','event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"lo\\"}"}\n\n','event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":12,"output_tokens":5}}}\n\n']);};
  const deltas=[];const result=await generateTextStream({provider:'openai',apiKey:'fixture',model:'gpt-6-luna',system:'s',prompt:'p',reasoningEffort:'none',fetchImpl,onDelta:text=>deltas.push(text)});
  assert.equal(body.stream,true);assert.deepEqual(body.reasoning,{effort:'none'});
  assert.deepEqual(deltas,['{"answer":"Hel','lo"}']);assert.equal(result.text,'{"answer":"Hello"}');assert.deepEqual(result.usage,{input_tokens:12,output_tokens:5});assert.equal(result.provider,'openai');assert.equal(result.model,'gpt-6-luna');
});
test('Anthropic streaming delivers text_delta events and usage from message_start and message_delta',async()=>{
  let body;const fetchImpl=async(_url,options)=>{body=JSON.parse(options.body);return sse(['event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":30,"output_tokens":1}}}\n\n','event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}\n\n','event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hidden"}}\n\n','event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"{\\"answer\\":\\"A"}}\n\n','event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"B\\"}"}}\n\n','event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":9}}\n\n','event: message_stop\ndata: {"type":"message_stop"}\n\n']);};
  const deltas=[];const result=await generateTextStream({provider:'anthropic',apiKey:'fixture',model:'claude-sonnet-5-5',system:'s',prompt:'p',reasoningEffort:'none',fetchImpl,onDelta:text=>deltas.push(text)});
  assert.equal(body.stream,true);assert.deepEqual(deltas,['{"answer":"A','B"}']);assert.equal(result.text,'{"answer":"AB"}');assert.deepEqual(result.usage,{input_tokens:30,output_tokens:9});
});
test('Gemini streaming uses streamGenerateContent with alt=sse and concatenates candidate parts, taking the last usage',async()=>{
  let url;const fetchImpl=async(requestUrl)=>{url=String(requestUrl);return sse(['data: {"candidates":[{"content":{"parts":[{"text":"{\\"answer\\":\\"Sv"}]}}],"usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":2}}\n\n','data: {"candidates":[{"content":{"parts":[{"text":"eiki\\"}"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":6}}\n\n']);};
  const deltas=[];const result=await generateTextStream({provider:'gemini',apiKey:'fixture',model:'gemini-3.8-flash',system:'s',prompt:'p',reasoningEffort:'none',fetchImpl,onDelta:text=>deltas.push(text)});
  assert.match(url,/:streamGenerateContent\?alt=sse$/);assert.deepEqual(deltas,['{"answer":"Sv','eiki"}']);assert.equal(result.text,'{"answer":"Sveiki"}');assert.deepEqual(result.usage,{input_tokens:8,output_tokens:6});
});
test('a non-stream JSON reply and an upstream error behave like generateText',async()=>{
  const deltas=[];const result=await generateTextStream({provider:'openai',apiKey:'fixture',model:'gpt-6-luna',prompt:'p',fetchImpl:async()=>Response.json({output_text:'plain'}),onDelta:text=>deltas.push(text)});
  assert.equal(result.text,'plain');assert.deepEqual(deltas,['plain'],'the whole text is delivered once as a single delta');
  await assert.rejects(generateTextStream({provider:'openai',apiKey:'fixture',model:'gpt-6.1-sol',prompt:'p',fetchImpl:async()=>Response.json({error:{message:'Unsupported value: none'}},{status:400}),onDelta(){}}),/OpenAI request failed \(400\)/);
});
