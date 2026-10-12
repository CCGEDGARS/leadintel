import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHmac} from 'node:crypto';
import {storageDb} from './workspace-storage-fixture.mjs';
import {sha256} from '../src/security.js';

const secret='fixture-webhook-secret',price='price_storage_fixture',customer='cus_storage_fixture',subId='sub_storage_fixture';
async function fixture(){
 assert.ok(fs.existsSync(new URL('../src/workspace-storage-billing.js',import.meta.url)),'storage payment lifecycle is missing');
 const mod=await import('../src/workspace-storage-billing.js'),DB=storageDb();
 await DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner',datetime('now','+1 day'))").bind(await sha256('fixture-session')).run();
 const env={DB,APP_ORIGIN:'https://app.test',CUSTOMER_APP_URL:'https://app.test/customer/',STRIPE_ACCOUNT_ID:'acct_fixture',STRIPE_RESTRICTED_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:secret,STRIPE_STORAGE_PLUS_PRICE_ID:price,STRIPE_STORAGE_BILLING_ENABLED:'true',STRIPE_LIVEMODE:'false',STRIPE_STORAGE_TAX_BEHAVIOR:'inclusive',STRIPE_STORAGE_TAX_POLICY_READY:'true'};
 const invoice={id:'in_fixture',status:'paid',amount_remaining:0,customer,livemode:false,parent:{subscription_details:{subscription:subId}},lines:{data:[{pricing:{price_details:{price}},period:{end:Math.floor(Date.now()/1000)+3600}}]}};
 const subscription={id:subId,customer,status:'active',livemode:false,items:{data:[{price:{id:price},quantity:1}]},latest_invoice:invoice};
 const calls=[];
 const stripe={accounts:{async retrieve(){return {id:'acct_fixture'};}},prices:{async retrieve(){return {id:price,active:true,livemode:false,currency:'eur',unit_amount:900,type:'recurring',tax_behavior:'inclusive',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},product:{active:true,metadata:{leadintel_storage_plan:'plus'}}};}},customers:{async create(){calls.push('customer');return {id:customer};}},checkout:{sessions:{async create(params){calls.push(params);return {id:'cs_fixture',url:'https://checkout.stripe.com/c/pay/cs_fixture',expires_at:Math.floor(Date.now()/1000)+1800};},async retrieve(){return {id:'cs_fixture',customer,subscription:subId,status:'complete',payment_status:'paid',livemode:false};}}},subscriptions:{async retrieve(){return structuredClone(subscription);}},invoices:{async retrieve(){return structuredClone(invoice);}},billingPortal:{sessions:{async create(params){calls.push(params);return {url:'https://billing.stripe.com/p/session/fixture'};}}}};
 const request=(path,workspace='storage-w1')=>new Request('https://api.test/api/storage/'+path+'?workspace_id='+workspace,{method:path==='status'?'GET':'POST',headers:{Cookie:'leadintel_session=fixture-session',Origin:'https://app.test','Content-Type':'application/json'},...(path==='status'?{}:{body:'{}'})});
 const deliver=async(type,id='evt_'+crypto.randomUUID(),created=Math.floor(Date.now()/1000),data)=>{
  const object=data|| (type.startsWith('checkout.')?{id:'cs_fixture',object:'checkout.session'}:type.startsWith('invoice.')?invoice:subscription);
  const body=JSON.stringify({id,type,created,livemode:false,data:{object}}),t=Math.floor(Date.now()/1000),signature=createHmac('sha256',secret).update(t+'.'+body).digest('hex');
  return mod.handleStorageWebhook(new Request('https://api.test/api/webhooks/stripe/storage',{method:'POST',headers:{'Stripe-Signature':`t=${t},v1=${signature}`},body}),env,{stripe});
 };
 return {mod,DB,env,stripe,calls,invoice,subscription,request,deliver};
}
test('owner Checkout uses the configured merchant price, reuses pending session and does not grant capacity',async()=>{
 const f=await fixture();const response=await f.mod.handleStorageRoute(f.request('checkout'),f.env,{}, {stripe:f.stripe});
 assert.equal(response.status,200);assert.equal((await response.json()).url,'https://checkout.stripe.com/c/pay/cs_fixture');
 const payload=f.calls.find(x=>x.mode==='subscription');assert.deepEqual(payload.line_items,[{price,quantity:1}]);assert.deepEqual(payload.subscription_data.billing_mode,{type:'flexible'});assert.equal(payload.payment_method_types,undefined);assert.match(payload.integration_identifier,/leadintel_storage_[a-z]{8}$/);
 assert.equal(f.DB.raw.prepare("SELECT plan_key FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().plan_key,'included');
 await f.mod.handleStorageRoute(f.request('checkout'),f.env,{}, {stripe:f.stripe});assert.equal(f.calls.filter(x=>x.mode==='subscription').length,1);
 assert.equal((await f.mod.handleStorageRoute(f.request('checkout','storage-w2'),f.env,{}, {stripe:f.stripe})).status,403);
 delete f.env.STRIPE_WEBHOOK_SECRET;assert.equal((await f.mod.handleStorageRoute(f.request('checkout'),f.env,{}, {stripe:f.stripe})).status,503);
});
test('signed paid invoice grants the scoped workspace; duplicate and late failures do not erase paid renewal',async()=>{
 const f=await fixture();f.DB.raw.prepare("UPDATE workspace_storage_accounts SET stripe_customer_id=? WHERE workspace_id='storage-w1'").run(customer);
 const now=Math.floor(Date.now()/1000);assert.equal((await f.deliver('invoice.paid','evt_paid',now)).status,200);
 let row=f.DB.raw.prepare("SELECT * FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get();assert.equal(row.plan_key,'plus');assert.equal(row.paid_until,f.invoice.lines.data[0].period.end);
 assert.equal(f.DB.raw.prepare("SELECT plan_key FROM workspace_storage_accounts WHERE workspace_id='storage-w2'").get().plan_key,'included');
 assert.equal((await f.deliver('invoice.paid','evt_paid',now)).status,200);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM workspace_storage_webhook_events').get().n,1);
 f.invoice.lines.data[0].period.end+=3600;assert.equal((await f.deliver('invoice.paid','evt_renew',now+2)).status,200);
 assert.equal((await f.deliver('invoice.payment_failed','evt_old_failure',now-1)).status,200);
 row=f.DB.raw.prepare("SELECT * FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get();assert.equal(row.paid_until,f.invoice.lines.data[0].period.end);assert.equal(row.billing_status,'active');
});
test('unpaid checkout does not grant storage; payment failure is red and cancellation preserves saved records',async()=>{
 const f=await fixture();f.DB.raw.prepare("UPDATE workspace_storage_accounts SET stripe_customer_id=? WHERE workspace_id='storage-w1'").run(customer);
 f.invoice.status='open';f.invoice.amount_remaining=900;f.subscription.status='past_due';f.subscription.latest_invoice=f.invoice;
 assert.equal((await f.deliver('checkout.session.completed')).status,200);
 assert.equal(f.DB.raw.prepare("SELECT paid_until FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().paid_until,0);
 const {getStorageStatus}=await import('../src/workspace-storage.js');assert.equal((await getStorageStatus(f.env,'storage-w1')).billing.payment_issue,true);
 f.DB.raw.exec("INSERT INTO content_materials(id,workspace_id,title,category,body,created_by) VALUES('saved','storage-w1','Saved','draft','Keep this exact text','storage-owner')");
 f.subscription.status='canceled';await f.deliver('customer.subscription.deleted');
 assert.equal(f.DB.raw.prepare("SELECT body FROM content_materials WHERE id='saved'").get().body,'Keep this exact text');
});
test('forged signature, wrong mode and unknown Customer cannot grant storage',async()=>{
 const f=await fixture();
 const forged=new Request('https://api.test/api/webhooks/stripe/storage',{method:'POST',headers:{'Stripe-Signature':'t=1,v1=bad'},body:'{}'});
 assert.equal((await f.mod.handleStorageWebhook(forged,f.env,{stripe:f.stripe})).status,400);
 f.env.STRIPE_LIVEMODE='true';assert.equal((await f.deliver('invoice.paid')).status,400);f.env.STRIPE_LIVEMODE='false';
 assert.equal((await f.deliver('invoice.paid')).status,200);
 assert.equal(f.DB.raw.prepare("SELECT plan_key FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().plan_key,'included');
});

test('automatic tax cannot be enabled without active settings, confirmed product code and an active registration',async()=>{
 const f=await fixture();f.env.STRIPE_STORAGE_AUTOMATIC_TAX='true';
 f.stripe.tax={settings:{async retrieve(){return {status:'pending'};}},registrations:{async list(){return {data:[]};}}};
 const response=await f.mod.handleStorageRoute(f.request('checkout'),f.env,{}, {stripe:f.stripe});
 assert.equal(response.status,503);assert.equal(f.calls.some(x=>x.mode==='subscription'),false);
});

test('webhook body is bounded before signature parsing even without Content-Length',async()=>{
 const f=await fixture();let canceled=false,parts=0;
 const stream=new ReadableStream({pull(controller){if(parts++<4)controller.enqueue(new Uint8Array(600000));else controller.close();},cancel(){canceled=true;}});
 const request=new Request('https://api.test/api/webhooks/stripe/storage',{method:'POST',headers:{'Stripe-Signature':'invalid'},body:stream,duplex:'half'});
 const response=await f.mod.handleStorageWebhook(request,f.env,{stripe:f.stripe});assert.equal(response.status,413);assert.equal(canceled,true);
});
