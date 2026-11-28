import {storageModels} from './workspace-storage-models.js';
import {payloadRecordCleanup} from './workspace-record-store.js';
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export function storagePreferences(row){return {auto_report_copies:row.auto_report_copies!==0,revision:Number(row.storage_policy_revision||0)};}
export async function listStorageFiles(env,workspace){
 const materials=await stmt(env,`SELECT id,filename,revision,status,created_at,original_key,text_key FROM company_materials WHERE workspace_id=?`,workspace).all();
 const books=await stmt(env,`SELECT id,filename,revision,status,created_at,original_key,text_key,catalogue_key FROM writing_reference_sources WHERE workspace_id=? AND status<>'Deleted'`,workspace).all();
 const objects=await stmt(env,'SELECT object_key,byte_size,state FROM workspace_storage_objects WHERE workspace_id=?',workspace).all();
 const sizes=new Map(objects.results.map(row=>[row.object_key,row]));
 const card=(row,kind)=>{
  const keys=[row.original_key,row.text_key,row.catalogue_key].filter(Boolean),measured=keys.every(key=>sizes.get(key)?.state==='ready');
  return {id:row.id,kind,name:row.filename,status:row.status,revision:row.revision,created_at:row.created_at,measured,bytes:keys.reduce((n,key)=>n+Number(sizes.get(key)?.byte_size||0),0)};
 };
 return {workspace_id:workspace,files:[...materials.results.map(row=>card(row,'material')),...books.results.map(row=>card(row,'book'))].sort((a,b)=>b.bytes-a.bytes||a.name.localeCompare(b.name)),note:'Uploaded company files and books. Other saved content is included in the usage bars.'};
}

