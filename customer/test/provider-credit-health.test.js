const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','ai-settings.js'),'utf8');
const apolloFunction=source.slice(source.indexOf('async function checkApolloStatus(){'),source.indexOf('async function checkFirecrawlStatus(){'));
const cardFunction=source.slice(source.indexOf('function providerCard(config,current){'),source.indexOf('function formatDate(value){'));

async function apollo({usage={daily:0,monthly:0},policy={daily_credit_limit:10,monthly_credit_limit:100},provider={provider:'apollo',source:'managed',state:'good'}}={}){
  const context={api:async route=>route==='/api/enrichment-policy'?{response:{ok:true},payload:{configured:true,usage,policy}}:{response:{ok:true},payload:{providers:[provider]}}};
  vm.runInNewContext(`${apolloFunction}\nglobalThis.run=checkApolloStatus`,context);
  return context.run();
}

test('Apollo workspace daily or monthly credit limits turn its card red',async()=>{
  const daily=await apollo({usage:{daily:10,monthly:25}});
  assert.equal(daily.state,'bad');assert.equal(daily.creditIssue,true);assert.match(daily.detail,/10\/10 today/);
  const monthly=await apollo({usage:{daily:2,monthly:100}});
  assert.equal(monthly.state,'bad');assert.equal(monthly.creditIssue,true);assert.match(monthly.detail,/100\/100 this month/);
});

test('confirmed upstream Apollo billing failures identify who must restore credits',async()=>{
  const managed=await apollo({provider:{provider:'apollo',source:'managed',credit_issue:{code:'credits_exhausted',source:'managed'}}});
  assert.equal(managed.label,'Credits exhausted');assert.match(managed.detail,/LeadIntel must restore/);
  const customer=await apollo({provider:{provider:'apollo',source:'customer',credit_issue:{code:'credits_exhausted',source:'customer'}}});
  assert.match(customer.detail,/Your Apollo account/);
});

test('each connected AI provider with a confirmed credit failure gets its own red card',()=>{
  const context={isOwner:()=>true,signedIn:()=>true,providerErrors:{},busy:'',esc:value=>String(value),formatDate:()=>'-',formatDateTime:()=>'-'};
  vm.runInNewContext(`${cardFunction}\nglobalThis.run=providerCard`,context);
  const config={provider:'gemini',name:'Google Gemini',model:'gemini-test',hint:'AI',placeholder:'key'};
  const card=context.run(config,{configured:true,active:true,credit_issue:{code:'credits_exhausted',source:'customer'}});
  assert.match(card,/ai-provider-card active credit-alert/);assert.match(card,/ai-provider-status credit-alert">Credits exhausted/);
  assert.match(card,/Google Gemini reported exhausted credits/);
});
