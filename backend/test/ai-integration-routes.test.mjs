import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'src','saas-routes.js'),'utf8');

test('SaaS router recognizes AI settings and generation routes',()=>{
  for(const route of [
    '/api/integrations/ai/status',
    '/api/integrations/ai/provider',
    '/api/integrations/ai/activate',
    '/api/ai/generate'
  ])assert.match(source,new RegExp(route.replaceAll('/','\\/')));
  assert.match(source,/path\.startsWith\('\/api\/integrations\/ai\/'\)/);
  assert.match(source,/path==='\/api\/ai\/generate'/);
});

test('AI credential mutations are workspace-owner only while generation permits operating roles',()=>{
  assert.match(source,/\/api\/integrations\/ai\/provider[\s\S]{0,1200}requireMember\(request,env,workspaceId,\['owner'\]\)/);
  assert.match(source,/\/api\/integrations\/ai\/activate[\s\S]{0,1000}requireMember\(request,env,workspaceId,\['owner'\]\)/);
  assert.match(source,/\/api\/ai\/generate[\s\S]{0,1000}requireMember\(request,env,workspaceId,\['owner','researcher','sales'\]\)/);
});

test('AI routes use encrypted storage and unified provider adapter without returning stored key material',()=>{
  assert.match(source,/from '\.\/ai-provider\.js'/);
  assert.match(source,/importAesKey\(env\.OAUTH_TOKEN_ENCRYPTION_KEY\)/);
  assert.match(source,/encryptSecret\(apiKey,key\)/);
  assert.match(source,/decryptSecret\(integration\.encrypted_api_key,key\)/);
  assert.match(source,/key_hint/);
  assert.doesNotMatch(source,/json\([^\n]*encrypted_api_key/);
});
