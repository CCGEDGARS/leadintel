(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelStateBudget=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const MAX_SYNC_BYTES=500*1024;
  const TARGET_SYNC_BYTES=450*1024;
  const MAX_RESTORED_SECTION_BYTES=8*1024*1024;
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
  const REFERENCE_FORMAT='leadintel-discovery-refs-v1';
  const NESTED_FORMAT='leadintel-discovery-refs-v2';
  const SECTION_FORMAT='leadintel-workspace-section-refs-v1';
  // Workflow views repeat the same company, buyer pool and provider evidence.
  // Share equal copies on the wire without deleting any record or audit field.
  function packRepeatedDiscovery(value){
    if(!value||typeof value!=='object')return value;
    const counts=new Map(),identities=new WeakMap();
    function count(item){
      if(!item||typeof item!=='object')return;
      const identity=JSON.stringify(item);identities.set(item,identity);
      if(identity.length>=512)counts.set(identity,(counts.get(identity)||0)+1);
      Object.values(item).forEach(count);
    }
    count(value);const values=[],indices=new Map();
    function encode(item){
      if(!item||typeof item!=='object')return item;
      const identity=identities.get(item);
      if(counts.get(identity)>1){
        if(!indices.has(identity)){indices.set(identity,values.length);values.push(item);}
        return {leadintelResearchRef:indices.get(identity)};
      }
      return Array.isArray(item)?item.map(encode):Object.fromEntries(Object.entries(item).map(([key,child])=>[key,encode(child)]));
    }
    const packed={format:REFERENCE_FORMAT,value:encode(value),values};
    return values.length&&bytes(packed)<bytes(value)?packed:value;
  }
  // Nested copies must also share their children. A key dictionary keeps the
  // many unique contact/audit rows compact without removing a single field.
  // Tagged arrays make literal user objects and reference-like keys unambiguous.
  function packNestedDiscovery(value){
    if(!value||typeof value!=='object')return value;
    const counts=new Map(),identities=new WeakMap(),keys=[],keyIds=new Map();
    function identity(item){return typeof item==='string'?'s:'+item:identities.get(item);}
    function count(item){
      if(typeof item==='string'){if(item.length>=16){const id=identity(item);counts.set(id,(counts.get(id)||0)+1);}return;}
      if(!item||typeof item!=='object')return;
      const id='o:'+JSON.stringify(item);identities.set(item,id);
      if(id.length>=256)counts.set(id,(counts.get(id)||0)+1);
      Object.values(item).forEach(count);
    }
    count(value);const values=[],indices=new Map();
    function body(item){
      if(!item||typeof item!=='object')return item;
      if(Array.isArray(item))return [2,...item.map(encode)];
      const result=[1];
      for(const [key,child] of Object.entries(item)){
        if(!keyIds.has(key)){keyIds.set(key,keys.length);keys.push(key);}
        result.push(keyIds.get(key),encode(child));
      }
      return result;
    }
    function encode(item){
      const id=(typeof item==='string'||item&&typeof item==='object')?identity(item):null;
      if(counts.get(id)>1){
        if(!indices.has(id)){
          const index=values.length;indices.set(id,index);values.push(null);
          values[index]=body(item);
        }
        return [0,indices.get(id)];
      }
      return body(item);
    }
    const packed={format:NESTED_FORMAT,value:encode(value),keys,values};
    return bytes(packed)<bytes(value)?packed:value;
  }
  function restoreNestedDiscovery(value,maxBytes=MAX_RESTORED_SECTION_BYTES){
    const invalid=()=>{throw new Error('Invalid stored discovery research references');};
    if(!Array.isArray(value.keys)||value.keys.length>5000||!value.keys.every(key=>typeof key==='string')||!Array.isArray(value.values)||value.values.length>20000)invalid();
    const active=new Set(),stringSizes=new Map();let nodes=0,expandedBytes=0;
    function reserve(value){
      let size=8;
      if(typeof value==='string'){
        if(!stringSizes.has(value))stringSizes.set(value,bytes(value));
        size=stringSizes.get(value);
      }
      expandedBytes+=size+1;
      if(expandedBytes>maxBytes)throw new Error('Stored workspace research exceeds safe restore limit');
    }
    function expand(item,depth=0){
      if(++nodes>2000000||depth>150)invalid();
      if(!Array.isArray(item)){if(item&&typeof item==='object')invalid();reserve(item);return item;}
      if(item[0]===0&&item.length===2){
        const index=item[1];
        if(!Number.isInteger(index)||index<0||index>=value.values.length||active.has(index))invalid();
        active.add(index);const result=expand(value.values[index],depth+1);active.delete(index);return result;
      }
      if(item[0]===2){reserve(null);return item.slice(1).map(child=>expand(child,depth+1));}
      if(item[0]!==1||item.length%2!==1)invalid();
      const entries=[],seen=new Set();
      for(let i=1;i<item.length;i+=2){
        const index=item[i];
        if(!Number.isInteger(index)||index<0||index>=value.keys.length||seen.has(value.keys[index]))invalid();
        seen.add(value.keys[index]);reserve(value.keys[index]);entries.push([value.keys[index],expand(item[i+1],depth+1)]);
      }
      return Object.fromEntries(entries);
    }
    const restored=expand(value.value);
    if(!restored||typeof restored!=='object'||Array.isArray(restored))invalid();
    return restored;
  }
  const RECOVERY_FORMAT='leadintel-sync-recovery-refs-v1';
  function packRecoveryRecord(record){
    if(!record||bytes(record)<65536)return record;
    const data=packNestedDiscovery(record);
    return data?.format===NESTED_FORMAT?{format:RECOVERY_FORMAT,workspace_id:record.workspace_id,data}:record;
  }
  function restoreRecoveryRecord(record){
    if(record?.format!==RECOVERY_FORMAT)return record;
    const restored=restoreNestedDiscovery(record.data,32*1024*1024);
    if(restored.workspace_id!==record.workspace_id)throw new Error('Stored recovery workspace does not match');
    return restored;
  }
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
    if(['main','outreach','delivery'].includes(key)&&value?.format===SECTION_FORMAT)return restoreFromSync(restoreNestedDiscovery(value),key);
    if(key==='discovery'&&value?.format===NESTED_FORMAT)return restoreFromSync(restoreNestedDiscovery(value),key);
    if(key==='discovery'&&value?.format===REFERENCE_FORMAT){
      if(!Array.isArray(value.values)||value.values.length>5000||!value.value||typeof value.value!=='object')throw new Error('Invalid stored discovery research references');
      let expandedBytes=0;const sizes=new Map();
      function expand(item){
        if(!item||typeof item!=='object')return item;
        if(Object.keys(item).length===1&&Object.prototype.hasOwnProperty.call(item,'leadintelResearchRef')){
          const index=item.leadintelResearchRef;
          if(!Number.isInteger(index)||index<0||index>=value.values.length)throw new Error('Invalid stored discovery research references');
          if(!sizes.has(index))sizes.set(index,bytes(value.values[index]));
          expandedBytes+=sizes.get(index);
          if(expandedBytes>MAX_RESTORED_SECTION_BYTES)throw new Error('Stored workspace research exceeds safe restore limit');
          return cloneValue(value.values[index]);
        }
        return Array.isArray(item)?item.map(expand):Object.fromEntries(Object.entries(item).map(([field,child])=>[field,expand(child)]));
      }
      return restoreFromSync(expand(value.value),key);
    }
    if(key==='resultDiagnostics'&&value?.format===TRACE_FORMAT){
      const {columns,values,rows}=value;
      if(!Array.isArray(columns)||columns.length>100||!columns.every(column=>typeof column==='string')||!Array.isArray(values)||!Array.isArray(rows)||rows.length>500)throw new Error('Invalid stored buyer research trace');
      let expandedBytes=0;const sizes=new Map();
      return rows.map(row=>{
        if(!Array.isArray(row)||row.length!==columns.length||!row.every(index=>Number.isInteger(index)&&index>=-1&&index<values.length))throw new Error('Invalid stored buyer research trace');
        for(const index of row){if(index===-1)continue;if(!sizes.has(index))sizes.set(index,bytes(values[index]));expandedBytes+=sizes.get(index);}
        if(expandedBytes>MAX_RESTORED_SECTION_BYTES)throw new Error('Stored workspace research exceeds safe restore limit');
        return Object.fromEntries(columns.flatMap((column,index)=>row[index]===-1?[]:[[column,cloneValue(values[row[index]])]]));
      });
    }
    if(Array.isArray(value))return value.map(row=>restoreFromSync(row));
    if(!value||typeof value!=='object')return value;
    return Object.fromEntries(Object.entries(value).map(([field,item])=>[field,restoreFromSync(item,field)]));
  }
  function cloneValue(value){return JSON.parse(JSON.stringify(value));}
  function compactBundle(input={},options={}){
    const original=clone(input);let payload=restoreFromSync(clone(input));
    payload.main=compactMain(payload.main||{},8000,12000);
    for(const [webChars,pdfChars,evidenceChars] of [[4000,6000,1800],[1500,2500,900],[1500,2500,450]]){
      if(bytes(payload)<=TARGET_SYNC_BYTES)break;
      payload.main=compactMain(payload.main||{},webChars,pdfChars);
      payload=compactEvidenceCopies(payload,evidenceChars);
    }
    if(bytes(payload)>TARGET_SYNC_BYTES)payload=packBuyerTraces(payload);
    if(bytes(payload)>TARGET_SYNC_BYTES){
      const repeated=packRepeatedDiscovery(payload.discovery),nested=packNestedDiscovery(payload.discovery);
      payload.discovery=bytes(nested)<bytes(repeated)?nested:repeated;
    }
    if(bytes(payload)>TARGET_SYNC_BYTES&&options.allowSectionPacking!==false){
      for(const key of ['main','outreach','delivery']){
        const packed=packNestedDiscovery(payload[key]);
        if(packed?.format===NESTED_FORMAT)payload[key]={...packed,format:SECTION_FORMAT};
      }
    }
    return {payload,bytes:bytes(payload),compacted:JSON.stringify(payload)!==JSON.stringify(original)};
  }
  function prepareForSync(input={},options={}){
    const result=compactBundle(input,options);
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
  return {packRecoveryRecord,restoreRecoveryRecord,MAX_SYNC_BYTES,TARGET_SYNC_BYTES,bytes,compactBundle,restoreFromSync,prepareForSync,compactMainStorageValue,installStorageGuard};
});
