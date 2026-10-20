import stateBudget from '../../customer/state-budget.js';

export const WORKSPACE_RECORD_CODEC='workspace-records-v1';
export const MAX_WORKSPACE_TRANSFER_BYTES=8*1024*1024;
const FORMAT='leadintel-workspace-records-v1',INLINE_BYTES=384*1024,CHUNK_CHARS=128*1024;
const bytes=value=>new TextEncoder().encode(value).byteLength;
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');

// Large evidence travels as a complete payload, but occupies independent durable
// rows. Workspace and saved-flow rows only hold this content-addressed manifest.
export async function preparePayloadRecord(payload,{forceRecords=false}={}){
 const encoded=typeof payload==='string'?payload:JSON.stringify(payload);
 const size=bytes(encoded);if(size>MAX_WORKSPACE_TRANSFER_BYTES)throw Error('Workspace exceeds the 8 MB transfer limit');
 if(!forceRecords&&size<=INLINE_BYTES)return {encoded,chunks:[]};
 const chunks=[];for(let start=0;start<encoded.length;){let end=Math.min(start+CHUNK_CHARS,encoded.length);if(end<encoded.length&&/[\uD800-\uDBFF]/.test(encoded[end-1]))end--;chunks.push(encoded.slice(start,end));start=end;}
 const snapshot=await hash(encoded);
 return {encoded:JSON.stringify({format:FORMAT,snapshot,commit:crypto.randomUUID(),parts:chunks.length,bytes:size}),snapshot,chunks};
}
export function payloadRecordWrites(env,workspaceId,record,guardSql,guardArgs=[]){
 return record.chunks.map((content,index)=>env.DB.prepare(`INSERT OR IGNORE INTO workspace_payload_records(workspace_id,snapshot_id,part_index,content) SELECT ?,?,?,? WHERE ${guardSql}`).bind(workspaceId,record.snapshot,index,content,...guardArgs));
}
export function readStoredPayload(env,workspaceId,encoded){
 let payload=JSON.parse(encoded||'{}');
 if(payload?.format!==FORMAT)return stateBudget.restoreFromSync(payload);
 return hydratePayloadRecords(env,workspaceId,payload);
}
async function hydratePayloadRecords(env,workspaceId,payload,parts){
  if(!/^[a-f0-9]{64}$/.test(payload.snapshot)||!Number.isSafeInteger(payload.parts)||payload.parts<1||payload.parts>64||!Number.isSafeInteger(payload.bytes)||payload.bytes>MAX_WORKSPACE_TRANSFER_BYTES)throw Error('Invalid stored workspace manifest');
  const results=parts||(await env.DB.prepare('SELECT part_index,content FROM workspace_payload_records WHERE workspace_id=? AND snapshot_id=? ORDER BY part_index').bind(workspaceId,payload.snapshot).all()).results||[];
  if(results.length!==payload.parts||results.some((row,index)=>row.part_index!==index))throw Error('Stored workspace research is incomplete');
  const text=results.map(row=>row.content).join('');
  if(bytes(text)!==payload.bytes||await hash(text)!==payload.snapshot)throw Error('Stored workspace research integrity check failed');
  payload=JSON.parse(text);
  if(payload?.format===FORMAT)throw Error('Invalid nested workspace manifest');
 return stateBudget.restoreFromSync(payload);
}
export function payloadRecordCleanup(env,workspaceId){
 // A saved flow may still own an older snapshot. Never collect referenced data.
 return env.DB.prepare(`DELETE FROM workspace_payload_records WHERE workspace_id=? AND snapshot_id NOT IN (SELECT json_extract(payload_json,'$.snapshot') FROM customer_workspace_state WHERE workspace_id=? AND json_extract(payload_json,'$.format')='${FORMAT}' UNION SELECT json_extract(payload_json,'$.snapshot') FROM saved_flows WHERE workspace_id=? AND json_extract(payload_json,'$.format')='${FORMAT}')`).bind(workspaceId,workspaceId,workspaceId);
}

// A single SELECT gives both the owner revision and its immutable chunks the
// same database snapshot. A concurrent save/GC cannot tear this read in half.
export async function readOwnedPayload(env,workspaceId,row,{flowId}={}){
 const parsed=JSON.parse(row?.payload_json||'{}');
 if(parsed?.format!==FORMAT)return {row,payload:stateBudget.restoreFromSync(parsed)};
 const table=flowId?'saved_flows':'customer_workspace_state';
 const where=flowId?' AND s.id=?':'';
 const {results=[]}=await env.DB.prepare(`SELECT s.*,r.part_index AS record_part_index,r.content AS record_content FROM ${table} s LEFT JOIN workspace_payload_records r ON r.workspace_id=s.workspace_id AND r.snapshot_id=json_extract(s.payload_json,'$.snapshot') WHERE s.workspace_id=?${where} ORDER BY r.part_index`).bind(workspaceId,...(flowId?[flowId]:[])).all();
 if(!results.length)throw Error('Stored workspace owner is unavailable');
 const {record_part_index,record_content,...owner}=results[0];
 const manifest=JSON.parse(owner.payload_json||'{}');
 const payload=manifest?.format===FORMAT?await hydratePayloadRecords(env,workspaceId,manifest,results.filter(r=>r.record_part_index!==null).map(r=>({part_index:r.record_part_index,content:r.record_content}))):stateBudget.restoreFromSync(manifest);
 return {row:owner,payload};
}

export async function readWorkspaceWrite(request){
 const limit=MAX_WORKSPACE_TRANSFER_BYTES+16384;
 const tooLarge=()=>Object.assign(Error('Workspace request exceeds the 8 MB transfer limit'),{status:413});
 if(Number(request.headers.get('Content-Length')||0)>limit)throw tooLarge();
 const reader=request.body?.getReader();if(!reader)throw Error('Customer state payload is required');
 const decoder=new TextDecoder();let size=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw tooLarge();}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
 finally{reader.releaseLock();}
 return JSON.parse(text);
}
