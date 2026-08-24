export const AI_PROVIDERS=Object.freeze(['openai','anthropic','gemini']);

const DEFAULT_MODELS=Object.freeze({
  openai:'gpt-5.6',
  anthropic:'claude-sonnet-4-6',
  gemini:'gemini-3.7-flash'
});
const PROVIDER_LABELS=Object.freeze({openai:'OpenAI',anthropic:'Anthropic',gemini:'Gemini'});

function clean(value){return String(value??'').trim();}
function clampTokens(value){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(8192,Math.floor(n))):1200;}
function usage(input=0,output=0){return {input_tokens:Math.max(0,Number(input)||0),output_tokens:Math.max(0,Number(output)||0)};}

export function normalizeAiProvider(value){
  const provider=clean(value).toLowerCase();
  if(provider==='google'||provider==='google-gemini')return 'gemini';
  return AI_PROVIDERS.includes(provider)?provider:'';
}

export function defaultAiModel(provider){return DEFAULT_MODELS[normalizeAiProvider(provider)]||'';}

function validatedOptions({provider,apiKey,model,system='',prompt,maxOutputTokens}){
  const normalized=normalizeAiProvider(provider);if(!normalized)throw new Error('Unsupported AI provider');
  const key=clean(apiKey);if(!key)throw new Error('AI provider API key is required');
  const selectedModel=clean(model)||defaultAiModel(normalized);if(!selectedModel||selectedModel.length>160)throw new Error('AI provider model is invalid');
  const userPrompt=clean(prompt);if(!userPrompt)throw new Error('AI prompt is required');
  const systemPrompt=clean(system);
  return {provider:normalized,apiKey:key,model:selectedModel,system:systemPrompt,prompt:userPrompt,maxOutputTokens:clampTokens(maxOutputTokens)};
}

function textFromOpenAi(payload){
  if(clean(payload?.output_text))return clean(payload.output_text);
  const parts=[];
  for(const item of Array.isArray(payload?.output)?payload.output:[]){
    for(const content of Array.isArray(item?.content)?item.content:[])if(content?.type==='output_text'&&clean(content.text))parts.push(clean(content.text));
  }
  return parts.join('\n').trim();
}
function textFromAnthropic(payload){return (Array.isArray(payload?.content)?payload.content:[]).filter(item=>item?.type==='text').map(item=>clean(item.text)).filter(Boolean).join('\n').trim();}
function textFromGemini(payload){
  const candidate=Array.isArray(payload?.candidates)?payload.candidates[0]:null;
  return (Array.isArray(candidate?.content?.parts)?candidate.content.parts:[]).map(part=>clean(part?.text)).filter(Boolean).join('\n').trim();
}
function safeDiagnosticToken(value){
  const token=clean(value);if(!token||token.length>80||!/^[A-Za-z0-9_.:/-]+$/.test(token))return '';return token;
}
function sanitizedUpstreamError(provider,status,payload={}){
  const detail=payload?.error&&typeof payload.error==='object'?payload.error:{};
  const code=safeDiagnosticToken(detail.code||detail.type),param=safeDiagnosticToken(detail.param);
  const suffix=[code?`code: ${code}`:'',param?`param: ${param}`:''].filter(Boolean).join(' · ');
  return new Error(`${PROVIDER_LABELS[provider]||'AI provider'} request failed (${Number(status)||502})${suffix?` · ${suffix}`:''}`);
}

async function parseJson(response){try{return await response.json();}catch{return {};}}

async function openAiRequest(options,fetchImpl){
  const response=await fetchImpl('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json',Authorization:`Bearer ${options.apiKey}`},
    body:JSON.stringify({model:options.model,instructions:options.system||undefined,input:options.prompt,max_output_tokens:options.maxOutputTokens,store:false})
  });
  const payload=await parseJson(response);if(!response.ok)throw sanitizedUpstreamError('openai',response.status,payload);
  const text=textFromOpenAi(payload);if(!text)throw new Error('OpenAI returned no text');
  return {provider:'openai',model:options.model,text,usage:usage(payload?.usage?.input_tokens,payload?.usage?.output_tokens)};
}

async function verifyOpenAiCredential(options,fetchImpl){
  const response=await fetchImpl('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json',Authorization:`Bearer ${options.apiKey}`},
    body:JSON.stringify({model:options.model,input:'Reply with exactly OK.'})
  });
  const payload=await parseJson(response);if(!response.ok)throw sanitizedUpstreamError('openai',response.status,payload);
  const text=textFromOpenAi(payload);if(!text)throw new Error('OpenAI returned no text');
  return {provider:'openai',model:options.model,text};
}

async function anthropicRequest(options,fetchImpl){
  const body={model:options.model,max_tokens:options.maxOutputTokens,messages:[{role:'user',content:options.prompt}]};if(options.system)body.system=options.system;
  const response=await fetchImpl('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json','x-api-key':options.apiKey,'anthropic-version':'2023-06-01'},
    body:JSON.stringify(body)
  });
  const payload=await parseJson(response);if(!response.ok)throw sanitizedUpstreamError('anthropic',response.status,payload);
  const text=textFromAnthropic(payload);if(!text)throw new Error('Anthropic returned no text');
  return {provider:'anthropic',model:options.model,text,usage:usage(payload?.usage?.input_tokens,payload?.usage?.output_tokens)};
}

async function geminiRequest(options,fetchImpl){
  const body={contents:[{role:'user',parts:[{text:options.prompt}]}],generationConfig:{maxOutputTokens:options.maxOutputTokens}};
  if(options.system)body.system_instruction={parts:[{text:options.system}]};
  const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json','x-goog-api-key':options.apiKey},
    body:JSON.stringify(body)
  });
  const payload=await parseJson(response);if(!response.ok)throw sanitizedUpstreamError('gemini',response.status,payload);
  const text=textFromGemini(payload);if(!text)throw new Error('Gemini returned no text');
  return {provider:'gemini',model:options.model,text,usage:usage(payload?.usageMetadata?.promptTokenCount,payload?.usageMetadata?.candidatesTokenCount)};
}

export async function generateText({provider,apiKey,model,system='',prompt,maxOutputTokens=1200,fetchImpl=fetch}){
  const options=validatedOptions({provider,apiKey,model,system,prompt,maxOutputTokens});
  try{
    if(options.provider==='openai')return await openAiRequest(options,fetchImpl);
    if(options.provider==='anthropic')return await anthropicRequest(options,fetchImpl);
    return await geminiRequest(options,fetchImpl);
  }catch(error){
    if(/request failed \(\d+\)/.test(String(error?.message||''))||/returned no text$/.test(String(error?.message||''))||/^(Unsupported AI provider|AI provider API key is required|AI provider model is invalid|AI prompt is required)$/.test(String(error?.message||'')))throw error;
    throw new Error(`${PROVIDER_LABELS[options.provider]} request failed (502)`);
  }
}

export async function verifyProviderCredential({provider,apiKey,model,fetchImpl=fetch}){
  const options=validatedOptions({provider,apiKey,model,prompt:'Reply with exactly OK.',maxOutputTokens:64});
  if(options.provider==='openai'){
    const result=await verifyOpenAiCredential(options,fetchImpl);
    return {ok:Boolean(result.text),provider:result.provider,model:result.model};
  }
  const result=await generateText({provider:options.provider,apiKey:options.apiKey,model:options.model,prompt:'Reply with exactly OK.',maxOutputTokens:64,fetchImpl});
  return {ok:Boolean(result.text),provider:result.provider,model:result.model};
}
