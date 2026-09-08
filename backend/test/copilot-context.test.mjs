import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCopilotWorkspaceContext} from '../src/copilot-context.js';

function row(sql,args=[]){return {sql,args};}
class Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.first(this.sql,this.args);}
  async all(){return {results:this.db.all(this.sql,this.args)};}
}
class FakeDB{
  constructor(){this.queries=[];}
  prepare(sql){this.queries.push(sql);return new Statement(this,sql);}
  first(sql,args){
    if(/customer_workspace_state/i.test(sql))return {workspace_id:args[0],schema_version:1,version:7,payload_json:JSON.stringify({
      main:{website:'https://safe.example',targetMarkets:['Latvia'],profile:{company:'Safe Industries',description:'Industrial systems'},market:{
        icps:[{id:'icp-1',name:'Manufacturers',criteria:'50-500 employees'}],
        signals:[{id:'s1',name:'Factory expansion',active:true,weight:85}],
        opportunities:[{name:'Opportunity '.repeat(200)}]
      }},
      discovery:{companies:Array.from({length:60},(_,i)=>({id:`d${i}`,company:`Discovery ${i}`,score:90-i,contacts:[{email:`person${i}@example.com`}]}))},
      outreach:{mode:'manual',drafts:Array.from({length:40},(_,i)=>({recipient:`private${i}@example.com`,body:'x'.repeat(1000)}))},
      delivery:{metrics:{sent:10,replies:3}}
    }),updated_at:'2026-09-08T10:00:00Z'};
    if(/COUNT\(\*\).*crm_companies/i.test(sql))return {total:12,active:8,customers:2};
    if(/gmail_connections/i.test(sql))return {provider:'gmail',status:'connected',connected_at:'2026-08-01T10:00:00Z',updated_at:'2026-09-01T10:00:00Z',encrypted_refresh_token:'REFRESH-SHOULD-NOT-LEAK'};
    if(/workspace_ai_integrations/i.test(sql))return {provider:'openai',active:1,verified_at:'2026-09-01T12:00:00Z',last_used_at:'2026-09-08T08:00:00Z',key_hint:'••••1234',encrypted_api_key:'AI-SHOULD-NOT-LEAK'};
    if(/workspace_service_integrations/i.test(sql))return {provider:'apollo',verified_at:'2026-09-02T12:00:00Z',last_used_at:'2026-09-07T08:00:00Z',key_hint:'••••9999',encrypted_api_key:'APOLLO-SHOULD-NOT-LEAK'};
    return null;
  }
  all(sql){
    if(/GROUP BY pipeline_stage/i.test(sql))return [{pipeline_stage:'Qualified',count:4},{pipeline_stage:'Contacted',count:3}];
    if(/FROM crm_companies/i.test(sql))return Array.from({length:40},(_,i)=>({id:`c${i}`,company_name:`Company ${i}`,website:`https://company${i}.example`,pipeline_stage:'Qualified',opportunity_score:90-i,updated_at:'2026-09-08T09:00:00Z'}));
    return [];
  }
}

test('context uses authoritative server workspace state and ignores injected client workspace payload',async()=>{
  const db=new FakeDB();const context=await buildCopilotWorkspaceContext({DB:db},{workspaceId:'w1',role:'owner',currentScreen:{step:4,label:'Market Strategy',workspace:{id:'evil'},profile:{company:'Injected Co'},api_key:'CLIENT-SECRET'}});
  assert.equal(context.workspace.id,'w1');
  assert.equal(context.company.website,'https://safe.example');
  assert.notEqual(context.profile.company,'Injected Co');
  assert.equal(context.screen.step,4);assert.equal(context.screen.label,'Market Strategy');
  assert.deepEqual(Object.keys(context).sort(),['company','crmSummary','discoverySummary','icps','integrationStatus','markets','outreachSummary','profile','readiness','research','screen','signals','workspace'].sort());
});

test('context summarizes CRM/discovery/outreach instead of dumping contact or message bodies',async()=>{
  const context=await buildCopilotWorkspaceContext({DB:new FakeDB()},{workspaceId:'w1',role:'owner',currentScreen:{step:5,label:'Discovery'}});
  assert.equal(context.crmSummary.total,12);
  assert.ok(Array.isArray(context.crmSummary.pipeline));
  assert.ok(context.crmSummary.topCompanies.length<=10);
  const serialized=JSON.stringify(context);
  assert.doesNotMatch(serialized,/person0@example\.com/);
  assert.doesNotMatch(serialized,/private0@example\.com/);
  assert.ok(context.discoverySummary.companyCount>=1);
});

test('integration context exposes safe provider state and timestamps without keys, hints or refresh tokens',async()=>{
  const context=await buildCopilotWorkspaceContext({DB:new FakeDB()},{workspaceId:'w1',role:'owner',currentScreen:{step:1,label:'Company & Market'}});
  const serialized=JSON.stringify(context.integrationStatus);
  for(const sentinel of ['REFRESH-SHOULD-NOT-LEAK','AI-SHOULD-NOT-LEAK','APOLLO-SHOULD-NOT-LEAK','••••1234','••••9999'])assert.equal(serialized.includes(sentinel),false,sentinel);
  assert.match(serialized,/openai/i);assert.match(serialized,/apollo/i);assert.match(serialized,/gmail/i);
});

test('context is bounded before model use by truncating large arrays and text',async()=>{
  const context=await buildCopilotWorkspaceContext({DB:new FakeDB()},{workspaceId:'w1',role:'owner',currentScreen:{step:4,label:'Market Strategy'}});
  assert.ok(context.signals.length<=20);
  assert.ok(context.icps.length<=10);
  assert.ok(context.research.items.length<=12);
  assert.ok(context.crmSummary.topCompanies.length<=10);
  assert.ok(JSON.stringify(context).length<70000);
});
