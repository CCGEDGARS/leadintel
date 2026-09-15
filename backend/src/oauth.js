import {randomToken,sha256} from './security.js';

const encoder=new TextEncoder();
const decoder=new TextDecoder();

function b64urlEncodeBytes(bytes){
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
function b64urlDecodeBytes(value){
  const base=String(value||'').replaceAll('-','+').replaceAll('_','/');
  const padded=base+'='.repeat((4-base.length%4)%4);const binary=atob(padded);const out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;
}
function base64DecodeBytes(value){
  const binary=atob(String(value||''));const out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;
}

export function safeReturnUrl(value,configuredCustomerUrl){
  const configured=String(configuredCustomerUrl||'').split(',').map(v=>v.trim()).filter(Boolean);
  if(!configured.length)return '';
  let candidate;try{candidate=new URL(String(value||configured[0]));}catch{return '';}
  for(const allowed of configured){
    try{
      const base=new URL(allowed);const basePath=base.pathname.endsWith('/')?base.pathname:`${base.pathname}/`;
      const candidatePath=candidate.pathname.endsWith('/')?candidate.pathname:`${candidate.pathname}/`;
      if(candidate.origin===base.origin&&(candidate.pathname===base.pathname||candidatePath.startsWith(basePath)))return candidate.toString();
    }catch{}
  }
  return '';
}

export function buildGoogleAuthorizationUrl({clientId,redirectUri,state,scopes=[],accessType='',prompt='',loginHint=''}){
  if(!clientId||!redirectUri||!state)throw new Error('Google OAuth configuration is incomplete');
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',clientId);url.searchParams.set('redirect_uri',redirectUri);url.searchParams.set('response_type','code');url.searchParams.set('state',state);
  url.searchParams.set('scope',[...new Set(scopes.filter(Boolean))].join(' '));
  if(accessType)url.searchParams.set('access_type',accessType);if(prompt)url.searchParams.set('prompt',prompt);if(loginHint)url.searchParams.set('login_hint',loginHint);
  url.searchParams.set('include_granted_scopes','true');return url.toString();
}

export async function exchangeGoogleCode(code,{clientId,clientSecret,redirectUri},fetchImpl=fetch){
  if(!code)throw new Error('Missing Google authorization code');
  const body=new URLSearchParams({code,client_id:clientId||'',client_secret:clientSecret||'',redirect_uri:redirectUri||'',grant_type:'authorization_code'});
  const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.access_token)throw new Error(payload.error_description||payload.error||`Google token exchange failed (${response.status})`);
  return {accessToken:String(payload.access_token),refreshToken:payload.refresh_token?String(payload.refresh_token):'',expiresIn:Number(payload.expires_in)||0,scope:String(payload.scope||''),idToken:String(payload.id_token||'')};
}

