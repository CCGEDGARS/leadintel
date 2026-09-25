import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAiRoute} from '../src/ai-routes.js';
import {encryptSecret,importAesKey} from '../src/oauth.js';

const WORKSPACE='workspace-1';
const ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

class FakeD1{
  constructor(integrations){this.integrations=integrations;this.lastUsed=[];this.audits=[];}
  prepare(sql){
    const database=this;let values=[];
    return {
      bind(...args){values=args;return this;},
      async first(){
        if(sql.includes('JOIN users ON users.id=sessions.user_id'))return {id:'user-1',email:'owner@example.com',display_name:'Owner',role:'owner',expires_at:'2099-01-01T00:00:00Z'};
        if(sql.includes('SELECT role FROM workspace_members'))return {role:'owner'};
        if(sql.includes('active=1 LIMIT 1'))return database.integrations.openai;
        if(sql.includes("provider='gemini'"))return database.integrations.gemini||null;
        return null;
      },
      async all(){return {results:[]};},
      async run(){
        if(sql.includes('UPDATE workspace_ai_integrations SET last_used_at'))database.lastUsed.push(values[1]);
        if(sql.includes('INSERT INTO audit_events'))database.audits.push({provider:values[5],metadata:JSON.parse(values[6])});
        return {meta:{changes:1}};
      }
    };
  }
  async batch(){return {success:true};}
}

async function makeEnv(){
  const key=await importAesKey(ENCRYPTION_KEY);
  return {
    OAUTH_TOKEN_ENCRYPTION_KEY:ENCRYPTION_KEY,
    DB:new FakeD1({
      openai:{provider:'openai',encrypted_api_key:await encryptSecret('openai-test-key',key),model:'gpt-5.6',active:1},
      gemini:{provider:'gemini',encrypted_api_key:await encryptSecret('gemini-test-key',key),model:'gemini-3.7-flash',active:0}
    })
  };
}

function generationRequest(){
  return new Request(`https://leadintel-api.example/api/ai/generate?workspace_id=${WORKSPACE}`,{
    method:'POST',headers:{'Content-Type':'application/json','Cookie':'leadintel_session=test-session'},
    body:JSON.stringify({task:'company-extraction',fallback_provider:'gemini',system:'Extract named companies from supplied evidence.',prompt:'E1 https://evidence.example/northstar-expansion',max_output_tokens:1800})
  });
}

test('AI generation retries the same company evidence with configured Gemini after OpenAI quota failure',async()=>{
  const originalFetch=globalThis.fetch;const calls=[];
  const env=await makeEnv();
  globalThis.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url:String(url),options,body});
    if(String(url).includes('api.openai.com'))return new Response(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',code:'insufficient_quota'}}),{status:429,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"companies":[{"company":"Northstar AB","sourceUrl":"https://evidence.example/northstar-expansion"}]}'}]}}],usageMetadata:{promptTokenCount:90,candidatesTokenCount:22}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await handleAiRoute(generationRequest(),env,{});
    const payload=await response.json();
    assert.equal(response.status,200);
    assert.equal(payload.provider,'gemini');
    assert.equal(payload.fallback.used,true);
    assert.equal(payload.fallback.from,'openai');
    assert.deepEqual(calls.map(call=>call.url.includes('api.openai.com')?'openai':'gemini'),['openai','gemini']);
    assert.equal(calls[0].body.input,calls[1].body.contents[0].parts[0].text,'Gemini must receive the same evidence prompt');
    assert.equal(calls[0].body.instructions,calls[1].body.systemInstruction.parts[0].text,'Gemini must receive the same extraction rules');
    assert.deepEqual(env.DB.lastUsed,['gemini']);
    assert.equal(env.DB.audits[0].provider,'gemini');
    assert.equal(env.DB.audits[0].metadata.fallback_used,true);
    assert.doesNotMatch(JSON.stringify(payload),/openai-test-key|gemini-test-key/);
  }finally{globalThis.fetch=originalFetch;}
});

test('AI generation does not spend on Gemini when OpenAI returns a valid empty company list',async()=>{
  const originalFetch=globalThis.fetch;const calls=[];
  const env=await makeEnv();
  globalThis.fetch=async(url,options)=>{
    calls.push(String(url));
    return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'{"companies":[]}'}]}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await handleAiRoute(generationRequest(),env,{});
    const payload=await response.json();
    assert.equal(response.status,200);
    assert.equal(payload.provider,'openai');
    assert.equal(payload.fallback.used,false);
    assert.equal(calls.length,1);
    assert.match(calls[0],/api\.openai\.com/);
    assert.deepEqual(env.DB.lastUsed,['openai']);
  }finally{globalThis.fetch=originalFetch;}
});
