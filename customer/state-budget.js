(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelStateBudget=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const MAX_SYNC_BYTES=500*1024;
  const MAX_RECORD_SYNC_BYTES=8*1024*1024;
  function syncLimit(options={}){return Math.max(MAX_SYNC_BYTES,Math.min(MAX_RECORD_SYNC_BYTES,Number(options.maxSyncBytes)||MAX_SYNC_BYTES));}
  const TARGET_SYNC_BYTES=450*1024;
  const MAX_RESTORED_SECTION_BYTES=8*1024*1024;
  const MAX_RESTORED_DISCOVERY_BYTES=32*1024*1024;
  const sectionRestoreLimit=key=>key==='discovery'?MAX_RESTORED_DISCOVERY_BYTES:MAX_RESTORED_SECTION_BYTES;
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
  const BUNDLE_FORMAT='leadintel-workspace-bundle-refs-v1';
  const TEXT_ENCODING='lzw16-refs-base64-v2',LEGACY_TEXT_ENCODING='lzw16-base64-v1';
  const LOCAL_TEXT_ENCODING='lzw16-jsonrefs-base64-v2';
  const MAX_RESTORED_BUNDLE_BYTES=64*1024*1024;
  function base64Encode(raw){return typeof btoa==='function'?btoa(raw):Buffer.from(raw,'binary').toString('base64');}
  // Fixed-width byte codes avoid dependencies and remain synchronous at every save boundary.
  // The dictionary freezes at 65536 entries; both encoding and decoding use the same bound.
  function compressWorkspace(value){
    if(bytes(value)>MAX_RESTORED_BUNDLE_BYTES||Object.entries(value).some(([key,section])=>bytes(section)>sectionRestoreLimit(key)))return null;
    const data=compressText(JSON.stringify(packNestedDiscovery(value)));
    const shared={main:{format:BUNDLE_FORMAT,encoding:TEXT_ENCODING,data}};
    if(value.meta?.persistence)shared.meta={persistence:cloneValue(value.meta.persistence)};
    return bytes(shared)<bytes(value)?shared:null;
  }
  function compressText(text){
    const input=new TextEncoder().encode(text),dictionary=new Map(),codes=[];let next=256,word='';
    for(const byte of input){const char=String.fromCharCode(byte),joined=word+char;if(joined.length===1||dictionary.has(joined)){word=joined;continue;}codes.push(word.length===1?word.charCodeAt(0):dictionary.get(word));if(next<65536)dictionary.set(joined,next++);word=char;}
    if(word)codes.push(word.length===1?word.charCodeAt(0):dictionary.get(word));
    let raw='';for(const code of codes)raw+=String.fromCharCode(code>>>8,code&255);
    return base64Encode(raw);
  }
  function decompressText(value,maxEncodedBytes,maxDecodedBytes){
    const invalid=()=>{throw new Error('Invalid stored compressed workspace');};
    if(![TEXT_ENCODING,LEGACY_TEXT_ENCODING,LOCAL_TEXT_ENCODING].includes(value.encoding)||typeof value.data!=='string'||value.data.length>maxEncodedBytes||value.data.length%4||!value.data.length||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data))invalid();
    let raw;try{raw=typeof atob==='function'?atob(value.data):Buffer.from(value.data,'base64').toString('binary');}catch{invalid();}
    if(raw.length%2||base64Encode(raw)!==value.data)invalid();
    const dictionary=Array.from({length:256},(_,i)=>String.fromCharCode(i));let next=256,previous='',size=0;const chunks=[];
    for(let i=0;i<raw.length;i+=2){const code=(raw.charCodeAt(i)<<8)|raw.charCodeAt(i+1);let word=dictionary[code];if(word===undefined){if(!previous||code!==next||next>=65536)invalid();word=previous+previous[0];}size+=word.length;if(size>maxDecodedBytes)throw new Error('Stored workspace research exceeds safe restore limit');chunks.push(word);if(previous&&next<65536)dictionary[next++]=previous+word[0];previous=word;}
    try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(chunks.join(''),char=>char.charCodeAt(0)));}catch{invalid();}
  }
  function restoreCompressedWorkspace(value,maxEncodedBytes=MAX_RECORD_SYNC_BYTES){
    const decoded=decompressText(value,maxEncodedBytes,MAX_RESTORED_BUNDLE_BYTES);
    try{const restored=JSON.parse(decoded);if(!restored||typeof restored!=='object'||Array.isArray(restored))throw new Error();return value.encoding===TEXT_ENCODING&&restored.format===NESTED_FORMAT?restoreNestedDiscovery(restored,MAX_RESTORED_BUNDLE_BYTES):restored;}catch{throw new Error('Invalid stored compressed workspace');}
  }
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
  const SNAPSHOT_FORMAT='leadintel-workspace-snapshot-lzw-v1';
  function packWorkspaceSnapshot(record){
    if(!record||bytes(record)<65536)return record;
    const packed=compressWorkspace({main:record});
    // The existing bounded decoder accepts at most 500 KB of encoded text.
    return packed&&packed.main.data.length<=MAX_SYNC_BYTES?{format:SNAPSHOT_FORMAT,workspace_id:record.workspace_id||'',data:packed}:record;
  }
  function restoreWorkspaceSnapshot(record){
    if(record?.format!==SNAPSHOT_FORMAT)return record;
    const restored=restoreFromSync(record.data).main;
    if(!restored||!restored.data||(restored.workspace_id||'')!==record.workspace_id)throw new Error('Stored snapshot workspace does not match');
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
    if(key===''&&value?.main?.format===BUNDLE_FORMAT){
      const invalid=()=>{throw new Error('Invalid stored workspace bundle');};
      if(Object.keys(value).some(k=>!['main','meta'].includes(k))||(value.meta!=null&&(typeof value.meta!=='object'||Array.isArray(value.meta)))||Object.keys(value.meta||{}).some(k=>k!=='persistence'))invalid();
      const restored=value.main.encoding!==undefined?restoreCompressedWorkspace(value.main):restoreNestedDiscovery(value.main,MAX_RESTORED_BUNDLE_BYTES);
      if(Object.keys(restored).some(k=>!['main','discovery','outreach','delivery','meta'].includes(k))||restored.main?.format===BUNDLE_FORMAT)invalid();
      for(const [name,section] of Object.entries(restored))if(!section||typeof section!=='object'||Array.isArray(section)||bytes(section)>sectionRestoreLimit(name))invalid();
      if(value.meta?.persistence)restored.meta={...restored.meta,persistence:cloneValue(value.meta.persistence)};
      return restoreFromSync(restored);
    }
    if(['main','outreach','delivery'].includes(key)&&value?.format===SECTION_FORMAT)return restoreFromSync(restoreNestedDiscovery(value),key);
    if(key==='discovery'&&value?.format===NESTED_FORMAT)return restoreFromSync(restoreNestedDiscovery(value,MAX_RESTORED_DISCOVERY_BYTES),key);
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
    const original=clone(input);let payload=restoreFromSync(clone(input));let compressionBytes=null;
    // Record-capable servers persist the complete research separately. Legacy
    // clients keep their original bounded encoding until the server advertises it.
    if(syncLimit(options)>MAX_SYNC_BYTES&&bytes(payload)<=syncLimit(options))return {payload,bytes:bytes(payload),compacted:false};
    if(options.allowCompressionPacking===true){const compressed=compressWorkspace(payload);compressionBytes=compressed?bytes(compressed):null;if(compressed&&bytes(compressed)<=syncLimit(options))return {payload:compressed,bytes:bytes(compressed),compacted:true};}
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
    if(bytes(payload)>TARGET_SYNC_BYTES&&options.allowBundlePacking===true){
      const restored=restoreFromSync(payload),packed=packNestedDiscovery(restored);
      if(packed?.format===NESTED_FORMAT){
        const shared={main:{...packed,format:BUNDLE_FORMAT}};
        if(restored.meta?.persistence)shared.meta={persistence:cloneValue(restored.meta.persistence)};
        if(bytes(shared)<bytes(payload))payload=shared;
      }
    }
    if(options.allowCompressionPacking===true&&bytes(payload)>TARGET_SYNC_BYTES){const compressed=compressWorkspace(restoreFromSync(payload));compressionBytes=compressed?bytes(compressed):null;if(compressed&&bytes(compressed)<bytes(payload))payload=compressed;}
    return {payload,bytes:bytes(payload),compacted:JSON.stringify(payload)!==JSON.stringify(original),compressionBytes};
  }
  function prepareForSync(input={},options={}){
    const result=compactBundle(input,options);
    if(result.bytes>syncLimit(options)){if(syncLimit(options)>MAX_SYNC_BYTES)throw new Error(`Workspace exceeds the ${Math.ceil(syncLimit(options)/1024/1024)} MB transfer limit; research remains preserved locally.`);const sizes=Object.entries(result.payload).map(([key,value])=>`${key}: ${Math.ceil(bytes(value)/1024)} KB`).join(', ');throw new Error(`Workspace state is ${Math.ceil(result.bytes/1024)} KB after evidence compaction and cannot be synced because the 500 KB sync limit is a hard safety ceiling. Section sizes: ${sizes}. Compression permitted: ${options.allowCompressionPacking===true}; candidate: ${result.compressionBytes==null?'unavailable':Math.ceil(result.compressionBytes/1024)+' KB'}.`);}
    return result;
  }
  function compactMainStorageValue(value){
    try{const parsed=JSON.parse(String(value||"{}"));return JSON.stringify(compactMain(parsed));}catch{return value;}
  }
  function installStorageGuard(){
    if(!root||typeof root.Storage==="undefined"||!root.localStorage||root.Storage.prototype.__leadintelStateBudgetPatched)return;
    const originalSet=root.Storage.prototype.setItem,originalGet=root.Storage.prototype.getItem;
    const sectionKeys=new Set(['state','discovery','outreach','delivery','discovery_meta'].map(name=>'leadintel_customer_v2_'+name));
    const prefix='leadintel-local-section-lzw-v1:',cache=new Map();
    function encodeLocal(value,key){
      if(typeof value!=='string'||value.length<65536)return value;
      // Compress the original string, not parsed JSON: whitespace, approved
      // wording, Unicode and every evidence field must round-trip byte-for-byte.
      const limit=sectionRestoreLimit(key===MAIN_STORAGE_KEY?'main':key.slice('leadintel_customer_v2_'.length));
      if(new TextEncoder().encode(value).byteLength>limit)return value;
      // Canonical JSON can share identical source bodies before compression.
      // Noncanonical strings retain their original whitespace and escaping.
      try{
        const parsed=JSON.parse(value);
        if(JSON.stringify(parsed)===value){
          const packed=packNestedDiscovery(parsed);
          if(packed?.format===NESTED_FORMAT){
            const data=compressText(JSON.stringify(packed)),encoded=prefix+JSON.stringify({encoding:LOCAL_TEXT_ENCODING,data});
            if(data.length<=limit&&encoded.length<value.length)return encoded;
          }
        }
      }catch{}
      const data=compressText(value);
      if(data.length>limit)return value;
      const encoded=prefix+JSON.stringify({encoding:LEGACY_TEXT_ENCODING,data});
      return encoded.length<value.length?encoded:value;
    }
    function prepareWrite(encoded){
      if(encoded.startsWith(prefix)&&root.LeadIntelAccountCache){
        if(!root.LeadIntelAccountCache.prepareLocalStorageCodec||root.LeadIntelAccountCache.localCodecVersion!==2)throw new Error('Refresh to upgrade workspace storage safely.');
        root.LeadIntelAccountCache.prepareLocalStorageCodec();
      }
    }
    root.Storage.prototype.getItem=function(key){
      // Keep the earlier account guard in the read chain, even on cache hits.
      const raw=originalGet.call(this,key);
      if(this!==root.localStorage||!sectionKeys.has(key))return raw;
      if(raw===null){cache.delete(key);return null;}
      const previous=cache.get(key);if(previous?.raw===raw)return previous.value;
      if(!raw.startsWith(prefix)){cache.delete(key);return raw;}
      const frame=JSON.parse(raw.slice(prefix.length)),limit=sectionRestoreLimit(key.slice('leadintel_customer_v2_'.length));
      const decoded=decompressText(frame,limit,limit);
      const value=frame.encoding===LOCAL_TEXT_ENCODING?JSON.stringify(restoreNestedDiscovery(JSON.parse(decoded),limit)):decoded;
      cache.set(key,{raw,value});return value;
    };
    root.Storage.prototype.setItem=function(key,value){
      const next=this===root.localStorage&&key===MAIN_STORAGE_KEY?compactMainStorageValue(value):value;
      if(this!==root.localStorage||!sectionKeys.has(key))return originalSet.call(this,key,next);
      const text=String(next),previous=cache.get(key);
      const encoded=previous?.value===text&&originalGet.call(this,key)===previous.raw?previous.raw:encodeLocal(text,key);
      prepareWrite(encoded);
      const result=originalSet.call(this,key,encoded);
      // Only a successful durable write may replace the cached working value.
      cache.set(key,{raw:encoded,value:text});return result;
    };
    root.Storage.prototype.__leadintelStateBudgetPatched=true;
    // Free space occupied by older expanded records before server hydration.
    // A failed migration leaves that exact record intact for recovery.
    for(const key of sectionKeys){try{const raw=originalGet.call(root.localStorage,key);if(raw&&!raw.startsWith(prefix)){const encoded=encodeLocal(raw,key);if(encoded!==raw){prepareWrite(encoded);originalSet.call(root.localStorage,key,encoded);}}}catch{}}
  }

  root?.LeadIntelStartupTrace?.('storage codec:start');
  installStorageGuard();
  root?.LeadIntelStartupTrace?.('storage codec:complete');
  return {packWorkspaceSnapshot,restoreWorkspaceSnapshot,syncCodecVersion:'workspace-lzw-v2',packRecoveryRecord,restoreRecoveryRecord,MAX_SYNC_BYTES,MAX_RECORD_SYNC_BYTES,MAX_RESTORED_DISCOVERY_BYTES,TARGET_SYNC_BYTES,bytes,compactBundle,restoreFromSync,prepareForSync,compactMainStorageValue,installStorageGuard};
});
