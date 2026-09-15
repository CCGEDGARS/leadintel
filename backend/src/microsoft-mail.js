import {normalizeEmail} from './gmail.js';

export async function refreshMicrosoftAccessToken(refreshToken,{clientId,clientSecret,scopes=[]},fetchImpl=fetch){
  if(!refreshToken)throw new Error('Microsoft mail refresh token is missing');
  const body=new URLSearchParams({client_id:clientId||'',client_secret:clientSecret||'',refresh_token:refreshToken,grant_type:'refresh_token',scope:[...new Set(scopes.filter(Boolean))].join(' ')});
  const response=await fetchImpl('https://login.microsoftonline.com/common/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload.access_token)throw new Error(payload.error_description||payload.error||`Microsoft token refresh failed (${response.status})`);
  return {accessToken:String(payload.access_token),refreshToken:payload.refresh_token?String(payload.refresh_token):refreshToken,expiresIn:Number(payload.expires_in)||0,scope:String(payload.scope||'')};
}

export async function sendMicrosoftMessage(accessToken,{to,subject,body},fetchImpl=fetch){
  if(!accessToken)throw new Error('Microsoft mail access token is required');
  const recipient=normalizeEmail(to);if(!recipient)throw new Error('Valid recipient email is required');
  const cleanSubject=String(subject??'').trim();if(!cleanSubject)throw new Error('Email subject is required');if(cleanSubject.length>500)throw new Error('Email subject is too large');
  const cleanBody=String(body??'').trim();if(!cleanBody)throw new Error('Email body is required');if(cleanBody.length>100000)throw new Error('Email body is too large');
  const payload={message:{subject:cleanSubject,body:{contentType:'Text',content:cleanBody},toRecipients:[{emailAddress:{address:recipient}}]},saveToSentItems:true};
  const response=await fetchImpl('https://graph.microsoft.com/v1.0/me/sendMail',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
  if(response.status!==202){const failure=await response.json().catch(()=>({}));throw new Error(failure.error?.message||`Microsoft send failed (${response.status})`);}
  return {accepted:true,status:202};
}
