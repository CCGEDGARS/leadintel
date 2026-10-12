import Stripe from 'stripe';
import {cookieValue,sha256,allowedOrigin} from './security.js';
import {getStorageStatus,storageAccount,storageErrorResponse} from './workspace-storage.js';
export const STRIPE_STORAGE_API_VERSION='2026-09-30.endive';
const json=(data,status=200,cors={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const id=value=>typeof value==='string'?value:value?.id||'';
const fail=(message,status=503)=>Object.assign(Error(message),{status});
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
function client(env){return new Stripe(env.STRIPE_RESTRICTED_KEY,{apiVersion:STRIPE_STORAGE_API_VERSION,httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:1,timeout:15000});}
function returnUrl(env){const url=new URL(env.CUSTOMER_APP_URL);if(url.protocol!=='https:'||url.username||url.password)throw fail('Billing return URL is not configured');url.searchParams.set('settings','ai');return url;}
async function catalogue(env,stripe){
 const [account,price]=await Promise.all([stripe.accounts.retrieve(),stripe.prices.retrieve(env.STRIPE_STORAGE_PLUS_PRICE_ID,{expand:['product']})]);
 const mode=env.STRIPE_LIVEMODE==='true';
 if(account.id!==env.STRIPE_ACCOUNT_ID)throw fail('Storage billing merchant configuration needs attention');
 if(!price.active||price.id!==env.STRIPE_STORAGE_PLUS_PRICE_ID||price.livemode!==mode||price.currency!=='eur'||!Number.isInteger(price.unit_amount)||price.unit_amount<=0||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||price.recurring.usage_type!=='licensed'||!price.product?.active||price.product.metadata?.leadintel_storage_plan!=='plus'||price.tax_behavior!==env.STRIPE_STORAGE_TAX_BEHAVIOR)throw fail('Storage billing price configuration needs attention');
 if(env.STRIPE_STORAGE_AUTOMATIC_TAX==='true'){
  const [settings,registrations]=await Promise.all([stripe.tax.settings.retrieve(),stripe.tax.registrations.list({status:'active',limit:1})]);
  if(settings.status!=='active'||!registrations.data?.some(r=>r.status==='active')||!id(price.product.tax_code))throw fail('Storage tax configuration requires verification');
 }
 return {amount_minor:price.unit_amount,currency:price.currency,interval:'month',tax_behavior:price.tax_behavior};
}
async function authorize(request,env,workspace,owner){
 const token=cookieValue(request,'leadintel_session');if(!token)throw fail('Authentication required',401);
 const user=await stmt(env,"SELECT users.id FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')",await sha256(token)).first();
 if(!user)throw fail('Authentication required',401);
 const member=await stmt(env,'SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?',workspace,user.id).first();
 if(!member||owner&&member.role!=='owner')throw fail('Workspace owner permission is required',403);
 return member;
}
export async function handleStorageRoute(request,env,cors={},options={}){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/storage/'))return null;
 try{
  const action=url.pathname.slice('/api/storage/'.length),workspace=url.searchParams.get('workspace_id')||'';
  if(!['status','checkout','portal'].includes(action))return json({error:'Not found'},404,cors);
  if(request.method!==(action==='status'?'GET':'POST'))return json({error:'Method not allowed'},405,cors);
  if(action!=='status'&&(!allowedOrigin(request,env.APP_ORIGIN)||!request.headers.get('Content-Type')?.startsWith('application/json')))throw fail('Billing request origin is not permitted',403);
  const member=await authorize(request,env,workspace,action!=='status');
  const status=await getStorageStatus(env,workspace,{role:member.role});
  if(action==='status'){
   if(status.billing.checkout_ready)status.upgrade.price=await catalogue(env,options.stripe||client(env));
   return json(status,200,cors);
  }
  if(!status.billing.checkout_ready)throw fail('Storage payments are not enabled yet. Your included storage and saved data remain available.');
  const stripe=options.stripe||client(env);await catalogue(env,stripe);
  let row=await storageAccount(env,workspace);
  if(action==='portal'){
   if(!row.stripe_customer_id)throw fail('No storage billing account exists for this workspace',409);
   const session=await stripe.billingPortal.sessions.create({customer:row.stripe_customer_id,return_url:returnUrl(env).toString()});
   return json({url:session.url},200,cors);
  }
  if(status.plan.key==='plus'||row.stripe_subscription_id&&!['canceled','incomplete_expired'].includes(row.billing_status))throw fail('This workspace already has a storage subscription. Use Manage billing.',409);
  const now=Math.floor(Date.now()/1000);
  if(row.stripe_checkout_expires>now&&row.stripe_checkout_url)return json({url:row.stripe_checkout_url},200,cors);
  const token=crypto.randomUUID(),reserved=await stmt(env,'UPDATE workspace_storage_accounts SET checkout_token=?,checkout_lease=? WHERE workspace_id=? AND checkout_lease<?',token,now+90,workspace,now).run();
  if(!reserved.meta.changes)throw fail('A storage checkout is already being prepared. Retry shortly.',409);
  try{
   if(!row.stripe_customer_id){
    const customer=await stripe.customers.create({name:'LeadIntel workspace '+workspace},{idempotencyKey:'leadintel-storage-customer-'+workspace});
    await stmt(env,'UPDATE workspace_storage_accounts SET stripe_customer_id=? WHERE workspace_id=? AND checkout_token=?',customer.id,workspace,token).run();row={...row,stripe_customer_id:customer.id};
   }
   const success=returnUrl(env);success.searchParams.set('storage_checkout','returned');
   const cancel=returnUrl(env);cancel.searchParams.set('storage_checkout','canceled');
   const suffix=Array.from(crypto.getRandomValues(new Uint8Array(8)),v=>String.fromCharCode(97+v%26)).join('');
   const session=await stripe.checkout.sessions.create({mode:'subscription',customer:row.stripe_customer_id,line_items:[{price:env.STRIPE_STORAGE_PLUS_PRICE_ID,quantity:1}],subscription_data:{billing_mode:{type:'flexible'}},...(env.STRIPE_STORAGE_AUTOMATIC_TAX==='true'?{automatic_tax:{enabled:true},tax_id_collection:{enabled:true},customer_update:{address:'auto'},billing_address_collection:'required'}:{}),integration_identifier:'leadintel_storage_'+suffix,success_url:success.toString(),cancel_url:cancel.toString()},{idempotencyKey:'leadintel-storage-checkout-'+workspace+'-'+token});
   await stmt(env,'UPDATE workspace_storage_accounts SET stripe_checkout_id=?,stripe_checkout_url=?,stripe_checkout_expires=?,checkout_token=NULL,checkout_lease=0 WHERE workspace_id=? AND checkout_token=?',session.id,session.url,session.expires_at,workspace,token).run();
   return json({url:session.url},200,cors);
  }catch(cause){await stmt(env,'UPDATE workspace_storage_accounts SET checkout_token=NULL,checkout_lease=0 WHERE workspace_id=? AND checkout_token=?',workspace,token).run();throw cause;}
 }catch(cause){return storageErrorResponse(cause,cors)||json({error:cause.status?cause.message:'Storage billing is temporarily unavailable. Retry from Settings; your saved data is preserved.'},cause.status||503,cors);}
}
const eventTypes=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed','invoice.paid','invoice.payment_failed','invoice.payment_action_required','invoice.marked_uncollectible','invoice.voided']);
async function applyEvent(env,event,stripe){
 if(await stmt(env,'SELECT event_id FROM workspace_storage_webhook_events WHERE event_id=?',event.id).first())return {duplicate:true};
 let object=event.data?.object,subscriptionId='';
 if(event.type.startsWith('checkout.')){object=await stripe.checkout.sessions.retrieve(object.id);subscriptionId=id(object.subscription);}
 else if(event.type.startsWith('invoice.')){object=await stripe.invoices.retrieve(object.id);subscriptionId=id(object.parent?.subscription_details?.subscription);}
 else subscriptionId=object.id;
 if(!subscriptionId)return {ignored:true};
 const subscription=await stripe.subscriptions.retrieve(subscriptionId,{expand:['latest_invoice']});
 const customer=id(subscription.customer),row=await stmt(env,'SELECT * FROM workspace_storage_accounts WHERE stripe_customer_id=?',customer).first();
 if(!row)return {ignored:true};
 if(subscription.livemode!==event.livemode||id(object.customer)!==customer||row.stripe_subscription_id&&row.stripe_subscription_id!==subscriptionId&&!['canceled','incomplete_expired'].includes(row.billing_status))throw fail('Storage event ownership is invalid',400);
 const items=subscription.items?.data||[];
 if(items.length!==1||id(items[0].price)!==env.STRIPE_STORAGE_PLUS_PRICE_ID||items[0].quantity!==1)return {ignored:true};
 let invoice=subscription.latest_invoice;if(typeof invoice==='string')invoice=await stripe.invoices.retrieve(invoice);
 let paidUntil=0;
 if(invoice?.status==='paid'&&invoice.amount_remaining===0&&id(invoice.customer)===customer&&id(invoice.parent?.subscription_details?.subscription)===subscriptionId&&invoice.livemode===event.livemode){
  const ends=(invoice.lines?.data||[]).filter(line=>id(line.pricing?.price_details?.price)===env.STRIPE_STORAGE_PLUS_PRICE_ID).map(line=>line.period?.end).filter(Number.isSafeInteger);
  if(ends.length)paidUntil=Math.max(...ends);
 }
 const unpaidLatest=invoice?.status!=='paid'&&id(invoice?.id)===id(object?.id);
 const failedLatest=unpaidLatest&&['invoice.payment_failed','invoice.payment_action_required','invoice.marked_uncollectible'].includes(event.type);
 const billing=failedLatest?'payment_failed':subscription.status;
 await env.DB.batch([
  stmt(env,'INSERT OR IGNORE INTO workspace_storage_webhook_events(event_id,created) VALUES(?,?)',event.id,event.created),
  stmt(env,"UPDATE workspace_storage_accounts SET stripe_subscription_id=?,plan_key=CASE WHEN MAX(paid_until,?)>unixepoch() THEN 'plus' ELSE 'included' END,paid_until=MAX(paid_until,?),billing_status=?,billing_event_created=?,stripe_checkout_url=NULL,stripe_checkout_expires=0 WHERE workspace_id=? AND billing_event_created<=?",subscriptionId,paidUntil,paidUntil,billing,event.created,row.workspace_id,event.created)
 ]);
 return {received:true};
}
async function boundedWebhookBody(request){
 const limit=1048576;
 if(Number(request.headers.get('Content-Length'))>limit)throw fail('Storage event is too large',413);
 if(!request.body)return '';
 const reader=request.body.getReader(),chunks=[];let length=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw fail('Storage event is too large',413);}chunks.push(value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function handleStorageWebhook(request,env,options={}){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(!env.STRIPE_RESTRICTED_KEY||!env.STRIPE_WEBHOOK_SECRET||!env.STRIPE_STORAGE_PLUS_PRICE_ID||env.STRIPE_STORAGE_BILLING_ENABLED!=='true')return json({error:'Storage webhook is not configured'},503);
 let event;
 try{
  const body=await boundedWebhookBody(request);
  const verifier=client(env);
  event=await verifier.webhooks.constructEventAsync(body,request.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET,300,Stripe.createSubtleCryptoProvider());
  if(event.livemode!==(env.STRIPE_LIVEMODE==='true')||!/^evt_[A-Za-z0-9_-]+$/.test(event.id)||!Number.isSafeInteger(event.created)||event.account)throw Error('invalid event context');
 }catch(cause){return json({error:cause.status===413?'Storage event is too large':'Invalid storage webhook signature or context'},cause.status===413?413:400);}
 if(!eventTypes.has(event.type))return json({ignored:true});
 try{const stripe=options.stripe||client(env);const account=await stripe.accounts.retrieve();if(account.id!==env.STRIPE_ACCOUNT_ID)throw fail('Invalid storage merchant',400);return json(await applyEvent(env,event,stripe));}
 catch(cause){return json({error:cause.status===400?'Invalid storage event ownership':'Storage event requires retry'},cause.status===400?400:503);}
}
