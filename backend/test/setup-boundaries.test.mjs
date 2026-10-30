import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {sha256} from '../src/security.js';
import {handleSaasRoute} from '../src/saas-routes.js';
import {handleServiceIntegrationRoute} from '../src/service-integrations.js';
import {handleAdditionalContactRoute} from '../src/additional-contact-services.js';
import {handleAiRoute} from '../src/ai-routes.js';
import {createOAuthState} from '../src/oauth.js';

const request=(path,{token='setup-owner',method='GET',body,headers={}}={})=>new Request('https://api.example.test'+path,{method,headers:{Cookie:'leadintel_session='+token,...headers,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function fixture(){
 const DB=storageDb();
 DB.raw.exec("INSERT INTO users(id,email,display_name,role) VALUES('setup-viewer','viewer@example.test','Viewer','owner'); INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('storage-w1','setup-viewer','viewer');");
 for(const [token,user] of [['setup-owner','storage-owner'],['setup-viewer','setup-viewer']])DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").run(await sha256(token),user);
 return {DB,env:{DB}};
}

test('Setup state uses workspace membership roles and persists preferences with stale-write protection',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Setup preferences must not contact a provider');};
 try{
  const path='/api/customer/state?workspace_id=storage-w1';
  assert.equal((await handleSaasRoute(request(path,{token:''}),env,{})).status,401);
  assert.equal((await handleSaasRoute(request('/api/customer/state?workspace_id=missing'),env,{})).status,403);
  const payload={main:{profile:{companyName:'Independent Seller',targetMarkets:'Finland'}},meta:{setup:{language:'fi'}}};
  assert.equal((await handleSaasRoute(request(path,{token:'setup-viewer',method:'PUT',body:{version:0,payload}}),env,{})).status,403);
  const saved=await handleSaasRoute(request(path,{method:'PUT',body:{version:0,payload}}),env,{});assert.equal(saved.status,200);assert.equal((await saved.json()).version,1);
  const stale=await handleSaasRoute(request(path,{method:'PUT',body:{version:0,payload:{main:{profile:{companyName:'Stale Seller'}}}}}),env,{});assert.equal(stale.status,409);
  const reopened=await (await handleSaasRoute(request(path,{token:'setup-viewer'}),env,{})).json();assert.deepEqual(reopened.payload,payload);assert.equal(reopened.version,1);
  const foreign=await (await handleSaasRoute(request('/api/customer/state?workspace_id=storage-w2'),env,{})).json();assert.deepEqual(foreign.payload,{});
  const list=await (await handleSaasRoute(request('/api/workspaces',{token:'setup-viewer'}),env,{})).json();assert.deepEqual(list.workspaces.map(w=>[w.id,w.role]),[['storage-w1','viewer']]);
  assert.equal(DB.raw.prepare('SELECT count(*) n FROM gmail_messages').get().n,0);assert.equal(calls,0);
 }finally{globalThis.fetch=old;DB.raw.close();}
});

test('Setup connection and paid-contact settings remain owner-only and cannot execute research or sending',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Settings writes must not contact a provider');};
 DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES('storage-w1','apollo','encrypted-fixture','hint','{}'),('storage-w1','hunter','encrypted-fixture','hint','{}')").run();
 try{
  const apolloBody={discovery:true,email:true,phone:false,daily_limit:3,monthly_limit:30};
  for(const [path,body] of [['/api/integrations/services/apollo/settings',apolloBody],['/api/integrations/services/hunter/settings',{enabled:true}]]){
   assert.equal((await handleServiceIntegrationRoute(request(path+'?workspace_id=storage-w1',{token:'setup-viewer',method:'PUT',body}),env,{})).status,403);
   assert.equal((await handleServiceIntegrationRoute(request(path+'?workspace_id=storage-w1',{method:'PUT',body}),env,{})).status,200);
   assert.equal((await handleServiceIntegrationRoute(request(path+'?workspace_id=storage-w2',{method:'PUT',body}),env,{})).status,403);
  }
  const policyPath='/api/additional-contact-services/policy?workspace_id=storage-w1',body={enabled:true,phoneEnabled:false,provider:'apollo',dailyLimit:3,monthlyLimit:30,maxPerCompany:2};
  assert.equal((await handleAdditionalContactRoute(request(policyPath,{token:'setup-viewer',method:'PUT',body}),env,{})).status,403);
  assert.equal((await handleAdditionalContactRoute(request(policyPath,{method:'PUT',body}),env,{})).status,200);
  const policy=await (await handleAdditionalContactRoute(request(policyPath,{token:'setup-viewer'}),env,{})).json();assert.equal(policy.policy.enabled,true);assert.equal(policy.policy.provider,'apollo');
  assert.equal((await handleAdditionalContactRoute(request('/api/additional-contact-services/policy?workspace_id=storage-w2',{token:'setup-viewer'}),env,{})).status,403);
  const aiPath='/api/integrations/ai/research-settings?workspace_id=storage-w1',aiBody={primary:'anthropic',secondary:'gemini'};
  assert.equal((await handleAiRoute(request(aiPath,{token:'setup-viewer',method:'PUT',body:aiBody}),env,{})).status,403);
  assert.equal((await handleAiRoute(request(aiPath,{method:'PUT',body:aiBody}),env,{})).status,200);
  const aiSettings=await (await handleAiRoute(request(aiPath,{token:'setup-viewer'}),env,{})).json();assert.equal(aiSettings.primary_provider,'anthropic');assert.equal(aiSettings.secondary_provider,'gemini');
  assert.equal(DB.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,0);assert.equal(DB.raw.prepare('SELECT count(*) n FROM gmail_messages').get().n,0);assert.equal(calls,0);
 }finally{globalThis.fetch=old;DB.raw.close();}
});

test('first authenticated login creates an isolated default workspace and repeated login reuses it',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;
 DB.raw.prepare("INSERT INTO users(id,email,display_name,role) VALUES('fresh-owner','fresh@example.test','Fresh Seller','owner')").run();
 Object.assign(env,{GOOGLE_OAUTH_CLIENT_ID:'local-client',GOOGLE_OAUTH_CLIENT_SECRET:'local-secret',GOOGLE_OAUTH_REDIRECT_URI:'https://api.example.test/api/auth/google/callback',CUSTOMER_APP_URL:'https://app.example.test/'});
 const calls=[];globalThis.fetch=async url=>{calls.push(String(url));if(String(url).includes('oauth2.googleapis.com/token'))return new Response(JSON.stringify({access_token:'local-access',token_type:'Bearer'}));if(String(url).includes('openidconnect.googleapis.com'))return new Response(JSON.stringify({sub:'local-google-subject',email:'fresh@example.test',email_verified:true,name:'Fresh Seller'}));throw Error('Unexpected identity request');};
 try{
  const login=async()=>{const state=await createOAuthState(env,{purpose:'login',returnTo:env.CUSTOMER_APP_URL});return handleSaasRoute(request('/api/auth/google/callback?state='+state+'&code=local-code',{headers:{'x-leadintel-first-party':'1'}}),env,{});};
  const first=await login();assert.equal(first.status,302);const location=new URL(first.headers.get('Location'));assert.equal(location.searchParams.get('auth'),'success');const workspaceId=location.searchParams.get('workspace_id');assert.ok(workspaceId.startsWith('workspace-'));
  assert.deepEqual({...DB.raw.prepare('SELECT owner_user_id,market FROM workspaces WHERE id=?').get(workspaceId)},{owner_user_id:'fresh-owner',market:'Global'});
  assert.equal(DB.raw.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').get(workspaceId,'fresh-owner').role,'owner');
  assert.equal(new URL((await login()).headers.get('Location')).searchParams.get('workspace_id'),workspaceId);assert.equal(DB.raw.prepare("SELECT count(*) n FROM workspace_members WHERE user_id='fresh-owner'").get().n,1);
  assert.equal((await handleSaasRoute(request('/api/customer/state?workspace_id='+workspaceId),env,{})).status,403);assert.equal(calls.length,4);
 }finally{globalThis.fetch=old;DB.raw.close();}
});
