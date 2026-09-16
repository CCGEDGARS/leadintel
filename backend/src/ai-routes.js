import {sha256,cookieValue} from './security.js';
import {importAesKey,encryptSecret,decryptSecret} from './oauth.js';
import {AI_PROVIDERS,normalizeAiProvider,defaultAiModel,generateText,verifyProviderCredential,searchWeb} from './ai-provider.js';
import {verifyMarketResearch} from './market-research-verifier.js';

const uuid=()=>crypto.randomUUID();
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,extra={})=>json({error:message,...extra},status,headers);
const PROVIDER_NAMES=Object.freeze({openai:'OpenAI',anthropic:'Anthropic',gemini:'Google Gemini'});

async function sessionUser(request,env){
  const token=cookieValue(request,'leadintel_session');if(!token)return null;const tokenHash=await sha256(token);
  return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();
}
async function membership(env,workspaceId,userId){return env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();}
async function requireMember(request,env,workspaceId,roles=[]){
  const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};
  const member=await membership(env,workspaceId,user.id);if(!member)return {error:'Workspace access denied',status:403};
  if(roles.length&&!roles.includes(member.role))return {error:'Workspace role is not permitted',status:403};
  return {user,member};
}
async function audit(env,{workspaceId,userId,type,provider,metadata={}}){
  await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).bind(uuid(),workspaceId,userId,type,'workspace_ai_integration',provider,JSON.stringify(metadata)).run();
}
function encryptionConfigured(env){return Boolean(String(env.OAUTH_TOKEN_ENCRYPTION_KEY||'').trim());}
function validateModel(provider,value){
  const model=String(value||defaultAiModel(provider)).trim();
  if(!model||model.length>160||/[\r\n]/.test(model))throw new Error('AI provider model is invalid');return model;
}
function validateApiKey(value){
  const apiKey=String(value||'').trim();if(apiKey.length<8||apiKey.length>8192||/[\r\n]/.test(apiKey))throw new Error('A valid AI provider API key is required');return apiKey;
}
function keyHint(apiKey){return `••••${String(apiKey).slice(-4)}`;}
function providerStatus(rows,role){
  const byProvider=new Map((rows||[]).map(row=>[row.provider,row]));
  return {role,providers:AI_PROVIDERS.map(provider=>{
    const row=byProvider.get(provider);
    return {provider,name:PROVIDER_NAMES[provider],configured:Boolean(row),active:Boolean(row?.active),model:row?.model||defaultAiModel(provider),key_hint:row?.key_hint||'',verified_at:row?.verified_at||null,last_used_at:row?.last_used_at||null};
  })};
}
async function integrationRows(env,workspaceId){const {results=[]}=await env.DB.prepare(`SELECT provider,key_hint,model,active,verified_at,last_used_at FROM workspace_ai_integrations WHERE workspace_id=? ORDER BY provider`).bind(workspaceId).all();return results;}
async function activeIntegration(env,workspaceId){return env.DB.prepare(`SELECT provider,encrypted_api_key,model,active,verified_at,last_used_at FROM workspace_ai_integrations WHERE workspace_id=? AND active=1 LIMIT 1`).bind(workspaceId).first();}
async function openAiIntegration(env,workspaceId){return env.DB.prepare(`SELECT provider,encrypted_api_key,model,active,verified_at,last_used_at FROM workspace_ai_integrations WHERE workspace_id=? AND provider='openai' LIMIT 1`).bind(workspaceId).first();}
async function geminiIntegration(env,workspaceId){return env.DB.prepare(`SELECT provider,encrypted_api_key,model,active,verified_at,last_used_at FROM workspace_ai_integrations WHERE workspace_id=? AND provider='gemini' LIMIT 1`).bind(workspaceId).first();}

