const encoder=new TextEncoder();
const decoder=new TextDecoder();
const REPLY_CATEGORIES=new Set(['meeting_request','positive','objection','not_now','referral','unsubscribe','out_of_office','neutral']);

function bytesToBase64(bytes){let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}
function base64ToBytes(value){const binary=atob(value);const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
export function base64UrlEncode(value){return bytesToBase64(encoder.encode(String(value??''))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function base64UrlDecode(value){const base=String(value||'').replaceAll('-','+').replaceAll('_','/');const padded=base+'='.repeat((4-base.length%4)%4);return decoder.decode(base64ToBytes(padded));}
export function normalizeEmail(value){const raw=String(value??'').trim().toLowerCase();if(!raw||/[\r\n]/.test(raw)||raw.length>254)return '';return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)?raw:'';}
function safeHeader(value,max=500){const text=String(value??'').replace(/[\r\n]+/g,' ').trim();return text.slice(0,max);}
function encodeHeader(value){const bytes=encoder.encode(safeHeader(value,998));return `=?UTF-8?B?${bytesToBase64(bytes)}?=`;}
function crlf(value){return String(value??'').replace(/\r\n|\r|\n/g,'\r\n');}

export function buildMimeMessage({from='',to,subject,body}){
  const recipient=normalizeEmail(to);if(!recipient)throw new Error('Valid recipient email is required');
  const sender=from?normalizeEmail(from):'';if(from&&!sender)throw new Error('Valid sender email is required');
  const cleanSubject=safeHeader(subject,500);if(!cleanSubject)throw new Error('Email subject is required');
  const cleanBody=String(body??'').trim();if(!cleanBody)throw new Error('Email body is required');if(cleanBody.length>100000)throw new Error('Email body is too large');
  const headers=[];if(sender)headers.push(`From: ${sender}`);headers.push(`To: ${recipient}`,`Subject: ${encodeHeader(cleanSubject)}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit');
  return `${headers.join('\r\n')}\r\n\r\n${crlf(cleanBody)}`;
}

export async function refreshGoogleAccessToken(refreshToken,{clientId,clientSecret},fetchImpl=fetch){
  if(!refreshToken)throw new Error('Gmail refresh token is missing');
  const body=new URLSearchParams({client_id:clientId||'',client_secret:clientSecret||'',refresh_token:refreshToken,grant_type:'refresh_token'});
  const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload.access_token)throw new Error(payload.error_description||payload.error||`Google token refresh failed (${response.status})`);
  return {accessToken:String(payload.access_token),expiresIn:Number(payload.expires_in)||0,scope:String(payload.scope||'')};
}
export async function sendGmailMessage(accessToken,message,fetchImpl=fetch){
  if(!accessToken)throw new Error('Gmail access token is required');const raw=base64UrlEncode(message);
  const response=await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({raw})});
  const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.id)throw new Error(payload.error?.message||`Gmail send failed (${response.status})`);
  return {id:String(payload.id),threadId:String(payload.threadId||payload.id),labelIds:Array.isArray(payload.labelIds)?payload.labelIds:[]};
}
export async function fetchGmailThread(accessToken,threadId,fetchImpl=fetch){
  if(!accessToken||!threadId)throw new Error('Gmail access token and thread id are required');
  const url=`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`;
  const response=await fetchImpl(url,{headers:{Authorization:`Bearer ${accessToken}`,'Accept':'application/json'}});const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error?.message||`Gmail thread fetch failed (${response.status})`);return payload;
}
function header(message,name){const headers=message?.payload?.headers||[];return String(headers.find(item=>String(item?.name||'').toLowerCase()===name.toLowerCase())?.value||'');}
function senderEmail(message){const raw=header(message,'From');const angle=raw.match(/<([^>]+)>/);return normalizeEmail(angle?angle[1]:raw.replace(/^.*?\s+/,'').replace(/[<>]/g,''))||normalizeEmail(raw);}
function decodeBodyData(data){if(!data)return '';try{return base64UrlDecode(data);}catch{return '';}}
function stripHtml(value){return String(value||'').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
export function extractMessageText(message){
  const payload=message?.payload||{};const direct=decodeBodyData(payload.body?.data);if(direct)return payload.mimeType==='text/html'?stripHtml(direct):direct.trim();
  const parts=[];const walk=part=>{if(!part)return;const data=decodeBodyData(part.body?.data);if(data)parts.push({mime:String(part.mimeType||''),text:data});for(const child of part.parts||[])walk(child);};walk(payload);
  const plain=parts.find(item=>item.mime.startsWith('text/plain'));if(plain)return plain.text.trim();const html=parts.find(item=>item.mime.startsWith('text/html'));return html?stripHtml(html.text):'';
}
export function classifyReply(text){
  const value=String(text||'').toLowerCase().replace(/\s+/g,' ').trim();if(!value)return 'neutral';
  if(/out of office|automatic reply|auto-reply|away from the office|vacation reply/.test(value))return 'out_of_office';
  if(/unsubscribe|remove me|do not contact|don't contact|stop emailing/.test(value))return 'unsubscribe';
  if(/talk to|contact|reach out to|cc(?:'d)?|colleague|better person|responsible for/.test(value)&&/(instead|please|should|is our|would be)/.test(value))return 'referral';
  if(/not now|later this year|next quarter|next year|circle back|come back|reach out again|too early/.test(value))return 'not_now';
  if(/calendar|schedule|meeting|call|teams|zoom|available|availability|book a time|let's talk|lets talk/.test(value)&&/(yes|sure|happy|can|could|let's|lets|available|schedule|meeting|call)/.test(value))return 'meeting_request';
  if(/not interested|already have|existing supplier|too expensive|no budget|not relevant|doesn't fit|does not fit|why would|concern/.test(value))return 'objection';
  if(/interested|sounds good|tell me more|send more|please share|worth exploring|happy to discuss|makes sense/.test(value))return 'positive';
  return 'neutral';
}
export function normalizeInboundReplies(thread,{sentMessageId,sentAt,connectedEmail}){
  const sentTime=new Date(sentAt||0).getTime();const own=normalizeEmail(connectedEmail);const out=[];
  for(const message of thread?.messages||[]){
    if(String(message?.id||'')===String(sentMessageId||''))continue;const received=Number(message?.internalDate)||new Date(header(message,'Date')||0).getTime();if(!Number.isFinite(received)||received<=sentTime)continue;
    const sender=senderEmail(message);if(!sender||sender===own)continue;const text=extractMessageText(message).slice(0,20000);if(!text)continue;
    out.push({gmailMessageId:String(message.id||''),gmailThreadId:String(message.threadId||thread?.id||''),senderEmail:sender,receivedAt:new Date(received).toISOString(),bodyText:text,category:REPLY_CATEGORIES.has(classifyReply(text))?classifyReply(text):'neutral'});
  }
  return out.sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt));
}