const groupNames={
 snapshots:'Workspace backups',workspace_payload_records:'Shared workspace and workflow data',
 customer_workspace_state:'Current workspace',customer_project_state:'Saved project data',
 workspace_storage_objects:'Uploaded files and skill packages',customer_brand_asset_chunks:'Brand files',
 writing_reference_sources:'Books',writing_reference_chunks:'Book analysis',content_materials:'Content library',
 copilot_conversations:'Ask LeadIntel conversations',company_lists:'Company lists and scans',
 crm_companies:'CRM companies',saved_flow_versions:'Saved workflow versions'
};
function label(key){return groupNames[key]||key.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());}
function size(model){return model.fields.map(field=>'('+field+')').join('+');}
function scope(model){
 // Query child rows through the indexed workspace parent.
 const parent=model.scope.match(/^\(SELECT workspace_id FROM (\w+) WHERE id=r\.(\w+)\)$/);
 return parent?'r.'+parent[2]+' IN (SELECT id FROM '+parent[1]+' WHERE workspace_id=?1)':model.scope+'=?1';
}
export async function storageBreakdown(env,workspace){
 const groups=Object.entries(storageModels);
 // D1 permits five SELECT terms per compound statement.
 const termsPerQuery=5,rows=[];
 for(let i=0;i<groups.length;i+=termsPerQuery){
  const sql=groups.slice(i,i+termsPerQuery).map(([key,m])=>"SELECT '"+key+"' AS key,COUNT(*) AS count,COALESCE(SUM("+size(m)+"),0) AS bytes FROM "+key+" r WHERE "+scope(m)).join(' UNION ALL ');
  rows.push(...(await stmt(env,sql,workspace).all()).results);
 }
 return rows.filter(row=>row.bytes>0).map(row=>({...row,label:label(row.key),meter:storageModels[row.key].meter})).sort((a,b)=>b.bytes-a.bytes);
}
const newestBackup="(SELECT id FROM snapshots WHERE workspace_id=?1 ORDER BY created_at DESC,rowid DESC LIMIT 1)";
export async function storageGroup(env,workspace,key,offset,userId){
 if(!Object.hasOwn(storageModels,key)||!Number.isSafeInteger(offset)||offset<0)throw Object.assign(Error('Invalid storage category or page'),{status:400});
 const m=storageModels[key],id=m.id?'r.id':'r.rowid';
 let name=m.name?'r.'+m.name:'NULL';
 if(key==='companies')name='r.canonical_name';
 if(key==='contacts')name='r.full_name';
 if(key==='snapshots')name="'Workspace backup · ' || r.generated_at";
 if(key==='company_lists')name="json_extract(r.input_json,'$.name')";
 if(key==='saved_flow_versions')name="r.name || ' · version ' || r.version";
 if(key==='workspace_storage_objects')name=`COALESCE(
  (SELECT filename FROM writing_reference_sources b WHERE b.workspace_id=r.workspace_id AND r.object_key IN (b.original_key,b.text_key,b.catalogue_key)),
  (SELECT filename FROM company_materials m WHERE m.workspace_id=r.workspace_id AND r.object_key IN (m.original_key,m.text_key)),
  (SELECT title FROM workspace_skills s WHERE s.workspace_id=r.workspace_id AND r.object_key LIKE 'skills/'||s.workspace_id||'/'||s.id||'/%'),'Stored file') || ' · ' || CASE WHEN r.object_key LIKE '%/original' THEN 'original' WHEN r.object_key LIKE '%/text.json' THEN 'extracted text' ELSE 'analysis or package' END`;
 if(key==='workspace_payload_records')name=`COALESCE(
  (SELECT name || ' · version ' || version FROM saved_flow_versions v WHERE v.workspace_id=r.workspace_id AND json_extract(v.payload_json,'$.snapshot')=r.snapshot_id LIMIT 1),
  (SELECT name FROM saved_flows f WHERE f.workspace_id=r.workspace_id AND json_extract(f.payload_json,'$.snapshot')=r.snapshot_id LIMIT 1),'Workspace data') || ' · part ' || (r.part_index+1)`;
 const personal=['writing_workspace_records','personal_script_library','phone_script_drafts','inmail_script_drafts'].includes(key);
 const columns=[id+' AS id','substr('+name+',1,240) AS name',(m.date?'r.'+m.date:'NULL')+' AS date',
  (m.revision?'r.revision':'NULL')+' AS revision',size(m)+' AS bytes'];
 if(key==='snapshots')columns.push('r.id<>'+newestBackup+' AS old_backup');
 if(key==='saved_flow_versions')columns.push('r.flow_id','r.version','r.version<(SELECT latest_version FROM saved_flows f WHERE f.workspace_id=r.workspace_id AND f.id=r.flow_id) AS old_version');
 if(key==='workspace_skills')columns.push('r.status');
 if(key==='writing_workspace_records')columns.push('r.archived');
 if(personal)columns.push('r.user_id=?3 AS own');
 const sql='SELECT '+columns.join(',')+' FROM '+key+' r WHERE '+scope(m)+' ORDER BY bytes DESC,r.rowid LIMIT 51 OFFSET ?2';
 const rows=(await stmt(env,sql,workspace,offset,...(personal?[userId]:[])).all()).results.map(row=>row.own===0?{bytes:row.bytes,name:'Private workspace item'}:row);
 return {workspace_id:workspace,key,items:rows.slice(0,50),more:rows.length>50};
}
export async function removeBackup(env,workspace,id){
 const result=await stmt(env,'DELETE FROM snapshots WHERE workspace_id=?1 AND id=?2 AND id<>'+newestBackup,workspace,id).run();
 if(!result.meta.changes)throw Object.assign(Error('This backup is current or has already been removed.'),{status:409});
}

export async function removeFlowVersion(env,workspace,flow,version){
 const versionRow=await stmt(env,"SELECT json_extract(payload_json,'$.snapshot') AS snapshot FROM saved_flow_versions WHERE workspace_id=? AND flow_id=? AND version=?",workspace,flow,version).first();
 if(!versionRow)throw Object.assign(Error('Version already removed.'),{status:409});
 const remove=stmt(env,`DELETE FROM saved_flow_versions WHERE workspace_id=?1 AND flow_id=?2 AND version=?3
  AND version<(SELECT latest_version FROM saved_flows WHERE workspace_id=?1 AND id=?2)`,workspace,flow,version);
 const [result]=await env.DB.batch([remove,...(versionRow.snapshot?[payloadRecordCleanup(env,workspace,versionRow.snapshot)]:[])]);
 if(!result.meta.changes)throw Object.assign(Error('This version is current or has already been removed.'),{status:409});
}

export async function removeArchivedDraft(env,workspace,userId,id,revision){
 const result=await stmt(env,'DELETE FROM writing_workspace_records WHERE workspace_id=? AND user_id=? AND id=? AND revision=? AND archived=1',workspace,userId,id,revision).run();
 if(!result.meta.changes)throw Object.assign(Error('The draft changed or is no longer archived.'),{status:409});
}
