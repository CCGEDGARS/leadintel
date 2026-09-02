import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migrationPath=path.join(root,'migrations','0013_workspace_service_integrations.sql');
const routePath=path.join(root,'src','service-integrations.js');
const appSource=fs.readFileSync(path.join(root,'src','app.js'),'utf8');
const coreSource=fs.readFileSync(path.join(root,'src','index.js'),'utf8');
const crmSource=fs.readFileSync(path.join(root,'src','crm-routes.js'),'utf8');
const migration=fs.existsSync(migrationPath)?fs.readFileSync(migrationPath,'utf8'):'';
const source=fs.existsSync(routePath)?fs.readFileSync(routePath,'utf8'):'';

test('workspace service integration migration stores only encrypted Apollo and Firecrawl credentials',()=>{
  assert.equal(fs.existsSync(migrationPath),true,'0013 workspace service integration migration must exist');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS workspace_service_integrations/);
  assert.match(migration,/provider TEXT NOT NULL CHECK \(provider IN \('apollo','firecrawl'\)\)/);
  assert.match(migration,/encrypted_api_key TEXT NOT NULL/);
  assert.match(migration,/key_hint TEXT NOT NULL/);
  assert.match(migration,/verified_at/);
  assert.match(migration,/last_used_at/);
  assert.match(migration,/PRIMARY KEY \(workspace_id, provider\)/);
  assert.doesNotMatch(migration,/plain_api_key|raw_api_key/i);
});

test('production entrypoint delegates service routes then injects workspace credentials before CRM and core routers',()=>{
  assert.match(appSource,/import \{handleServiceIntegrationRoute,withWorkspaceServiceCredentials\} from '\.\/service-integrations\.js'/);
  assert.match(appSource,/handleServiceIntegrationRoute\(request,env,cors\)[\s\S]*withWorkspaceServiceCredentials\(request,env\)[\s\S]*handleCrmRoute\(request,runtimeEnv,cors\)[\s\S]*core\.fetch\(request,runtimeEnv\)/);
});

test('service integration router exposes owner-only status save delete and Firecrawl research proxy routes',()=>{
  assert.equal(fs.existsSync(routePath),true,'src/service-integrations.js must exist');
  for(const route of [
    '/api/integrations/services/status',
    '/api/integrations/services/provider',
    '/api/integrations/services/firecrawl/scrape',
    '/api/integrations/services/firecrawl/search'
  ])assert.match(source,new RegExp(route.replaceAll('/','\\/')));
  assert.match(source,/\/api\/integrations\/services\/provider[\s\S]{0,2600}requireMember\(request,env,workspaceId,\['owner'\]\)/);
  assert.match(source,/encryptSecret\(apiKey,key\)/);
  assert.match(source,/decryptSecret\(row\.encrypted_api_key,key\)/);
  assert.match(source,/key_hint/);
  assert.doesNotMatch(source,/json\([^\n]*encrypted_api_key/);
});

test('Apollo and Firecrawl credentials are verified with no-credit account endpoints',()=>{
  assert.match(source,/https:\/\/api\.apollo\.io\/api\/v1\/auth\/health/);
  assert.match(source,/['"]x-api-key['"]/i);
  assert.match(source,/https:\/\/api\.firecrawl\.dev\/v2\/team\/credit-usage/);
  assert.match(source,/Authorization/);
  assert.match(source,/Bearer/);
});

test('service status distinguishes customer-owned credentials from LeadIntel managed fallback without returning secrets',()=>{
  assert.match(source,/source:\s*['"]customer['"]/);
  assert.match(source,/source:\s*['"]managed['"]/);
  assert.match(source,/key_hint/);
  assert.match(source,/verified_at/);
  assert.match(source,/last_used_at/);
  assert.doesNotMatch(source,/api_key\s*:/i);
});

test('request-scoped Apollo override makes both CRM and legacy enrichment customer-owned without rewriting either engine',()=>{
  assert.match(source,/withWorkspaceServiceCredentials/);
  assert.match(source,/resolveWorkspaceServiceCredential\(env,workspaceId,'apollo'\)/);
  assert.match(source,/runtime\.APOLLO_API_KEY=apolloCredential\.apiKey/);
  assert.match(source,/runtime\.APOLLO_WEBHOOK_SECRET=env\.APOLLO_WEBHOOK_SECRET\|\|env\.APOLLO_API_KEY/);
  assert.match(crmSource,/env\.APOLLO_API_KEY/,'Master CRM must continue reading the request-scoped Apollo credential');
  assert.match(coreSource,/env\.APOLLO_API_KEY/,'legacy opportunity enrichment must continue reading the request-scoped Apollo credential');
});

test('Firecrawl workspace proxy bounds customer requests and supports managed fallback',()=>{
  assert.match(source,/api\.firecrawl\.dev\/v2\/scrape/);
  assert.match(source,/api\.firecrawl\.dev\/v2\/search/);
  assert.match(source,/FIRECRAWL_PROXY_URL/);
  assert.match(source,/Math\.min\(10/);
  assert.match(source,/query\.length/);
  assert.match(source,/last_used_at=CURRENT_TIMESTAMP/);
});
