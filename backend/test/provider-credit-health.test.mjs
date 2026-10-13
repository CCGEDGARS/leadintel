import test from 'node:test';
import assert from 'node:assert/strict';
import {creditFailure,recordProviderCredit,providerCreditIssue,verifiedCreditBalance} from '../src/provider-credit-health.js';

test('credit failures distinguish exhausted billing from a temporary 429',()=>{
  assert.equal(creditFailure(402,''),true);
  assert.equal(creditFailure(429,'code: insufficient_quota'),true);
  assert.equal(creditFailure(429,'code: credit_balance_exhausted'),true);
  assert.equal(creditFailure(403,'code: not_enough_credits'),true);
  assert.equal(creditFailure(429,'rate_limit_exceeded'),false);
  assert.equal(creditFailure(503,'overloaded'),false);
});

test('a provider credit alert persists per workspace and clears after its own successful request',async()=>{
  const events=[];
  const env={DB:{prepare(sql){let args=[];return {bind(...values){args=values;return this;},async run(){events.push({workspace:args[1],type:args[3],provider:args[5],metadata:args[6]});},async first(){const last=events.findLast(row=>row.workspace===args[0]&&row.provider===args[1]);return last?{event_type:last.type,metadata_json:last.metadata}:null;}};}}};
  const record=(workspaceId,provider,kind,source='customer')=>recordProviderCredit(env,{workspaceId,userId:'u1',provider,kind,source});
  await record('w1','openai','failed');
  await record('w1','gemini','failed');
  await record('w2','openai','failed');
  assert.deepEqual(await providerCreditIssue(env,'w1','openai'),{code:'credits_exhausted',source:'customer'});
  await record('w1','openai','recovered');
  assert.equal(await providerCreditIssue(env,'w1','openai'),null);
  assert.deepEqual(await providerCreditIssue(env,'w1','gemini'),{code:'credits_exhausted',source:'customer'});
  assert.deepEqual(await providerCreditIssue(env,'w2','openai'),{code:'credits_exhausted',source:'customer'});
});

test('only a verified Firecrawl balance can clear its billing alert; missing balance is unknown',()=>{assert.equal(verifiedCreditBalance('firecrawl',{remaining_credits:100}),'recovered');assert.equal(verifiedCreditBalance('firecrawl',{remaining_credits:0}),'failed');assert.equal(verifiedCreditBalance('firecrawl',{}),null);assert.equal(verifiedCreditBalance('firecrawl',{remaining_credits:null}),null);assert.equal(verifiedCreditBalance('apollo',{healthy:true}),null);});

test('Hunter verified balance differentiates exhausted credits from unknown balance',()=>{
 assert.equal(verifiedCreditBalance('hunter',{remaining_verifications:0}),'failed');
 assert.equal(verifiedCreditBalance('hunter',{remaining_verifications:20}),'recovered');
 for(const value of [null,undefined,'',NaN])assert.equal(verifiedCreditBalance('hunter',{remaining_verifications:value}),null);
});

test('explicit payment failures are red evidence while expired credentials and rate limits are not',()=>{
 for(const detail of ['payment failed','subscription expired','billing limit reached'])assert.equal(creditFailure(403,detail),true,detail);
 for(const detail of ['API token expired','invalid API key','rate_limit_exceeded','connection timeout'])assert.equal(creditFailure(429,detail),false,detail);
});

test('provider status uses its scoped index without sorting the workspace audit history',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const {readFileSync}=await import('node:fs');
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT,created_at TEXT);CREATE INDEX audit_workspace_created_idx ON audit_events(workspace_id,created_at DESC);');
  const query="SELECT event_type,metadata_json FROM audit_events WHERE workspace_id=? AND entity_type='provider_credit' AND entity_id=? ORDER BY rowid DESC LIMIT 1";
  const plan=()=>db.prepare('EXPLAIN QUERY PLAN '+query).all('w1','apollo').map(row=>row.detail).join('\n');
  assert.match(plan(),/TEMP B-TREE/,'the regression fixture must reproduce the previous workspace-wide ordering');
  db.exec(readFileSync(new URL('../migrations/0033_provider_credit_lookup_index.sql',import.meta.url),'utf8'));
  assert.match(plan(),/audit_provider_health_idx.*workspace_id=.*entity_type=.*entity_id=/);assert.doesNotMatch(plan(),/TEMP B-TREE|SCAN audit_events/);
  const insert=db.prepare('INSERT INTO audit_events(id,workspace_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?)');
  insert.run('old','w1','provider.credit_exhausted','provider_credit','apollo','{"source":"customer"}');
  insert.run('other','w2','provider.credit_exhausted','provider_credit','apollo','{"source":"customer"}');
  insert.run('new','w1','provider.credit_recovered','provider_credit','apollo','{"source":"customer"}');
  assert.equal(db.prepare(query).get('w1','apollo').event_type,'provider.credit_recovered');
  assert.equal(db.prepare(query).get('w2','apollo').event_type,'provider.credit_exhausted');
 }finally{db.close();}
});
