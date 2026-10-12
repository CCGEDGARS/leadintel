import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyProviderCredential,generateText} from '../src/ai-provider.js';
import {creditFailure} from '../src/provider-credit-health.js';

const upstream=message=>async()=>Response.json({error:{type:'invalid_request_error',message}},{status:400});
test('Anthropic low balance is actionable billing evidence without leaking upstream details',async()=>{
 for(const call of [verifyProviderCredential,generateText])await assert.rejects(call({provider:'anthropic',apiKey:'sk-ant-private',prompt:'Hello',fetchImpl:upstream('Your credit balance is too low to access the Anthropic API. private@example.com sk-ant-private')}),error=>{
  assert.match(error.message,/credits_exhausted/);assert.match(error.message,/Billing & credits/);assert.equal(creditFailure(0,error.message),true);
  assert.doesNotMatch(error.message,/private@example.com|sk-ant-private/);assert.ok(error.message.length<=180);return true;
 });
});
test('Anthropic spending limit is billing evidence but unsupported model and request parameters are not',async()=>{
 for(const [message,code,billing] of [
  ['You have reached your monthly spend limit.','billing_hard_limit_reached',true],
  ['model: claude-secret-model does not exist','model_unavailable',false],
  ["thinking.type: 'disabled' is not supported on this model",'invalid_parameter',false]
 ])await assert.rejects(verifyProviderCredential({provider:'anthropic',apiKey:'sk-ant-private',fetchImpl:upstream(message)}),error=>{
  assert.match(error.message,new RegExp(code));assert.equal(creditFailure(0,error.message),billing);assert.doesNotMatch(error.message,/claude-secret-model/);return true;
 });
});
test('unknown Anthropic 400 retains a safe request diagnostic without assuming exhausted credits',async()=>{
 await assert.rejects(verifyProviderCredential({provider:'anthropic',apiKey:'sk-ant-private',fetchImpl:upstream('Private account owner sk-ant-private')}),error=>{
  assert.match(error.message,/invalid_request_error/);assert.match(error.message,/request settings/);assert.equal(creditFailure(0,error.message),false);assert.doesNotMatch(error.message,/Private account|sk-ant-private/);return true;
 });
});
