import {normalizeEmail,buildMimeMessage,sendGmailMessage} from './gmail.js';
import {validateEmailContent} from './email-content.js';
import {sha256} from './security.js';
import {storageErrorResponse} from './workspace-storage.js';
const reply=(data,status,cors)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const failure=(message,status,cors,extra={})=>reply({error:message,...extra},status,cors);
export async function handleGmailTestSend(request,env,cors,{requireMember,connectedGmail,gmailAccess}){
 const workspaceId=new URL(request.url).searchParams.get('workspace_id')||'';
 const access=await requireMember(request,env,workspaceId,['owner','sales']);
 if(access.error)return failure(access.error,access.status,cors);
 if(request.method!=='POST')return failure('Method not allowed',405,cors);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>400000)return failure('Test email is too large',413,cors);
 let body;try{body=JSON.parse(raw);}catch{return failure('Test email payload is required',400,cors);}
 if(!body||body.confirmed!==true)return failure('Confirm the test recipient before sending',400,cors);
 const recipient=normalizeEmail(body.recipient);
 if(!recipient||/[<>,;:"\\\s]/.test(recipient))return failure('Enter one valid test email address',400,cors);
 const key=String(request.headers.get('Idempotency-Key')||'');
 if(!/^test-[a-f0-9-]{36}$/.test(key))return failure('A test send request key is required',400,cors);
 let content,subject;
 try{content=validateEmailContent(body);if(typeof body.subject!=='string'||!body.subject.trim()||body.subject.length>490||/[\r\n]/.test(body.subject))throw Error('A valid subject is required');subject='[TEST] '+body.subject.trim().replace(/^\[TEST\]\s*/i,'');}catch(e){return failure(e.message,400,cors);}
 const fingerprint=await sha256(JSON.stringify({recipient,subject,...content}));
 const lookup=()=>env.DB.prepare('SELECT id,status,recipient,subject,request_hash,gmail_message_id,sent_at FROM gmail_test_messages WHERE workspace_id=? AND user_id=? AND idempotency_key=?').bind(workspaceId,access.user.id,key).first();
 const duplicate=row=>row.request_hash!==fingerprint?failure('This test request already belongs to a different message',409,cors):reply({message:row,duplicate:true,test:true},200,cors);
 const existing=await lookup();if(existing)return duplicate(existing);
 const connection=await connectedGmail(env,workspaceId);if(!connection)return failure('Connect Gmail in this workspace before sending a test',409,cors);
 let mime;try{mime=buildMimeMessage({from:connection.google_email,to:recipient,subject,body:content.body,textBody:content.textBody,htmlBody:content.htmlBody});}catch(e){return failure(e.message,400,cors);}
 const id=crypto.randomUUID();
 try{
  const reserved=await env.DB.prepare("INSERT OR IGNORE INTO gmail_test_messages(id,workspace_id,user_id,idempotency_key,request_hash,recipient,subject,status) VALUES(?,?,?,?,?,?,?,'sending')").bind(id,workspaceId,access.user.id,key,fingerprint,recipient,subject).run();
  if(!reserved.meta?.changes)return duplicate(await lookup());
 }catch(e){return storageErrorResponse(e,cors)||failure('Unable to reserve test email',500,cors);}
 let submitted=false,confirmed=null;
 try{
  const token=await gmailAccess(env,connection);submitted=true;
  const sent=await sendGmailMessage(token.accessToken,mime);confirmed={id,status:'sent',recipient,subject,gmail_message_id:sent.id,sent_at:new Date().toISOString()};
  await env.DB.prepare("UPDATE gmail_test_messages SET status='sent',gmail_message_id=?,sent_at=? WHERE id=?").bind(sent.id,confirmed.sent_at,id).run();
  return reply({message:confirmed,test:true,duplicate:false},201,cors);
 }catch(e){
  if(confirmed)return reply({message:confirmed,test:true,record_warning:true},201,cors);
  const uncertain=submitted&&e.deliveryRejected!==true;
  if(!uncertain)await env.DB.prepare("UPDATE gmail_test_messages SET status='failed' WHERE id=?").bind(id).run();
  return failure(uncertain?'Delivery is unconfirmed. Check Gmail Sent before trying another test.':'Test email failed. '+String(e.message||'Gmail rejected the request'),502,cors,{test:true,message:{id,status:uncertain?'sending':'failed'},code:uncertain?'DELIVERY_UNCONFIRMED':'TEST_SEND_FAILED'});
 }
}
