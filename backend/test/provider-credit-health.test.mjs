import test from 'node:test';
import assert from 'node:assert/strict';
import {creditFailure,recordProviderCredit,providerCreditIssue} from '../src/provider-credit-health.js';

test('credit failures distinguish exhausted billing from a temporary 429',()=>{
  assert.equal(creditFailure(402,''),true);
  assert.equal(creditFailure(429,'code: insufficient_quota'),true);
  assert.equal(creditFailure(429,'code: credit_balance_exhausted'),true);
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
