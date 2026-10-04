(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelStateBudget=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const MAX_SYNC_BYTES=500*1024;
  const TARGET_SYNC_BYTES=450*1024;
  const MAIN_STORAGE_KEY="leadintel_customer_v2_state";
  const encoder=typeof TextEncoder!=="undefined"?new TextEncoder():null;

  function clone(value){return JSON.parse(JSON.stringify(value&&typeof value==="object"?value:{}));}
  function bytes(value){const text=JSON.stringify(value);return encoder?encoder.encode(text).byteLength:Buffer.byteLength(text,"utf8");}
  function cut(value,max){const text=String(value||"");return text.length>max?text.slice(0,max):text;}
  function compactMain(main={},webChars=8000,pdfChars=12000){
    const next={...main};
    if(Array.isArray(main.scrapedSources))next.scrapedSources=main.scrapedSources.map(source=>({...source,text:cut(source?.text,webChars)}));
    if(Array.isArray(main.documents))next.documents=main.documents.map(doc=>({...doc,text:cut(doc?.text,pdfChars)}));
    return next;
  }
  // Only extracted research bodies are disposable copies. Business records and source provenance stay intact.
  function compactEvidenceCopies(value,max,key=''){
    if(Array.isArray(value))return value.map(row=>compactEvidenceCopies(row,max,key));
    if(!value||typeof value!=='object')return value;
    const evidenceRow=['evidence','rawResults','researchResults','sources'].includes(key)&&Boolean(value.url);
    const next={};let truncated=false;
    for(const [field,item] of Object.entries(value)){
      if(evidenceRow&&['text','markdown','content','description'].includes(field)&&typeof item==='string'){
        next[field]=cut(item,max);truncated ||= next[field]!==item;
      }else next[field]=compactEvidenceCopies(item,max,field);
    }
    if(truncated)next.evidenceTextTruncated=true;
    return next;
  }
  const TRACE_FORMAT='leadintel-buyer-trace-v1';
  function packBuyerTraces(value,key=''){
    if(key==='resultDiagnostics'&&Array.isArray(value)&&value.length>=20&&value.every(row=>row&&typeof row==='object'&&!Array.isArray(row))){
      const columns=[...new Set(value.flatMap(row=>Object.keys(row)))],values=[],dictionary=new Map();
      const rows=value.map(row=>columns.map(column=>{
        if(!Object.prototype.hasOwnProperty.call(row,column))return -1;
        const item=row[column],identity=JSON.stringify(item);
        if(!dictionary.has(identity)){dictionary.set(identity,values.length);values.push(item);}
        return dictionary.get(identity);
      }));
      const packed={format:TRACE_FORMAT,columns,values,rows};
      return bytes(packed)<bytes(value)?packed:value;
    }
    if(Array.isArray(value))return value.map(row=>packBuyerTraces(row));
    if(!value||typeof value!=='object')return value;
    return Object.fromEntries(Object.entries(value).map(([field,item])=>[field,packBuyerTraces(item,field)]));
  }
  function restoreFromSync(value,key=''){
    if(key==='resultDiagnostics'&&value?.format===TRACE_FORMAT){
      const {columns,values,rows}=value;
      if(!Array.isArray(columns)||columns.length>100||!columns.every(column=>typeof column==='string')||!Array.isArray(values)||!Array.isArray(rows)||rows.length>500)throw new Error('Invalid stored buyer research trace');
      return rows.map(row=>{
        if(!Array.isArray(row)||row.length!==columns.length||!row.every(index=>Number.isInteger(index)&&index>=-1&&index<values.length))throw new Error('Invalid stored buyer research trace');
        return Object.fromEntries(columns.flatMap((column,index)=>row[index]===-1?[]:[[column,cloneValue(values[row[index]])]]));
      });
    }
    if(Array.isArray(value))return value.map(row=>restoreFromSync(row));
    if(!value||typeof value!=='object')return value;
    return Object.fromEntries(Object.entries(value).map(([field,item])=>[field,restoreFromSync(item,field)]));
  }
  function cloneValue(value){return JSON.parse(JSON.stringify(value));}
  function compactBundle(input={}){
    const original=clone(input);let payload=clone(input);
    payload.main=compactMain(payload.main||{},8000,12000);
    for(const [webChars,pdfChars,evidenceChars] of [[4000,6000,1800],[1500,2500,900],[1500,2500,450]]){
      if(bytes(payload)<=TARGET_SYNC_BYTES)break;
      payload.main=compactMain(payload.main||{},webChars,pdfChars);
      payload=compactEvidenceCopies(payload,evidenceChars);
    }
    if(bytes(payload)>TARGET_SYNC_BYTES)payload=packBuyerTraces(payload);
    return {payload,bytes:bytes(payload),compacted:JSON.stringify(payload)!==JSON.stringify(original)};
  }
  function prepareForSync(input={}){
    const result=compactBundle(input);
    if(result.bytes>MAX_SYNC_BYTES)throw new Error(`Workspace state is ${Math.ceil(result.bytes/1024)} KB after evidence compaction and cannot be synced because the 500 KB sync limit is a hard safety ceiling. Reduce unusually large pipeline/history data before retrying.`);
    return result;
  }
  function compactMainStorageValue(value){
    try{const parsed=JSON.parse(String(value||"{}"));return JSON.stringify(compactMain(parsed));}catch{return value;}
  }
  function installStorageGuard(){
    if(!root||typeof root.Storage==="undefined"||!root.localStorage||root.Storage.prototype.__leadintelStateBudgetPatched)return;
    const originalSet=root.Storage.prototype.setItem;
    root.Storage.prototype.setItem=function(key,value){
      const next=this===root.localStorage&&key===MAIN_STORAGE_KEY?compactMainStorageValue(value):value;
      return originalSet.call(this,key,next);
    };
    root.Storage.prototype.__leadintelStateBudgetPatched=true;
  }

  installStorageGuard();
  return {MAX_SYNC_BYTES,TARGET_SYNC_BYTES,bytes,compactBundle,restoreFromSync,prepareForSync,compactMainStorageValue,installStorageGuard};
});