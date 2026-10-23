(function(root){
 'use strict';
 function generalWritingContext({workspaceId,userId,language='en',refs}={}){
  const matching=Boolean(workspaceId&&refs?.workspaceId===workspaceId),revision=matching&&Number.isSafeInteger(refs.referenceRevision)?refs.referenceRevision:null;
  const sourceRefs=matching?(refs.sourceRefs||[]).map(ref=>({id:ref.id,revision:ref.revision})):[];
  const ready=sourceRefs.every(ref=>typeof ref.id==='string'&&Number.isSafeInteger(ref.revision)&&ref.revision>0&&(!refs.cards||refs.cards.some(card=>card.id===ref.id&&card.status==='Ready')));
  const context={writingContext:'general',channel:'general',language,currentDraft:{subject:'',message:''},maximumWords:null};
  return {scope:JSON.stringify([workspaceId||'',userId||'','general']),fingerprint:JSON.stringify(context),context,sourceRefs,referenceRevision:revision,usable:Boolean(workspaceId&&userId&&revision!==null&&ready)};
 }
 function createWritingWorkspaceApi({workspaceId,fetchImpl=root.fetch?.bind(root)}={}){
  if(!workspaceId)throw Error('Sign in and choose a workspace.');
  async function request(path='',method='GET',body){
   const response=await fetchImpl('/api/writing-workspace'+path+'?workspace_id='+encodeURIComponent(workspaceId),{method,credentials:'include',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Your writing could not be saved. Your edits are preserved.');return result;
  }
  return {list:async()=>(await request()).records,save:async(id,payload)=>(await request('/'+encodeURIComponent(id),'PUT',payload)).record};
 }
 const api={generalWritingContext,createWritingWorkspaceApi};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelWritingWorkspace=api;
})(typeof window==='object'?window:globalThis);
