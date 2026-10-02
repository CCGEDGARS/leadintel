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
  function compactBundle(input={}){
    const original=clone(input);let payload=clone(input);
    payload.main=compactMain(payload.main||{},8000,12000);
    for(const [webChars,pdfChars,evidenceChars] of [[4000,6000,1800],[1500,2500,900],[1500,2500,450]]){
      if(bytes(payload)<=TARGET_SYNC_BYTES)break;
      payload.main=compactMain(payload.main||{},webChars,pdfChars);
      payload=compactEvidenceCopies(payload,evidenceChars);
    }
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
  return {MAX_SYNC_BYTES,TARGET_SYNC_BYTES,bytes,compactBundle,prepareForSync,compactMainStorageValue,installStorageGuard};
});