export async function fetchGoogleIdentity(accessToken,fetchImpl=fetch){
  const response=await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${accessToken}`,'Accept':'application/json'}});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error_description||payload.error||`Google identity lookup failed (${response.status})`);
  const email=String(payload.email||'').trim().toLowerCase();if(!email||payload.email_verified!==true)throw new Error('Google account email must be verified');
  return {sub:String(payload.sub||''),email,name:String(payload.name||email.split('@')[0]),picture:String(payload.picture||''),emailVerified:true};
}

export async function importAesKey(base64Key){
  const raw=base64DecodeBytes(String(base64Key||''));if(raw.byteLength!==32)throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function encryptSecret(plaintext,key){
  if(!String(plaintext||''))throw new Error('Secret is required');const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(String(plaintext))));
  return JSON.stringify({v:1,iv:b64urlEncodeBytes(iv),ct:b64urlEncodeBytes(encrypted)});
}
export async function decryptSecret(envelope,key){
  let parsed;try{parsed=typeof envelope==='string'?JSON.parse(envelope):envelope;}catch{throw new Error('Encrypted secret is invalid');}
  if(parsed?.v!==1||!parsed.iv||!parsed.ct)throw new Error('Encrypted secret is invalid');
  try{return decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64urlDecodeBytes(parsed.iv)},key,b64urlDecodeBytes(parsed.ct)));}
  catch{throw new Error('Encrypted secret authentication failed');}
}

export async function createOAuthState(env,{purpose,userId=null,workspaceId=null,returnTo,codeVerifier=null}){
  if(!['login','gmail'].includes(purpose))throw new Error('Invalid OAuth purpose');
  const rawState=randomToken(32);const hash=await sha256(rawState);const safeReturn=safeReturnUrl(returnTo,env.CUSTOMER_APP_URL);if(!safeReturn)throw new Error('Invalid OAuth return URL');
  await env.DB.prepare(`INSERT INTO oauth_states(id_hash,purpose,user_id,workspace_id,return_to,pkce_verifier,expires_at) VALUES(?,?,?,?,?,?,datetime('now','+10 minutes'))`).bind(hash,purpose,userId,workspaceId,safeReturn,codeVerifier).run();
  return rawState;
}
export async function consumeOAuthState(env,{rawState,purpose}){
  if(!rawState)return null;const hash=await sha256(rawState);
  const row=await env.DB.prepare(`SELECT * FROM oauth_states WHERE id_hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>datetime('now')`).bind(hash,purpose).first();
  if(!row)return null;const result=await env.DB.prepare(`UPDATE oauth_states SET consumed_at=CURRENT_TIMESTAMP WHERE id_hash=? AND consumed_at IS NULL`).bind(hash).run();
  if(Number(result?.meta?.changes??1)<1)return null;return row;
}

export async function createPkcePair(){const verifier=randomToken(48);const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));return {verifier,challenge:b64urlEncodeBytes(digest)};}
export function buildMicrosoftAuthorizationUrl({clientId,redirectUri,state,scopes=[],loginHint='',prompt='',codeChallenge=''}){if(!clientId||!redirectUri||!state)throw new Error('Microsoft OAuth configuration is incomplete');const url=new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');url.searchParams.set('client_id',clientId);url.searchParams.set('redirect_uri',redirectUri);url.searchParams.set('response_type','code');url.searchParams.set('response_mode','query');url.searchParams.set('state',state);url.searchParams.set('scope',[...new Set(scopes.filter(Boolean))].join(' '));if(loginHint)url.searchParams.set('login_hint',loginHint);if(prompt)url.searchParams.set('prompt',prompt);if(codeChallenge){url.searchParams.set('code_challenge',codeChallenge);url.searchParams.set('code_challenge_method','S256');}return url.toString();}
export async function exchangeMicrosoftCode(code,{clientId,clientSecret,redirectUri,scopes=['openid','profile','email','offline_access'],codeVerifier=''},fetchImpl=fetch){if(!code)throw new Error('Missing Microsoft authorization code');const body=new URLSearchParams({code,client_id:clientId||'',client_secret:clientSecret||'',redirect_uri:redirectUri||'',grant_type:'authorization_code',scope:[...new Set(scopes.filter(Boolean))].join(' ')});if(codeVerifier)body.set('code_verifier',codeVerifier);const response=await fetchImpl('https://login.microsoftonline.com/common/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.access_token)throw new Error(payload.error_description||payload.error||`Microsoft token exchange failed (${response.status})`);return {accessToken:String(payload.access_token),refreshToken:payload.refresh_token?String(payload.refresh_token):'',expiresIn:Number(payload.expires_in)||0,scope:String(payload.scope||''),idToken:String(payload.id_token||'')};}
export async function fetchMicrosoftIdentity(accessToken,fetchImpl=fetch){const response=await fetchImpl('https://graph.microsoft.com/v1.0/me',{headers:{Authorization:`Bearer ${accessToken}`,'Accept':'application/json'}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error?.message||`Microsoft identity lookup failed (${response.status})`);const email=String(payload.mail||payload.userPrincipalName||'').trim().toLowerCase();if(!email)throw new Error('Microsoft account email is missing');return {sub:String(payload.id||''),email,name:String(payload.displayName||email.split('@')[0]),emailVerified:true};}

export const _encoding={b64urlEncodeBytes,b64urlDecodeBytes};
