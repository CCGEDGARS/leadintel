import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const routes=fs.readFileSync(path.join(process.cwd(),'src','saas-routes.js'),'utf8');
const automationRoutes=fs.readFileSync(path.join(process.cwd(),'src','outreach-automation-routes.js'),'utf8');
const app=fs.readFileSync(path.join(process.cwd(),'src','app.js'),'utf8');

test('production entrypoint delegates new SaaS routes before core router',()=>{
  assert.match(app,/handleSaasRoute/);assert.match(app,/core\.fetch/);
});

test('production entrypoint delegates outreach automation before legacy SaaS router',()=>{
  assert.match(app,/import \{handleOutreachAutomationRoute\} from '\.\/outreach-automation-routes\.js'/);
  assert.match(app,/handleOutreachAutomationRoute\(request,runtimeEnv,cors\)[\s\S]*handleSaasRoute\(request,runtimeEnv,cors\)/);
  assert.match(automationRoutes,/\/api\/outreach-automation\/policy/);
  assert.match(automationRoutes,/\/api\/outreach-automation\/status/);
});

test('Google identity and workspace routes are present',()=>{
  for(const value of ['/api/auth/google/start','/api/auth/google/callback','/api/workspaces'])assert.match(routes,new RegExp(value.replaceAll('/','\\/')));
  assert.match(routes,/sessionCookie/);assert.match(routes,/ensureDefaultWorkspace/);
});

test('customer workspace state routes enforce membership roles and conflict response',()=>{
  assert.match(routes,/\/api\/customer\/state/);assert.match(routes,/\['owner','researcher','sales'\]/);assert.match(routes,/Customer state version conflict/);assert.match(routes,/409/);
});

test('Gmail routes expose status connect callback send sync disconnect',()=>{
  for(const suffix of ['status','start','callback','send','sync','disconnect'])assert.match(routes,new RegExp(`/api/integrations/gmail/${suffix}`.replaceAll('/','\\/')));
  assert.match(routes,/Idempotency-Key/);assert.match(routes,/encrypted_refresh_token/);assert.match(routes,/importAesKey/);assert.doesNotMatch(routes,/return json\([^\n]*refreshToken/);
});

test('Gmail connect and disconnect require owner while send requires owner or sales',()=>{
  assert.match(routes,/gmail\/start[\s\S]*requireMember\(request,env,workspaceId,\['owner'\]\)/);
  assert.match(routes,/gmail\/send[\s\S]*requireMember\(request,env,workspaceId,\['owner','sales'\]\)/);
  assert.match(routes,/gmail\/disconnect[\s\S]*requireMember\(request,env,workspaceId,\['owner'\]\)/);
});

test('Gmail send and reply sync integrate with durable CRM and suppression',()=>{
  assert.match(routes,/findCrmCompanyByDomain/);
  assert.match(routes,/CRM_COMPANY_SUPPRESSED/);
  assert.match(routes,/email\.sent/);
  assert.match(routes,/email\.reply_received/);
  assert.match(routes,/setCrmPipelineStage/);
  assert.match(routes,/gmail-send-\$\{key\}/,'CRM send activity must share the Gmail idempotency key with the browser confirmation path');
});
