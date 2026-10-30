(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelQualificationDisplay=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const pending=()=>({pending:true,eligible:false,checked:false,automaticEligible:false,score:null,companyScore:null,buyerFitPoints:0,signalPoints:0,lookalikeScore:null,matchedSignals:[],evidenceSources:0,gaps:['Checking saved company evidence'],automaticGaps:['Checking saved company evidence'],confidence:'Pending'});
  async function chunked(batch){
    const results=[];
    for(const row of batch.rows){
      await new Promise(resolve=>setTimeout(resolve,0));
      try{results.push({id:row.id,result:root.LeadIntelDiscovery.assessCompanyQualification(row.candidate,batch.profile,batch.market,row.settings)});}
      catch{results.push({id:row.id,result:{...pending(),pending:false,gaps:['Company check unavailable. Reopen Companies to retry.']}});}
    }
    return results;
  }
  function requestWorker(batch){
    if(typeof root.Worker!=='function')return chunked(batch);
    return new Promise(resolve=>{
      let worker,timer,finished=false;
      const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);worker?.terminate();resolve(result);};
      const fallback=()=>{if(finished)return;finished=true;clearTimeout(timer);worker?.terminate();resolve(chunked(batch));};
      try{
        worker=new root.Worker('qualification-worker.js?v=20261020-v1&strategy-audit=20261030-v1');
        worker.onmessage=event=>Array.isArray(event.data?.results)?finish(event.data.results):fallback();
        worker.onerror=fallback;
        timer=setTimeout(fallback,15000);
        worker.postMessage(batch);
      }catch{fallback();}
    });
  }
  function create({request=requestWorker,onUpdate=()=>{},now=Date.now}={}){
    let context=null,generation=0,timer=null,nextId=0;
    const entries=new Map(),queued=new Map();
    function activate(value){if(context===value)return;context=value;generation++;entries.clear();queued.clear();}
    async function flush(){
      timer=null;const current=generation,active=context,rows=[...queued.values()];queued.clear();if(!rows.length)return;
      let results;
      try{results=await request({profile:active.profile,market:active.market,rows:rows.map(({id,candidate,settings})=>({id,candidate,settings}))});}
      catch{results=rows.map(row=>({id:row.id,result:{...pending(),pending:false,gaps:['Company check unavailable. Reopen Companies to retry.']}}));}
      if(generation!==current)return;
      const byId=new Map(results.map(row=>[row.id,row.result]));
      for(const row of rows){const entry=entries.get(row.key);if(entry?.id!==row.id)continue;const result=byId.get(row.id);entry.result=result||{...pending(),pending:false};entry.until=now()+(result&&!result.pending?60000:1000);}
      onUpdate(active);
    }
    function read(active,candidate,settings){
      activate(active);
      const {qualification,storedIndex,...input}=candidate,key=JSON.stringify([input,settings]);
      const existing=entries.get(key);
      if(existing&&(!existing.result||existing.until>now()))return copy(existing.result||pending());
      // Bound retained evidence and results; pending jobs cannot grow with UI events.
      if(entries.size>=256){const oldKey=entries.keys().next().value;entries.delete(oldKey);queued.delete(oldKey);}
      const row={id:++nextId,key,candidate:input,settings};entries.set(key,{id:row.id,result:null,until:0});queued.set(key,row);
      if(timer===null)timer=setTimeout(flush,0);
      return pending();
    }
    return {read,isPending:()=>[...entries.values()].some(entry=>!entry.result),clear:()=>activate(null)};
  }
  return {create};
});
