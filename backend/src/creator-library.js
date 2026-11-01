import {cookieValue,sha256,constantTimeEqual} from './security.js';
import {loginThrottleKey,reserveLoginAttempt,clearLoginThrottle} from './login-throttle.js';
import {coreScripts,validateScript} from './script-library-routes.js';
const TTL=15*60*1000;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const json=(value,status,cors)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const cookie=(value,seconds=900)=>`leadintel_creator=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=None`;
const secret=env=>env.CREATOR_LIBRARY_PASSWORD||env.ADMIN_PASSWORD;
async function signature(env,session,expires){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret(env)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(session+'|'+expires)))).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function creatorUnlocked(request,env,session){
 if(!secret(env))return false;
 const [expires,mac]=cookieValue(request,'leadintel_creator').split('.');
 const n=Number(expires);return Number.isSafeInteger(n)&&n>Date.now()&&n<=Date.now()+TTL&&constantTimeEqual(mac||'',await signature(env,session,expires));
}
export function validateCreatorScript(input){
 const out=validateScript(input,{core:true});
 if(input.mode==='inmail')fail('Manage the four-stage InMail sequence in its dedicated editor.');
 if(typeof input.original!=='string'||!input.original.trim()||input.original.length>30000)fail('Add the original script (up to 30,000 characters).');
 const folder=String(input.folder||'').trim();if(folder.length>80||/[\x00-\x1f]/.test(folder))fail('Invalid subfolder');
 return {...out,original:input.original,folder,deleted:false};
}
export async function handleCreatorLibrary(request,env,cors,{user,session,canManage}){
 const url=new URL(request.url),suffix=url.pathname.slice('/api/script-library/creator'.length);
 if(!canManage)fail('Creator access required',403);
 if(suffix==='/status'&&request.method==='GET')return json({unlocked:await creatorUnlocked(request,env,session),passwordConfigured:Boolean(secret(env))},200,cors);
 if(suffix==='/lock'&&request.method==='POST')return json({ok:true},200,{...cors,'Set-Cookie':cookie('',0)});
 if(suffix==='/unlock'&&request.method==='POST'){
  const input=await request.text();if(input.length>2048)fail('Invalid password request');
  let body;try{body=JSON.parse(input);}catch{fail('Invalid password request');}
  if(!secret(env))fail('Creator password has not been configured',503);
  const key=await loginThrottleKey(request,'creator-library:'+user.email),attempt=await reserveLoginAttempt(env,key,{failClosed:true});
  if(!attempt.allowed)return json({error:'Too many unlock attempts. Try again later.'},429,{...cors,'Retry-After':String(attempt.retryAfterSeconds)});
  if(typeof body.password!=='string'||!constantTimeEqual(body.password,secret(env)))fail('Incorrect creator password',401);
  await clearLoginThrottle(env,key);const expires=String(Date.now()+TTL);
  return json({ok:true,expiresAt:Number(expires)},200,{...cors,'Set-Cookie':cookie(expires+'.'+await signature(env,session,expires))});
 }
 if(!await creatorUnlocked(request,env,session))fail('Unlock Creator Library first',423);
 if(!suffix&&request.method==='GET'){
  const rows=await env.DB.prepare('SELECT id,payload_json,revision FROM creator_script_library ORDER BY updated_at DESC,id').all();
  return json({scripts:(rows.results||[]).map(row=>({...JSON.parse(row.payload_json),id:row.id,revision:row.revision})),active:(await coreScripts(env.DB)).map(({history,...row})=>row)},200,cors);
 }
 const match=suffix.match(/^\/([a-f0-9-]{36})(\/activate)?$/);if(!match)fail('Not found',404);
 if(!['PUT','DELETE','POST'].includes(request.method))fail('Method not allowed',405);
 const raw=await request.text();if(raw.length>50000)fail('Script payload too large',413);let body;try{body=JSON.parse(raw);}catch{fail('Invalid script payload');}
 if(!body||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)fail('Expected revision is required');
 const id=match[1],row=await env.DB.prepare('SELECT payload_json,revision FROM creator_script_library WHERE id=?').bind(id).first();
 if((row?.revision||0)!==body.expectedRevision)fail('This script changed elsewhere. Reload before saving; your edits are preserved.',409);
 if(match[2]){
  if(request.method!=='POST')fail('Method not allowed',405);
  if(!row||JSON.parse(row.payload_json).deleted)fail('Script not found',404);
  const draft=JSON.parse(row.payload_json),slot=draft.channel+':'+draft.style,existing=(await coreScripts(env.DB)).find(s=>s.id===slot);
  if(!Number.isSafeInteger(body.expectedCoreRevision)||body.expectedCoreRevision<0||(existing?.revision||0)!==body.expectedCoreRevision)fail('The active master changed. Reload before activating.',409);
  const active={...validateScript(draft,{core:true}),original:draft.original,deleted:false,builtin:false,masterVersion:'creator-'+id+'-v'+row.revision,creatorSource:{id,revision:row.revision},history:[...(existing?.history||[]),...(existing?[{...existing,history:undefined}]:[])].slice(-30)};
  const args=[JSON.stringify(active),user.id,id,row.revision];let result;
  if(body.expectedCoreRevision===0)result=await env.DB.prepare('INSERT OR IGNORE INTO core_script_registry(id,payload_json,revision,updated_by) SELECT ?,?,1,? WHERE EXISTS(SELECT 1 FROM creator_script_library WHERE id=? AND revision=?)').bind(slot,...args).run();
  else result=await env.DB.prepare('UPDATE core_script_registry SET payload_json=?,updated_by=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM creator_script_library WHERE id=? AND revision=?)').bind(args[0],user.id,slot,body.expectedCoreRevision,id,row.revision).run();
  if(!result.meta?.changes)fail('Script or active master changed. Reload before activating.',409);
  return json({ok:true,slot,revision:body.expectedCoreRevision+1},200,cors);
 }
 if(request.method==='POST')fail('Method not allowed',405);
 let next;
 if(request.method==='DELETE'){if(!row)fail('Script not found',404);next={...JSON.parse(row.payload_json),deleted:true};}
 else next=validateCreatorScript(body);
 // Source snapshots survive edits and removal. Activation never rewrites a draft.
 next.history=[...(row?JSON.parse(row.payload_json).history||[]:[]),...(row?[{...JSON.parse(row.payload_json),history:undefined,revision:row.revision}]:[])].slice(-30);
 const result=body.expectedRevision===0?await env.DB.prepare('INSERT OR IGNORE INTO creator_script_library(id,payload_json,revision,updated_by) VALUES(?,?,1,?)').bind(id,JSON.stringify(next),user.id).run():await env.DB.prepare('UPDATE creator_script_library SET payload_json=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?').bind(JSON.stringify(next),user.id,id,body.expectedRevision).run();
 if(!result.meta?.changes)fail('Script changed elsewhere. Your edits are preserved.',409);
 return json({script:{...next,id,revision:body.expectedRevision+1}},200,cors);
}
