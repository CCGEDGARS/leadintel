(function(root){
 'use strict';
 const Rich=()=>typeof module==='object'&&module.exports?require('./rich-text.js'):globalThis.LeadIntelRichText;
 function browserSessions(){
  const key='leadintel_writing_sessions_v1';
  const usable=()=>root.LeadIntelAccountCache?.current?.()!==false;
  const read=()=>{if(!usable())return [];try{const value=JSON.parse(root.localStorage?.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
  return {load:scope=>read().find(row=>row.scope===scope)?.value,save(scope,value){if(!usable()||!root.localStorage)return false;const rows=read().filter(row=>row.scope!==scope);const messages=value.messages.slice(-20);while(JSON.stringify(messages).length>20000)messages.shift();rows.push({scope,value:{messages,instruction:value.instruction,workbench:value.workbench}});root.localStorage?.setItem(key,JSON.stringify(rows.slice(-6)));}};
 }
 function createWritingAssistant({capture,request,apply,onChange=()=>{},sessionStore=browserSessions(),workbench=false,validatePreview=async()=>{}}){
  let alive=true,owner=0,controller=null,timer=null,scope=null,baseline='',busy=false,applying=false,error='',preview=null,stale=false,messages=[],instruction='',working=null,original=null,undo=[],redo=[],workingStyle='',localPersisted=false,upstream=null,incomingDraft=null,workingAssistant=null;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const workingVersion=()=>({draft:clone(working),assistant:clone(workingAssistant)});
  const sourceKey=c=>JSON.stringify([c.referenceRevision,c.sourceRefs||[],c.skillRefs||[]]);
  const sourceDraft=c=>({draft:clone(c.context.currentDraft),style:c.context.style||'',mode:c.context.mode||'',stage:c.context.inmailStage||''});
  const stamp=c=>JSON.stringify([c.scope,c.fingerprint,c.referenceRevision,c.sourceRefs||[],c.skillRefs||[],...(workbench?[working,workingStyle]:[])]);
  const sameDraft=(a,b)=>a?.subject===b?.subject&&a?.message===b?.message&&(a?.messageHtml||'')===(b?.messageHtml||'');
  function requestContext(c){const context=clone(c.context);if(workbench){context.currentDraft=clone(working);context.maximumWords=null;if(workingStyle)context.style=workingStyle;}return context;}
  function setDraft(draft,{load=false,style='',assistant=null}={}){if(!workbench||busy)return false;const previousScope=scope;syncContext();if(previousScope&&scope!==previousScope)return false;if(!draft||typeof draft.subject!=='string'||typeof draft.message!=='string'||draft.subject.length>500||draft.message.length>12000)return false;const unchanged=JSON.stringify(working)===JSON.stringify(draft);if(!unchanged){undo.push(workingVersion());undo=undo.slice(-40);redo=[];}working=clone(draft);if(load)workingAssistant=clone(assistant);else if(!unchanged)workingAssistant=null;if(load){original=clone(draft);workingStyle=style||capture().context.style||'';undo=[];redo=[];upstream=sourceDraft(capture());incomingDraft=null;}preview=null;stale=false;error='';baseline=stamp(capture());changed();return true;}
  function undoDraft(){if(!workbench||busy)return false;syncContext();if(!undo.length)return false;redo.push(workingVersion());redo=redo.slice(-40);const previous=undo.pop();working=previous.draft;workingAssistant=previous.assistant;preview=null;stale=false;baseline=stamp(capture());changed();return true;}
  function redoDraft(){if(!workbench||busy)return false;syncContext();if(!redo.length)return false;undo.push(workingVersion());undo=undo.slice(-40);const next=redo.pop();working=next.draft;workingAssistant=next.assistant;preview=null;stale=false;baseline=stamp(capture());changed();return true;}
  function restoreOriginal(){syncContext();return original&&setDraft(original);}
  const actions={shorten:'Propose a shorter complete version of the working draft. Remove repetition while preserving supported meaning, identity, links and the ask.',persuade:'Propose a stronger complete version of the working draft. Improve opening, relevance, value and call to action without inventing facts or pressure.',personalize:'Propose a complete version tailored to the selected recipient and company using only the supplied supported research. Treat example names and claims in a loaded script as placeholders to adapt, not evidence.'};
  function action(kind,extra=''){if(kind==='personalize'&&capture()?.context?.writingContext==='general'&&!String(extra).trim()){error='Describe the audience or person in your instruction before personalizing general writing.';changed();return Promise.resolve(false);}if(!actions[kind])return Promise.resolve(false);return ask(actions[kind]+' Apply relevant techniques from the active source only where they help this action. Explain what changed and cite the supplied source when used. '+String(extra).slice(0,3000),{actionKind:kind,intent:'preview'});}

  function state(){return clone({busy,applying,error,preview,stale,messages,instruction,scope,...(workbench?{working,original,canUndo:undo.length>0,canRedo:redo.length>0,workingStyle,localPersisted,incomingDraft,workingAssistant}:{} )});}
  function persist(){if(!scope||!sessionStore)return;try{localPersisted=sessionStore.save(scope,{messages:messages.slice(-20),instruction,...(workbench?{workbench:{working,original,undo:undo.slice(-5),workingStyle,upstream,workingAssistant}}:{})})!==false;}catch{localPersisted=false;}}
  function restore(){messages=[];instruction='';working=null;original=null;undo=[];redo=[];workingStyle='';upstream=null;incomingDraft=null;workingAssistant=null;try{const saved=sessionStore?.load(scope);if(!saved)return;messages=(Array.isArray(saved.messages)?saved.messages:[]).filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-20).map(m=>({role:m.role,content:m.content.slice(0,12000),sourceKey:typeof m.sourceKey==='string'?m.sourceKey:'',citations:(Array.isArray(m.citations)?m.citations:[]).filter(c=>c&&typeof c.filename==='string'&&typeof c.location==='string').slice(0,8).map(c=>({filename:c.filename.slice(0,256),location:c.location.slice(0,80),role:String(c.role||'guidance').slice(0,30)})),warnings:(Array.isArray(m.warnings)?m.warnings:[]).filter(w=>typeof w==='string').slice(0,8).map(w=>w.slice(0,500))}));instruction=typeof saved.instruction==='string'?saved.instruction.slice(0,4000):'';if(workbench){const valid=d=>d&&typeof d.subject==='string'&&d.subject.length<=500&&typeof d.message==='string'&&d.message.length<=12000;if(valid(saved.workbench?.working)){working=clone(saved.workbench.working);original=valid(saved.workbench.original)?clone(saved.workbench.original):clone(working);workingAssistant=saved.workbench.workingAssistant||null;undo=(saved.workbench.undo||[]).map(row=>valid(row)?{draft:row,assistant:null}:row).filter(row=>valid(row?.draft)).map(row=>({draft:row.draft,assistant:row.assistant||null})).slice(-5);workingStyle=String(saved.workbench.workingStyle||'');upstream=saved.workbench.upstream||null;}}}catch{}}
  function setInstruction(value){instruction=String(value||'').slice(0,4000);persist();}
  function changed(){if(alive){persist();onChange(state());}}
  function stop(){owner++;controller?.abort();controller=null;clearTimeout(timer);timer=null;busy=false;applying=false;}
  function reconcileDraft(c){
   if(!workbench)return false;const next=sourceDraft(c);
   if(!working){working=clone(next.draft);workingAssistant=clone(c.draftAssistant||null);original=clone(working);workingStyle=next.style;upstream=next;incomingDraft=null;return true;}
   if(JSON.stringify(upstream)===JSON.stringify(next)){incomingDraft=null;return false;}
   const matchesCurrent=JSON.stringify(working)===JSON.stringify(next.draft);
   if((upstream&&JSON.stringify(working)===JSON.stringify(upstream.draft)&&(!workingStyle||workingStyle===upstream.style))||(!upstream&&matchesCurrent)){
    working=clone(next.draft);workingAssistant=clone(c.draftAssistant||null);original=clone(working);workingStyle=next.style;undo=[];redo=[];upstream=next;incomingDraft=null;return true;
   }
   if(matchesCurrent){upstream=next;incomingDraft=null;return true;}
   if(JSON.stringify(incomingDraft)!==JSON.stringify(next)){incomingDraft=next;return true;}return false;
  }
  function loadCurrentDraft(){if(!workbench||busy)return false;const c=syncContext(),next=sourceDraft(c);undo.push(workingVersion());undo=undo.slice(-40);redo=[];working=clone(next.draft);workingAssistant=clone(c.draftAssistant||null);original=clone(working);workingStyle=next.style;upstream=next;incomingDraft=null;preview=null;stale=false;error='Current Step 6 script loaded. Previous assistant edits are available with Undo.';baseline=stamp(c);changed();return true;}
  function keepWorkingDraft(){if(!workbench||busy)return false;const c=syncContext();upstream=sourceDraft(c);incomingDraft=null;preview=null;stale=false;baseline=stamp(c);error='Keeping your assistant working copy.';changed();return true;}
  function syncContext(){if(!alive)return;const c=capture();if(scope!==c.scope){persist();stop();scope=c.scope;preview=null;restore();if(c.context?.writingContext){messages=[];instruction='';}reconcileDraft(c);stale=false;error='';baseline=stamp(c);changed();}else{const draftChanged=reconcileDraft(c);if(draftChanged||baseline!==stamp(c)){if(!applying)stop();stale=Boolean(preview);error=stale?'Context changed. Discard this proposal and ask again.':'';if(!preview)baseline=stamp(c);changed();}}return c;}
  function contextKey(){const c=syncContext();return c?JSON.stringify([c.scope,stamp(c)]):null;}
  async function ask(instruction,{actionKind,intent,preferredLength,storyselling,writingOnly=false,bookOnly=false}={}){if(!alive||busy)return false;const c=syncContext();if(incomingDraft){error='The Step 6 script changed. Load current script or keep your assistant copy before continuing.';changed();return false;}if(!c?.usable){error='Choose a confirmed buyer and finish pending message operations first.';changed();return false;}if(typeof instruction!=='string'||!instruction.trim()||instruction.length>4000){error='Enter a question of up to 4,000 characters.';changed();return false;}
   preview=null;stale=false;error='';baseline=stamp(c);const token=++owner,capturedScope=c.scope;controller=new AbortController();const signal=controller.signal;busy=true;changed();
   const requestSources={...c,sourceRefs:writingOnly?[]:c.sourceRefs,skillRefs:bookOnly?[]:c.skillRefs};
   const history=messages.filter(m=>m.sourceKey===sourceKey(requestSources)).map(m=>({role:m.role,content:m.content})).slice(-10);while(history.reduce((n,m)=>n+m.content.length,0)>12000)history.shift();
   try{
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(Object.assign(Error('Writing request timed out. Your draft is preserved.'),{name:'AbortError'}));},60000);});
    const result=await Promise.race([request({instruction:instruction.trim(),history,context:requestContext(c),sourceRefs:clone(requestSources.sourceRefs||[]),sourceSelection:'session',skillRefs:clone(requestSources.skillRefs||[]),...(intent?{intent}:{}),...(storyselling?{storyselling}:{}),...(intent==='preview'&&['short','standard','detailed'].includes(preferredLength)?{preferredLength}:{})},{signal,scope:c.scope}),deadline]);
    if(!alive||token!==owner)return false;const current=capture();if(capturedScope!==current.scope||baseline!==stamp(current)||!current.usable){error='Context or draft changed. Your message is preserved; ask again.';changed();return false;}
    const validDraft=d=>d&&!Array.isArray(d)&&typeof d.subject==='string'&&d.subject.length<=500&&typeof d.message==='string'&&d.message.trim()&&d.message.length<=12000&&(d.messageHtml===undefined||typeof d.messageHtml==='string'&&d.messageHtml.length<=80000);
    const validList=(value,check)=>value===undefined||Array.isArray(value)&&value.length<=32&&value.every(check);
    if(!result||typeof result.reply!=='string'||result.reply.length>12000||result.provenance?.referenceRevision!==c.referenceRevision||result.draft!=null&&!validDraft(result.draft)||!validList(result.citations,row=>row&&typeof row.filename==='string'&&typeof row.location==='string')||!validList(result.warnings,row=>typeof row==='string')||!validList(result.skills_used,row=>row&&typeof row.title==='string'))throw Error('Writing response is invalid or sources changed. Ask again.');
    if(result.draft&&actionKind){const source=requestContext(c).currentDraft,words=value=>String(value||'').trim().split(/\s+/).filter(Boolean).length;if(actionKind==='shorten'&&words(result.draft.message)>=words(source.message))throw Error('The proposal is not shorter. Your draft is unchanged; try a more specific instruction.');if(result.draft.subject===source.subject&&result.draft.message===source.message)throw Error('The proposal did not change your draft. Try a more specific instruction.');}
    const formattingSource=requestContext(c).currentDraft;
    if(result.draft?.messageHtml)result.draft.messageHtml=Rich()?.validateDraftHtml(result.draft.message,result.draft.messageHtml,formattingSource?.messageHtml,formattingSource?.message);
    if(result.draft&&!result.draft.messageHtml&&formattingSource?.messageHtml){const kept=Rich()?.carry(formattingSource.messageHtml,formattingSource.message,result.draft.message);if(kept)result.draft.messageHtml=kept;}
    if(result.draft&&intent!=='advice'){
     const source=requestContext(c).currentDraft,rich=Rich(),hrefs=html=>[...String(rich?.sanitize(html)||'').matchAll(/href="([^"]*)"/g)].map(match=>rich.safeLink(match[1]));
     const retained=new Set([...hrefs(result.draft.messageHtml),...(result.draft.message.match(/https?:\/\/[^\s<>"\])]+/g)||[]).map(url=>rich?.safeLink(url.replace(/[.,;!?]+$/,'')))]);
     if(hrefs(source?.messageHtml).some(url=>!retained.has(url)))throw Error('Writing Assistant omitted an existing link. Your draft is preserved.');
     preview=clone({draft:result.draft,provenance:result.provenance,citations:result.citations||[],warnings:result.warnings||[]});
    }
    messages.push({role:'user',content:instruction.trim(),sourceKey:sourceKey(requestSources)},{role:'assistant',content:result.reply,sourceKey:sourceKey(requestSources),citations:result.citations||[],warnings:[...(result.warnings||[]),...(result.skills_used?.length?['Skills used: '+result.skills_used.map(s=>s.title).join(', ')]:[])]});messages=messages.slice(-20);return true;
   }catch(cause){if(alive&&token===owner)error=cause.name==='AbortError'?'Writing request timed out or cancelled. Your draft is preserved.':cause.message||'Writing request failed. Your draft is preserved.';return false;}
   finally{if(alive&&token===owner){clearTimeout(timer);timer=null;controller=null;busy=false;changed();}}
  }
  async function applyPreview(){if(!alive||busy||!preview)return false;const c=syncContext();if(!preview||stale||!c?.usable||baseline!==stamp(c))return false;const token=++owner,proposal=clone(preview),applyStamp=stamp(c);busy=true;applying=true;changed();try{if(workbench){await validatePreview(clone(proposal),requestContext(c));if(token!==owner||applyStamp!==stamp(capture())||!capture().usable)throw Error('Context changed. Your draft is preserved.');}const accepted=workbench?(undo.push(workingVersion()),undo=undo.slice(-40),redo=[],working=clone(proposal.draft),workingAssistant=clone({...proposal.provenance,citations:proposal.citations||[],appliedAt:new Date().toISOString()}),true):await apply(clone(proposal));if(token!==owner||accepted===false)return false;preview=null;stale=false;baseline=stamp(capture());error='Revised · Not saved. Review your draft or Undo, then Continue.';return true;}catch(cause){if(token===owner)error=cause.message;return false;}finally{if(token===owner){applying=false;busy=false;changed();}}}
  function previewChanges(value='',options={}){const content=String(value||'').trim();return ask(content||(working?.message?.trim()?'Improve the clarity and structure of this draft. Preserve its meaning.':''),{intent:'preview',preferredLength:options.preferredLength});}
  async function improveDraft(value=''){
   if(!alive||busy||!workbench)return false;syncContext();
   const content=String(value||'').trim();
   if(!content&&!working?.message?.trim()){error='Describe what you would like to create first.';changed();return false;}
   const key=contextKey();
   const accepted=await ask(content||'Improve this working draft using the selected skills where relevant. Preserve facts, meaning, identities and links. Avoid cosmetic changes or unnecessary rewrites; if no useful improvement is needed, explain that and return no draft.',{intent:'preview',writingOnly:true});
   if(!accepted||!alive||key!==contextKey())return false;
   if(!preview)return true;
   if(sameDraft(preview.draft,working)){preview=null;error='No useful changes suggested. Your draft is unchanged.';changed();return true;}
   const applied=await applyPreview();
   if(!applied&&preview){preview=null;changed();}
   return applied;
  }
  function startContext(draft){stop();syncContext();messages=[];instruction='';preview=null;stale=false;error='';if(draft)setDraft(draft,{load:true,style:capture()?.context?.writingContext==='general'?'original':''});baseline=stamp(capture());changed();return true;}
  function closeSession(){stop();preview=null;stale=false;error='';baseline=stamp(capture());changed();}
  function discardPreview(){if(busy)return false;preview=null;stale=false;error='';baseline=stamp(capture());changed();}
  function cancel(){stop();error='Cancelled. Your draft is preserved.';changed();}
  function destroy(){persist();stop();alive=false;preview=null;messages=[];}
  return {state,contextKey,ask,applyPreview,discardPreview,syncContext,cancel,destroy,setInstruction,setDraft,undoDraft,redoDraft,restoreOriginal,loadCurrentDraft,keepWorkingDraft,action,previewChanges,improveDraft,startContext,closeSession};
 }
 const api={createWritingAssistant};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelWritingAssistant=api;
})(typeof window==='object'?window:globalThis);
