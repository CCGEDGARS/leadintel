import {resolveWorkspaceServiceCredential} from './service-integrations.js';
// Mailbox validity is separate from CRM identity verification. Both must pass.
export async function verifyAutomaticEmail(env,workspaceId,email,{fetcher=fetch,resolveCredential=resolveWorkspaceServiceCredential}={}){
  const address=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))return {verified:false,status:'not_found',reason:'Email not found'};
  try{
    const credential=await resolveCredential(env,workspaceId,'hunter');
    if(credential.source!=='customer'||!credential.apiKey)return {verified:false,status:'needs_review',reason:'Connect Hunter in Settings for mandatory automatic email verification'};
    const response=await fetcher(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(address)}`,{headers:{Accept:'application/json','X-API-KEY':credential.apiKey},signal:AbortSignal.timeout(20000)});
    if(!response.ok||response.status===202)return {verified:false,status:'needs_review',reason:'Email verification unavailable or pending. Review the provider connection and credits.'};
    const data=(await response.json()).data||{};
    const verified=String(data.email||'').toLowerCase()===address&&data.status==='valid'&&!data.accept_all&&!data.block;
    return {verified,status:verified?'verified':'needs_review',reason:verified?'':'Email verification failed or was inconclusive',provider:'Hunter'};
  }catch{return {verified:false,status:'needs_review',reason:'Email verification unavailable. Retry after reviewing the provider connection.'};}
}