export async function handleAiRoute(request,env,cors={}){
  const url=new URL(request.url);const path=url.pathname;
  const known=path.startsWith('/api/integrations/ai/')||path==='/api/ai/generate'||path==='/api/ai/web-search'||path==='/api/ai/research-verification';if(!known)return null;
  const workspaceId=String(url.searchParams.get('workspace_id')||'').trim();if(!workspaceId)return error('workspace_id is required',400,cors);

  if(path==='/api/integrations/ai/status'&&request.method==='GET'){
    const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
    try{return json(providerStatus(await integrationRows(env,workspaceId),access.member.role),200,cors);}catch{return error('AI integration storage is not ready',503,cors);}
  }

  if(path==='/api/integrations/ai/provider'&&request.method==='PUT'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    if(!encryptionConfigured(env))return error('AI credential encryption is not configured',503,cors);
    const body=await request.json().catch(()=>null);if(!body)return error('AI provider payload is required',400,cors);
    const provider=normalizeAiProvider(body.provider);if(!provider)return error('Unsupported AI provider',400,cors);
    let apiKey,model;try{apiKey=validateApiKey(body.api_key);model=validateModel(provider,body.model);}catch(cause){return error(cause.message,400,cors);}
    try{await verifyProviderCredential({provider,apiKey,model});}catch(cause){return error(String(cause?.message||'AI provider verification failed').slice(0,180),422,cors);}
    try{
      const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const encrypted=await encryptSecret(apiKey,key);const makeActive=body.make_active!==false;
      const statements=[];if(makeActive)statements.push(env.DB.prepare(`UPDATE workspace_ai_integrations SET active=0,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=?`).bind(workspaceId));
      statements.push(env.DB.prepare(`INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(workspace_id,provider) DO UPDATE SET encrypted_api_key=excluded.encrypted_api_key,key_hint=excluded.key_hint,model=excluded.model,active=excluded.active,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(workspaceId,provider,encrypted,keyHint(apiKey),model,makeActive?1:0));
      await env.DB.batch(statements);await audit(env,{workspaceId,userId:access.user.id,type:'ai.provider_saved',provider,metadata:{model,active:makeActive}});
      return json({saved:true,provider,model,active:makeActive,key_hint:keyHint(apiKey),verified_at:new Date().toISOString()},200,cors);
    }catch{return error('Unable to save AI provider configuration',500,cors);}
  }

  if(path==='/api/integrations/ai/provider'&&request.method==='PATCH'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    if(!encryptionConfigured(env))return error('AI credential encryption is not configured',503,cors);
    const body=await request.json().catch(()=>null);if(!body)return error('AI provider payload is required',400,cors);
    const provider=normalizeAiProvider(body.provider);if(!provider)return error('Unsupported AI provider',400,cors);
    let model;try{model=validateModel(provider,body.model);}catch(cause){return error(cause.message,400,cors);}
    const existing=await env.DB.prepare(`SELECT encrypted_api_key,active FROM workspace_ai_integrations WHERE workspace_id=? AND provider=?`).bind(workspaceId,provider).first();
    if(!existing)return error('Configure this AI provider before changing its model',409,cors);
    try{
      const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const apiKey=await decryptSecret(existing.encrypted_api_key,key);
      await verifyProviderCredential({provider,apiKey,model});
      await env.DB.prepare(`UPDATE workspace_ai_integrations SET model=?,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider=?`).bind(model,workspaceId,provider).run();
      await audit(env,{workspaceId,userId:access.user.id,type:'ai.provider_model_updated',provider,metadata:{model,active:Boolean(existing.active)}});
      return json({saved:true,provider,model,active:Boolean(existing.active),verified_at:new Date().toISOString()},200,cors);
    }catch(cause){
      if(/request failed|returned no text|model is invalid/i.test(String(cause?.message||'')))return error(String(cause.message).slice(0,180),422,cors);
      return error('Unable to update AI provider model',500,cors);
    }
  }

  if(path==='/api/integrations/ai/activate'&&request.method==='POST'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null);const provider=normalizeAiProvider(body?.provider);if(!provider)return error('Unsupported AI provider',400,cors);
    const existing=await env.DB.prepare(`SELECT model FROM workspace_ai_integrations WHERE workspace_id=? AND provider=?`).bind(workspaceId,provider).first();if(!existing)return error('Configure this AI provider before activating it',409,cors);
    await env.DB.batch([env.DB.prepare(`UPDATE workspace_ai_integrations SET active=0,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=?`).bind(workspaceId),env.DB.prepare(`UPDATE workspace_ai_integrations SET active=1,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider=?`).bind(workspaceId,provider)]);
    await audit(env,{workspaceId,userId:access.user.id,type:'ai.provider_activated',provider,metadata:{model:existing.model}});return json({active:true,provider,model:existing.model},200,cors);
  }

  if(path==='/api/integrations/ai/provider'&&request.method==='DELETE'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null);const provider=normalizeAiProvider(body?.provider);if(!provider)return error('Unsupported AI provider',400,cors);
    const result=await env.DB.prepare(`DELETE FROM workspace_ai_integrations WHERE workspace_id=? AND provider=?`).bind(workspaceId,provider).run();
    await audit(env,{workspaceId,userId:access.user.id,type:'ai.provider_disconnected',provider});return json({disconnected:Number(result?.meta?.changes||0)>0,provider},200,cors);
  }

  if(path==='/api/ai/web-search'&&request.method==='POST'){
    const access=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(access.error)return error(access.error,access.status,cors);
    if(!encryptionConfigured(env))return error('AI credential encryption is not configured',503,cors);
    const body=await request.json().catch(()=>null);if(!body)return error('Web search payload is required',400,cors);
    const query=String(body.query||'').trim();if(!query||query.length>4000)return error('Web search query is invalid or too large',400,cors);
    const maxResults=Math.max(1,Math.min(8,Math.floor(Number(body.max_results)||5)));
    const integration=await openAiIntegration(env,workspaceId);if(!integration)return error('OpenAI integration is required for web search',409,cors);
    try{
      const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const apiKey=await decryptSecret(integration.encrypted_api_key,key);
      const result=await searchWeb({apiKey,model:integration.model,query,maxResults,signal:request.signal});
      await env.DB.prepare(`UPDATE workspace_ai_integrations SET last_used_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider=?`).bind(workspaceId,'openai').run();
      await audit(env,{workspaceId,userId:access.user.id,type:'ai.web_search_completed',provider:'openai',metadata:{model:integration.model,input_tokens:result.usage.input_tokens,output_tokens:result.usage.output_tokens,result_count:result.results.length}});
      return json(result,200,cors);
    }catch(cause){return error(String(cause?.message||'OpenAI web search failed').slice(0,180),502,cors);}
  }

  if(path==='/api/ai/research-verification'&&request.method==='POST'){
    const access=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(access.error)return error(access.error,access.status,cors);
    const unavailable=reason=>json({status:'unavailable',provider:'gemini',role:'verification',web_search:false,reason},200,cors);
    if(!encryptionConfigured(env))return unavailable('AI credential encryption is not configured');
    const body=await request.json().catch(()=>null);if(!body)return error('Research verification payload is required',400,cors);
    if(!['deep','intelligence'].includes(body.mode))return error('Gemini verification is available for Market Research and Market Intelligence',400,cors);
    const evidence=Array.isArray(body.evidence)?body.evidence.slice(0,200):[];
    if(!evidence.length)return error('At least one evidence source is required for verification',400,cors);
    const integration=await geminiIntegration(env,workspaceId);if(!integration)return unavailable('Gemini is not configured');
    try{
      const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const apiKey=await decryptSecret(integration.encrypted_api_key,key);
      const result=await verifyMarketResearch({apiKey,model:integration.model,mode:body.mode,profile:body.profile,signals:body.signals,evidence,signal:request.signal});
      await env.DB.prepare(`UPDATE workspace_ai_integrations SET last_used_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider=?`).bind(workspaceId,'gemini').run();
      await audit(env,{workspaceId,userId:access.user.id,type:'ai.research_verification_completed',provider:'gemini',metadata:{model:integration.model,input_tokens:result.usage.input_tokens,output_tokens:result.usage.output_tokens,evidence_count:evidence.length,disagreement_count:result.disagreements.length}});
      return json(result,200,cors);
    }catch(cause){
      console.error('Gemini research verification unavailable',String(cause?.message||cause).slice(0,180));
      return unavailable('Gemini verification is temporarily unavailable');
    }
  }

  if(path==='/api/ai/generate'&&request.method==='POST'){
    const access=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(access.error)return error(access.error,access.status,cors);
    if(!encryptionConfigured(env))return error('AI credential encryption is not configured',503,cors);
    const body=await request.json().catch(()=>null);if(!body)return error('AI generation payload is required',400,cors);
    const prompt=String(body.prompt||'').trim(),system=String(body.system||'').trim();
    if(!prompt||prompt.length>80000||system.length>20000)return error('AI generation prompt is invalid or too large',400,cors);
    const integration=await activeIntegration(env,workspaceId);if(!integration)return error('No active AI provider is configured for this workspace',409,cors);
    try{
      const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const apiKey=await decryptSecret(integration.encrypted_api_key,key);
      const result=await generateText({provider:integration.provider,apiKey,model:integration.model,system,prompt,maxOutputTokens:body.max_output_tokens});
      await env.DB.prepare(`UPDATE workspace_ai_integrations SET last_used_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider=?`).bind(workspaceId,integration.provider).run();
      await audit(env,{workspaceId,userId:access.user.id,type:'ai.generation_completed',provider:integration.provider,metadata:{model:integration.model,input_tokens:result.usage.input_tokens,output_tokens:result.usage.output_tokens}});
      return json(result,200,cors);
    }catch(cause){return error(String(cause?.message||'AI provider request failed').slice(0,180),502,cors);}
  }

  return error('Method not allowed',405,cors);
}
