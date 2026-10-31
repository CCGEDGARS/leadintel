(function(root){
 'use strict';
 function generalWritingContext({workspaceId,userId,language='en',refs}={}){
  const matching=Boolean(workspaceId&&refs?.workspaceId===workspaceId),revision=matching&&Number.isSafeInteger(refs.referenceRevision)?refs.referenceRevision:null;
  const sourceRefs=matching?(refs.sourceRefs||[]).map(ref=>({id:ref.id,revision:ref.revision})):[];
  const ready=sourceRefs.every(ref=>typeof ref.id==='string'&&Number.isSafeInteger(ref.revision)&&ref.revision>0&&(!refs.cards||refs.cards.some(card=>card.id===ref.id&&card.status==='Ready')));
  const context={writingContext:'general',channel:'general',language,currentDraft:{subject:'',message:''},maximumWords:null};
  return {scope:JSON.stringify([workspaceId||'',userId||'','general']),fingerprint:JSON.stringify(context),context,skillRefs:refs?.workspaceId===workspaceId?(refs.skillRefs||[]):[],sourceRefs,referenceRevision:revision,usable:Boolean(workspaceId&&userId&&revision!==null&&ready)};
 }
 function createWritingWorkspaceApi({workspaceId,fetchImpl=root.fetch?.bind(root)}={}){
  if(!workspaceId)throw Error('Sign in and choose a workspace.');
  async function request(path='',method='GET',body){
   const response=await fetchImpl('/api/writing-workspace'+path+'?workspace_id='+encodeURIComponent(workspaceId),{method,credentials:'include',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Your writing could not be saved. Your edits are preserved.');return result;
  }
  const valid=record=>record&&typeof record.id==='string'&&record.id&&Number.isSafeInteger(record.revision)&&record.revision>0&&['draft','template'].includes(record.kind)&&typeof record.title==='string'&&record.title.trim()&&record.title.length<=80&&typeof record.subject==='string'&&record.subject.length<=500&&typeof record.message==='string'&&record.message.trim()&&record.message.length<=12000&&(record.messageHtml===undefined||typeof record.messageHtml==='string'&&record.messageHtml.length<=80000);
  const invalid=()=>{throw Error('Writing save response is invalid. Your edits are preserved; reload the library before retrying.');};
  return {list:async()=>{const records=(await request())?.records;if(!Array.isArray(records)||records.length>60||records.some(record=>!valid(record))||new Set(records.map(record=>record.id)).size!==records.length)invalid();return records;},save:async(id,payload)=>{const record=(await request('/'+encodeURIComponent(id),'PUT',payload))?.record;if(!valid(record)||record.id!==id||record.revision!==payload.expectedRevision+1||record.kind!==payload.kind||record.title!==payload.title.trim()||record.subject!==(payload.subject||'')||record.message!==payload.message||(record.messageHtml||'')!==(payload.messageHtml||'')||JSON.stringify(record.writingAssistant||null)!==JSON.stringify(payload.writingAssistant||null))invalid();return record;}};
 }
 const api={generalWritingContext,createWritingWorkspaceApi};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelWritingWorkspace=api;
})(typeof window==='object'?window:globalThis);
