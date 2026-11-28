import Stripe from 'stripe';
import {cookieValue,sha256,allowedOrigin} from './security.js';
import {getStorageStatus,storageAccount,storageErrorResponse} from './workspace-storage.js';
import {storagePreferences,listStorageFiles,storageBreakdown,storageGroup,removeBackup,removeFlowVersion,removeArchivedDraft} from './workspace-storage-management.js';
export const STRIPE_STORAGE_API_VERSION='2026-09-30.endive';
const json=(data,status=200,cors={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const id=value=>typeof value==='string'?value:value?.id||'';
const fail=(message,status=503)=>Object.assign(Error(message),{status,storagePublicError:true});
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
function client(env){return new Stripe(env.STRIPE_RESTRICTED_KEY,{apiVersion:STRIPE_STORAGE_API_VERSION,httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:1,timeout:15000});}
function returnUrl(env){const url=new URL(env.CUSTOMER_APP_URL);if(url.protocol!=='https:'||url.username||url.password)throw fail('Billing return URL is not configured');url.searchParams.set('settings','ai');return url;}
function billingMessage(cause){
 if(cause.storagePublicError&&cause.status===503)return cause.message;
 if(cause.statusCode===401)return 'Stripe could not authenticate the storage billing key.';
 return 'Storage billing is temporarily unavailable. Try again shortly.';
}
async function stripeRead(resource,read){
 try{return await read();}
 catch(cause){
  if(cause.statusCode===403)throw fail('The storage billing key needs read access to '+resource+'.');
  throw cause;
 }
}
async function catalogue(env,stripe){
 // Stripe prices are private to the issuing merchant. Look up the exact configured ID with this key.
 const price=await stripeRead('the storage price and product',()=>stripe.prices.retrieve(env.STRIPE_STORAGE_PLUS_PRICE_ID,{expand:['product']}));
 const mode=env.STRIPE_LIVEMODE==='true';
 if(!price.active||price.id!==env.STRIPE_STORAGE_PLUS_PRICE_ID||price.livemode!==mode||price.currency!=='eur'||!Number.isInteger(price.unit_amount)||price.unit_amount<=0||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||price.recurring.usage_type!=='licensed'||!price.product?.active||price.product.metadata?.leadintel_storage_plan!=='plus'||price.tax_behavior!==env.STRIPE_STORAGE_TAX_BEHAVIOR)throw fail('Storage billing price configuration needs attention');
 if(env.STRIPE_STORAGE_AUTOMATIC_TAX==='true'){
  const [settings,registrations]=await Promise.all([stripeRead('Stripe Tax settings',()=>stripe.tax.settings.retrieve()),stripeRead('Stripe Tax registrations',()=>stripe.tax.registrations.list({status:'active',limit:1}))]);
  if(settings.status!=='active'||!registrations.data?.some(r=>r.status==='active')||!id(price.product.tax_code))throw fail('Storage tax configuration requires verification');
 }
 const settings=await env.DB.prepare('SELECT monthly_amount_minor FROM storage_plan_settings WHERE id=1').first();
 return {base:price,quote:{amount_minor:settings.monthly_amount_minor??price.unit_amount,currency:price.currency,interval:'month',tax_behavior:price.tax_behavior}};
}
async function checkoutPrice(env,stripe,{base,quote}){
 if(quote.amount_minor===base.unit_amount)return base.id;
 const key=[env.STRIPE_ACCOUNT_ID,Number(base.livemode),base.id,quote.amount_minor];
 const saved=await stmt(env,'SELECT price_id FROM storage_plan_stripe_prices WHERE merchant=? AND livemode=? AND base_price=? AND amount=?',...key).first();
 if(saved)return saved.price_id;
 const price=await stripe.prices.create({product:base.product.id,currency:'eur',unit_amount:quote.amount_minor,
  recurring:{interval:'month'},tax_behavior:base.tax_behavior},{idempotencyKey:'leadintel-storage-price-'+key.join('-')});
 await stmt(env,'INSERT OR IGNORE INTO storage_plan_stripe_prices(merchant,livemode,base_price,amount,price_id) VALUES(?,?,?,?,?)',...key,price.id).run();
 return (await stmt(env,'SELECT price_id FROM storage_plan_stripe_prices WHERE merchant=? AND livemode=? AND base_price=? AND amount=?',...key).first()).price_id;
}
async function authorize(request,env,workspace,owner){
 const token=cookieValue(request,'leadintel_session');if(!token)throw fail('Authentication required',401);
 const user=await stmt(env,"SELECT users.id FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')",await sha256(token)).first();
 if(!user)throw fail('Authentication required',401);
 const member=await stmt(env,'SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?',workspace,user.id).first();
 if(!member||owner&&member.role!=='owner')throw fail('Workspace owner permission is required',403);
 return {...member,userId:user.id};
}
export async function handleStorageRoute(request,env,cors={},options={}){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/storage/'))return null;
 try{
  const action=url.pathname.slice('/api/storage/'.length),workspace=url.searchParams.get('workspace_id')||'';
  if(!['status','checkout','portal','files','backup','version','draft','preferences'].includes(action))return json({error:'Not found'},404,cors);
  const read=request.method==='GET'&&['status','files','preferences'].includes(action);
  if(!read&&(request.method!=='POST'||!['checkout','portal','backup','version','draft','preferences'].includes(action)))return json({error:'Method not allowed'},405,cors);
  if(!read&&(!allowedOrigin(request,env.APP_ORIGIN)||!request.headers.get('Content-Type')?.startsWith('application/json')))throw fail('Storage request origin is not permitted',403);
  const member=await authorize(request,env,workspace,!read);
  if(action==='files'){
   if(url.searchParams.has('group'))return json(await storageGroup(env,workspace,url.searchParams.get('group'),Number(url.searchParams.get('offset')||0),member.userId),200,cors);
   const list=await listStorageFiles(env,workspace);
   list.groups=await storageBreakdown(env,workspace);
   const usage=await storageAccount(env,workspace);
   list.usage={records:usage.records_bytes,files:usage.files_bytes};
   const plus=usage.plan_key==='plus'&&usage.paid_until>Date.now()/1000;
   list.priority=usage.records_bytes/usage[plus?'plus_records_limit':'included_records_limit']>=usage.files_bytes/usage[plus?'plus_files_limit':'included_files_limit']?'records_bytes':'files_bytes';
   return json(list,200,cors);
  }
  if(action==='draft'){
   const body=await request.json();
   if(typeof body?.id!=='string'||!Number.isSafeInteger(body.revision))throw fail('Invalid archived draft',400);
   await removeArchivedDraft(env,workspace,member.userId,body.id,body.revision);
   return json({deleted:true},200,cors);
  }
  if(action==='version'){
   const body=await request.json();
   if(typeof body?.flow_id!=='string'||body.flow_id.length>160||!Number.isSafeInteger(body.version)||body.version<1)throw fail('Invalid workflow version',400);
   await removeFlowVersion(env,workspace,body.flow_id,body.version);
   return json({deleted:true},200,cors);
  }
  if(action==='backup'){
   const body=await request.json();
   if(typeof body?.id!=='string'||body.id.length>160)throw fail('Invalid backup',400);
   await removeBackup(env,workspace,body.id);
   return json({deleted:true},200,cors);
  }
  if(action==='preferences'){
   const account=await storageAccount(env,workspace);
   if(!read){
    const text=await request.text();if(text.length>1024)throw fail('Storage settings request is too large',413);
    let body;try{body=JSON.parse(text);}catch{throw fail('Invalid storage settings',400);}
    if(typeof body?.auto_report_copies!=='boolean'||!Number.isSafeInteger(body.revision)||body.revision<0)throw fail('Storage preference and revision are required',400);
    const result=await stmt(env,'UPDATE workspace_storage_accounts SET auto_report_copies=?,storage_policy_revision=storage_policy_revision+1 WHERE workspace_id=? AND storage_policy_revision=?',body.auto_report_copies?1:0,workspace,body.revision).run();
    if(!result.meta.changes)throw fail('Storage settings changed. Refresh and try again.',409);
   }
   return json({workspace_id:workspace,preferences:storagePreferences(read?account:await storageAccount(env,workspace))},200,cors);
  }
  const status=await getStorageStatus(env,workspace,{role:member.role});
  if(action==='status'){
   if(status.billing.checkout_ready){
    try{status.upgrade.price=(await catalogue(env,options.stripe||client(env))).quote;status.billing.available=true;}
    catch(cause){status.billing.available=false;status.billing.checkout_ready=false;status.billing.can_upgrade=false;status.billing.can_manage=false;status.billing.message=billingMessage(cause);}
   }
   if(!status.upgrade.price){
    const settings=await env.DB.prepare('SELECT monthly_amount_minor FROM storage_plan_settings WHERE id=1').first();
    status.upgrade.price={amount_minor:settings.monthly_amount_minor??900,currency:'eur',interval:'month',tax_behavior:env.STRIPE_STORAGE_TAX_BEHAVIOR||'inclusive'};
   }
   return json(status,200,cors);
  }
  if(!status.billing.checkout_ready)throw fail('Storage payments are not enabled yet. Your included storage and saved data remain available.');
  const stripe=options.stripe||client(env);const offer=await catalogue(env,stripe);
  let row=await storageAccount(env,workspace);
  if(action==='portal'){
   if(!row.stripe_customer_id)throw fail('No storage billing account exists for this workspace',409);
   const session=await stripe.billingPortal.sessions.create({customer:row.stripe_customer_id,return_url:returnUrl(env).toString()});
   return json({url:session.url},200,cors);
  }
  if(status.plan.key==='plus'||row.stripe_subscription_id&&!['canceled','incomplete_expired'].includes(row.billing_status))throw fail('This workspace already has a storage subscription. Use Manage billing.',409);
  const now=Math.floor(Date.now()/1000);
  const token=crypto.randomUUID(),reserved=await stmt(env,'UPDATE workspace_storage_accounts SET checkout_token=?,checkout_lease=? WHERE workspace_id=? AND checkout_lease<?',token,now+90,workspace,now).run();
  if(!reserved.meta.changes)throw fail('A storage checkout is already being prepared. Retry shortly.',409);
  try{
   row=await storageAccount(env,workspace);
   if(row.stripe_subscription_id&&!['canceled','incomplete_expired'].includes(row.billing_status))throw fail('A storage subscription already exists.',409);
   const priceId=await checkoutPrice(env,stripe,offer);
   if(row.stripe_checkout_expires>now&&row.stripe_checkout_url){
    if((row.stripe_checkout_price_id||env.STRIPE_STORAGE_PLUS_PRICE_ID)===priceId){
     await stmt(env,'UPDATE workspace_storage_accounts SET checkout_token=NULL,checkout_lease=0 WHERE workspace_id=? AND checkout_token=?',workspace,token).run();
     return json({url:row.stripe_checkout_url},200,cors);
    }
    const old=await stripe.checkout.sessions.retrieve(row.stripe_checkout_id);
    if(old.status==='complete')throw fail('A previous checkout is processing. Refresh billing before starting another.',409);
    if(old.status==='open')await stripe.checkout.sessions.expire(old.id);
   }
   if(!row.stripe_customer_id){
    const customer=await stripe.customers.create({name:'LeadIntel workspace '+workspace},{idempotencyKey:'leadintel-storage-customer-'+workspace});
    await stmt(env,'UPDATE workspace_storage_accounts SET stripe_customer_id=? WHERE workspace_id=? AND checkout_token=?',customer.id,workspace,token).run();row={...row,stripe_customer_id:customer.id};
   }
   const success=returnUrl(env);success.searchParams.set('storage_checkout','returned');
   const cancel=returnUrl(env);cancel.searchParams.set('storage_checkout','canceled');
   const suffix=Array.from(crypto.getRandomValues(new Uint8Array(8)),v=>String.fromCharCode(97+v%26)).join('');
   const session=await stripe.checkout.sessions.create({mode:'subscription',customer:row.stripe_customer_id,line_items:[{price:priceId,quantity:1}],subscription_data:{billing_mode:{type:'flexible'}},...(env.STRIPE_STORAGE_AUTOMATIC_TAX==='true'?{automatic_tax:{enabled:true},tax_id_collection:{enabled:true},customer_update:{address:'auto',name:'auto'},billing_address_collection:'required'}:{}),integration_identifier:'leadintel_storage_'+suffix,success_url:success.toString(),cancel_url:cancel.toString()},{idempotencyKey:'leadintel-storage-checkout-'+workspace+'-'+token});
   await stmt(env,'UPDATE workspace_storage_accounts SET stripe_checkout_id=?,stripe_checkout_price_id=?,stripe_checkout_url=?,stripe_checkout_expires=?,checkout_token=NULL,checkout_lease=0 WHERE workspace_id=? AND checkout_token=?',session.id,priceId,session.url,session.expires_at,workspace,token).run();
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
 if(items.length!==1||items[0].quantity!==1)return {ignored:true};
 const priceId=id(items[0].price);
 if(priceId!==env.STRIPE_STORAGE_PLUS_PRICE_ID&&!await stmt(env,'SELECT 1 FROM storage_plan_stripe_prices WHERE merchant=? AND livemode=? AND price_id=?',env.STRIPE_ACCOUNT_ID,Number(event.livemode),priceId).first())return {ignored:true};
 let invoice=subscription.latest_invoice;if(typeof invoice==='string')invoice=await stripe.invoices.retrieve(invoice);
 let paidUntil=0;
 if(invoice?.status==='paid'&&invoice.amount_remaining===0&&id(invoice.customer)===customer&&id(invoice.parent?.subscription_details?.subscription)===subscriptionId&&invoice.livemode===event.livemode){
  const ends=(invoice.lines?.data||[]).filter(line=>id(line.pricing?.price_details?.price)===priceId).map(line=>line.period?.end).filter(Number.isSafeInteger);
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
 try{const stripe=options.stripe||client(env);return json(await applyEvent(env,event,stripe));}
 catch(cause){return json({error:cause.status===400?'Invalid storage event ownership':'Storage event requires retry'},cause.status===400?400:503);}
}
