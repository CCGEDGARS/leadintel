import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const aiRoutePath=path.join(process.cwd(),'src','ai-routes.js');
const appSource=fs.readFileSync(path.join(process.cwd(),'src','app.js'),'utf8');
const source=fs.existsSync(aiRoutePath)?fs.readFileSync(aiRoutePath,'utf8'):'';

test('production entrypoint delegates dedicated AI routes before the existing SaaS router',()=>{
  assert.match(appSource,/import \{handleAiRoute\} from '\.\/ai-routes\.js'/);
  assert.match(appSource,/const ai=await handleAiRoute\(request,env,cors\);if\(ai\)return ai;[\s\S]*handleSaasRoute/);
});

test('AI router recognizes settings, generation and OpenAI web-search routes',()=>{
  assert.equal(fs.existsSync(aiRoutePath),true,'src/ai-routes.js must exist');
  for(const route of [
    '/api/integrations/ai/status',
    '/api/integrations/ai/provider',
    '/api/integrations/ai/activate',
    '/api/ai/generate',
    '/api/ai/web-search'
  ])assert.match(source,new RegExp(route.replaceAll('/','\\/')));
});

test('AI credential mutations are workspace-owner only while generation and web search permit operating roles',()=>{
  assert.match(source,/\/api\/integrations\/ai\/provider[\s\S]{0,1600}requireMember\(request,env,workspaceId,\['owner'\]\)/);
  assert.match(source,/\/api\/integrations\/ai\/activate[\s\S]{0,1200}requireMember\(request,env,workspaceId,\['owner'\]\)/);
  assert.match(source,/\/api\/ai\/generate[\s\S]{0,1200}requireMember\(request,env,workspaceId,\['owner','researcher','sales'\]\)/);
  assert.match(source,/\/api\/ai\/web-search[\s\S]{0,1400}requireMember\(request,env,workspaceId,\['owner','researcher','sales'\]\)/);
});

test('configured providers can verify and change models without resubmitting the stored API key',()=>{
  assert.match(source,/request\.method==='PATCH'/);
  assert.match(source,/SELECT encrypted_api_key,active FROM workspace_ai_integrations/);
  assert.match(source,/decryptSecret\(existing\.encrypted_api_key,key\)/);
  assert.match(source,/verifyProviderCredential\(\{provider,apiKey,model\}\)/);
  assert.match(source,/UPDATE workspace_ai_integrations SET model=\?,verified_at=CURRENT_TIMESTAMP/);
  assert.match(source,/ai\.provider_model_updated/);
  assert.doesNotMatch(source,/json\([^\n]*encrypted_api_key/);
});

test('OpenAI web search uses the stored workspace OpenAI integration even when another provider is active',()=>{
  assert.match(source,/import \{[^}]*searchWeb[^}]*\} from '\.\/ai-provider\.js'/);
  assert.match(source,/workspace_ai_integrations WHERE workspace_id=\? AND provider='openai' LIMIT 1/);
  assert.match(source,/decryptSecret\(integration\.encrypted_api_key,key\)/);
  assert.match(source,/searchWeb\(\{apiKey,model:integration\.model,query,maxResults/);
  assert.match(source,/OpenAI integration is required for web search/);
});

test('OpenAI web search bounds input, records usage and never returns stored key material',()=>{
  assert.match(source,/query\.length>4000/);
  assert.match(source,/Math\.max\(1,Math\.min\(8,/);
  assert.match(source,/last_used_at=CURRENT_TIMESTAMP/);
  assert.match(source,/ai\.web_search_completed/);
  assert.match(source,/result_count:result\.results\.length/);
  assert.doesNotMatch(source,/json\([^\n]*encrypted_api_key/);
});

test('AI routes use encrypted storage and unified provider adapter without returning stored key material',()=>{
  assert.match(source,/from '\.\/ai-provider\.js'/);
  assert.match(source,/importAesKey\(env\.OAUTH_TOKEN_ENCRYPTION_KEY\)/);
  assert.match(source,/encryptSecret\(apiKey,key\)/);
  assert.match(source,/decryptSecret\(integration\.encrypted_api_key,key\)/);
  assert.match(source,/key_hint/);
  assert.doesNotMatch(source,/json\([^\n]*encrypted_api_key/);
});
