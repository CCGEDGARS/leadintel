(function(root){
 'use strict';
 function createWritingAssistant({capture,request,apply,onChange=()=>{}}){
  let alive=true,owner=0,controller=null,timer=null,scope=null,baseline='',busy=false,applying=false,error='',preview=null,stale=false,messages=[];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const stamp=c=>JSON.stringify([c.fingerprint,c.referenceRevision,c.sourceRefs||[]]);
  function state(){return clone({busy,applying,error,preview,stale,messages});}
  function changed(){if(alive)onChange(state());}
  function stop(){owner++;controller?.abort();controller=null;clearTimeout(timer);timer=null;busy=false;applying=false;}
  function syncContext(){if(!alive)return;const c=capture();if(scope!==c.scope){stop();scope=c.scope;preview=null;messages=[];stale=false;error='';baseline=stamp(c);changed();}else if(baseline!==stamp(c)){if(!applying)stop();stale=Boolean(preview);error=stale?'Context changed. Discard this proposal and ask again.':'';if(!preview)baseline=stamp(c);changed();}return c;}
  async function ask(instruction){if(!alive||busy)return false;const c=syncContext();if(!c?.usable){error='Choose a confirmed buyer and finish pending message operations first.';changed();return false;}if(typeof instruction!=='string'||!instruction.trim()||instruction.length>4000){error='Enter a question of up to 4,000 characters.';changed();return false;}
   preview=null;stale=false;error='';baseline=stamp(c);const token=++owner,capturedScope=c.scope;controller=new AbortController();const signal=controller.signal;busy=true;changed();
   const history=messages.map(m=>({role:m.role,content:m.content})).slice(-10);while(history.reduce((n,m)=>n+m.content.length,0)>12000)history.shift();
   try{
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(Object.assign(Error('Writing request timed out. Your draft is preserved.'),{name:'AbortError'}));},60000);});
    const result=await Promise.race([request({instruction:instruction.trim(),history,context:clone(c.context),sourceRefs:clone(c.sourceRefs||[])},{signal,scope:c.scope}),deadline]);
    if(!alive||token!==owner)return false;const current=capture();if(capturedScope!==current.scope||baseline!==stamp(current)||!current.usable){error='Context or draft changed. Your message is preserved; ask again.';changed();return false;}
    if(!result||typeof result.reply!=='string'||result.provenance?.referenceRevision!==c.referenceRevision)throw Error('Writing response is invalid or sources changed. Ask again.');
    messages.push({role:'user',content:instruction.trim()},{role:'assistant',content:result.reply,citations:result.citations||[],warnings:result.warnings||[]});messages=messages.slice(-20);
    if(result.draft)preview=clone({draft:result.draft,provenance:result.provenance,citations:result.citations||[],warnings:result.warnings||[]});return true;
   }catch(cause){if(alive&&token===owner)error=cause.name==='AbortError'?'Writing request timed out or cancelled. Your draft is preserved.':cause.message||'Writing request failed. Your draft is preserved.';return false;}
   finally{if(alive&&token===owner){clearTimeout(timer);timer=null;controller=null;busy=false;changed();}}
  }
  async function applyPreview(){if(!alive||busy||!preview)return false;const c=syncContext();if(stale||!c?.usable||baseline!==stamp(c))return false;const token=++owner;busy=true;applying=true;changed();try{const accepted=await apply(clone(preview));if(token!==owner||accepted===false)return false;preview=null;stale=false;baseline=stamp(capture());error='Applied as an edited draft. Review, then Save.';return true;}catch(cause){if(token===owner)error=cause.message;return false;}finally{if(token===owner){applying=false;busy=false;changed();}}}
  function discardPreview(){preview=null;stale=false;error='';baseline=stamp(capture());changed();}
  function cancel(){stop();error='Cancelled. Your draft is preserved.';changed();}
  function destroy(){stop();alive=false;preview=null;messages=[];}
  return {state,ask,applyPreview,discardPreview,syncContext,cancel,destroy};
 }
 const api={createWritingAssistant};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelWritingAssistant=api;
})(typeof window==='object'?window:globalThis);
