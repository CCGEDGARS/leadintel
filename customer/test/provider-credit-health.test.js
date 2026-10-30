const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','ai-settings.js'),'utf8');
const settingsScopeFunctions=source.slice(source.indexOf('function settingsContext(){'),source.indexOf('function prepareSettingsContext(){'));
const apolloFunction=source.slice(source.indexOf('async function checkApolloStatus(){'),source.indexOf('async function checkFirecrawlStatus(){'));
const cardFunction=source.slice(source.indexOf('function providerCard(config,current){'),source.indexOf('function formatDate(value){'));

async function apollo({usage={daily:0,monthly:0},policy={daily_credit_limit:10,monthly_credit_limit:100},provider={provider:'apollo',configured:true,source:'customer',state:'good'}}={}){
  const serverBridge={workspace:{id:'credit-health-workspace',role:'owner'},session:{authenticated:true,user:{id:'credit-health-user'}}};
  const context={settingsEpoch:0,bridge:()=>serverBridge,workspace:()=>serverBridge.workspace,signedIn:()=>Boolean(serverBridge.session.authenticated&&serverBridge.workspace?.id),api:async route=>route==='/api/enrichment-policy'?{response:{ok:true},payload:{configured:true,usage,policy}}:{response:{ok:true},payload:{providers:[{configured:provider.source==='customer',...provider}]}}};
  vm.runInNewContext(`${settingsScopeFunctions}\n${apolloFunction}\nglobalThis.run=checkApolloStatus`,context);
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
  assert.equal(managed.label,'Not connected');assert.match(managed.detail,/Connect your own Apollo/);
  const customer=await apollo({provider:{provider:'apollo',source:'customer',credit_issue:{code:'credits_exhausted',source:'customer'}}});
  assert.match(customer.detail,/Your Apollo account/);
});

test('each connected AI provider with a confirmed credit failure gets its own red card',()=>{
  const context={isOwner:()=>true,signedIn:()=>true,providerErrors:{},busy:'',esc:value=>String(value),formatDate:()=>'-',formatDateTime:()=>'-',paymentError:()=>false};
  vm.runInNewContext(`${cardFunction}\nglobalThis.run=providerCard`,context);
  const config={provider:'gemini',name:'Google Gemini',model:'gemini-test',hint:'AI',placeholder:'key'};
  const card=context.run(config,{configured:true,active:true,credit_issue:{code:'credits_exhausted',source:'customer'}});
  assert.match(card,/ai-provider-card active credit-alert/);assert.match(card,/ai-provider-status credit-alert">Credits exhausted/);
  assert.match(card,/Google Gemini reported exhausted credits/);
});

test('connection failures are yellow while confirmed payment failures remain red',()=>{
 const start=source.indexOf('function integrationTone('),end=source.indexOf('function providerCard(');
 assert.ok(start>=0,'integration alert tone classifier is required');
 const context={};vm.runInNewContext(source.slice(start,end)+'\nglobalThis.run=integrationTone',context);
 assert.equal(context.run({state:'bad',label:'Connection error'}),'warn');
 assert.equal(context.run({state:'bad',creditIssue:true}),'bad');
 assert.equal(context.run({state:'good'}),'good');
});

test('a failed first AI connection shows a red payment card without claiming a saved credential',()=>{
 const context={isOwner:()=>true,signedIn:()=>true,providerErrors:{anthropic:'Anthropic request failed (400) · code: credits_exhausted · Open Billing & credits.'},busy:'',esc:value=>String(value),formatDate:()=>'-',formatDateTime:()=>'-'};
 const classifier=source.slice(source.indexOf('function paymentError('),source.indexOf('function providerCard('));
 vm.runInNewContext(`${classifier}\n${cardFunction}\nglobalThis.run=providerCard`,context);
 const config={provider:'anthropic',name:'Anthropic',model:'claude-sonnet-5-5',hint:'AI',placeholder:'key'};
 const card=context.run(config,{configured:false,active:false});
 assert.match(card,/ai-provider-card  credit-alert/);assert.match(card,/Payment required/);assert.match(card,/No credential stored yet/);
 assert.match(card,/data-payment-error="true"/);
 context.providerErrors.anthropic='Anthropic request failed (400) · code: invalid_parameter';
 const requestError=context.run(config,{configured:false});assert.doesNotMatch(requestError,/ai-provider-card  credit-alert/);assert.match(requestError,/Not connected/);
});

test('connection-test payment state updates immediately and clears without rebuilding the key input',()=>{
 const toggles={};const node={dataset:{},textContent:'',hidden:true};const badge={classList:{toggle:(name,value)=>toggles['badge-'+name]=value},textContent:''};
 const card={classList:{toggle:(name,value)=>toggles[name]=value},querySelector:()=>badge};
 let healthUpdates=0;
 const context={document:{querySelector:selector=>selector.includes('data-ai-error')?node:card},providerErrors:{anthropic:'Anthropic request failed (400) · code: credits_exhausted'},providerState:()=>({configured:false}),renderIntegrationMonitoring:()=>healthUpdates++};
 const classifier=source.slice(source.indexOf('function paymentError('),source.indexOf('function providerCard('));
 const helper=source.slice(source.indexOf('function updateProviderErrorUi('),source.indexOf('function openDrawer('));
 vm.runInNewContext(`${classifier}\n${helper}\nglobalThis.update=updateProviderErrorUi;globalThis.clear=clearProviderError`,context);
 assert.equal(typeof context.update,'function');context.update('anthropic');
 assert.equal(toggles['credit-alert'],true);assert.equal(badge.textContent,'Payment required');assert.equal(node.hidden,false);
 context.clear('anthropic');assert.equal(toggles['credit-alert'],false);assert.equal(badge.textContent,'Not connected');assert.equal(node.hidden,true);assert.equal(healthUpdates,2);
});
